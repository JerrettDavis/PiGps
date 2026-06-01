#include <Arduino.h>

// Pico GPS USB V1
// Board: Raspberry Pi Pico v1 / RP2040
// GPS: GY-GPS6MV2 / NEO-6M style NMEA GPS module
//
// Wiring for the physical pins you moved back to:
//   GPS VCC -> Pico VBUS  physical pin 40  OR 3V3(OUT) pin 36 if your module supports it
//   GPS GND -> Pico GND   physical pin 8/13/18/23/28/38
//   GPS TX  -> Pico GP5   physical pin 7, UART1 RX, REQUIRED
//   GPS RX  -> Pico GP4   physical pin 6, UART1 TX, optional for this phase
//
// USB serial remains the computer link for the browser companion app.

static constexpr int GPS_TX_PIN = 4;     // Pico GP4 / physical pin 6 -> GPS RX
static constexpr int GPS_RX_PIN = 5;     // Pico GP5 / physical pin 7 <- GPS TX
static constexpr uint32_t GPS_BAUD = 9600;
static constexpr uint32_t USB_BAUD = 115200;
static constexpr uint32_t STATUS_INTERVAL_MS = 1000;
static constexpr uint32_t SAT_EXPIRY_MS = 20000;

struct FixData {
  bool hasFix = false;
  uint8_t fixQuality = 0;      // GGA: 0 invalid, 1 GPS, 2 DGPS, etc.
  uint8_t fixMode = 1;         // GSA: 1 no fix, 2 2D, 3 3D
  double latitude = 0;
  double longitude = 0;
  double altitudeMeters = 0;
  double geoidSeparationMeters = 0;
  double speedKnots = 0;
  double speedKph = 0;
  double courseDeg = 0;
  uint8_t satsUsed = 0;
  uint8_t satsInView = 0;
  double hdop = 0;
  double pdop = 0;
  double vdop = 0;
  char utcTime[20] = "";
  char utcDate[20] = "";
  uint32_t lastSentenceMs = 0;
  uint32_t validSentences = 0;
  uint32_t badChecksums = 0;
  uint32_t totalSentences = 0;
  uint32_t overflowedSentences = 0;
};

struct SatInfo {
  uint8_t prn = 0;
  uint8_t elevation = 0;
  uint16_t azimuth = 0;
  uint8_t snr = 0;
  bool used = false;
  uint32_t lastSeenMs = 0;
};

FixData fix;
SatInfo sats[72];
uint8_t usedPrns[24];
uint8_t usedPrnCount = 0;
bool echoRaw = false;
static bool echoHex = false;
static bool loopbackTest = false;   // diagnostic GP4->GP5 jumper self-test, default OFF
static unsigned long rawBytesTotal = 0;
static unsigned long selfTestTxTotal = 0;
static char hexBuf[64 * 3 + 1];   // max 64 bytes * "XX " + NUL
static uint8_t hexBufCount = 0;
char nmeaBuf[128];
uint8_t nmeaLen = 0;
uint32_t lastStatusMs = 0;

static void safeCopy(char *dest, const char *src, size_t len) {
  if (!dest || len == 0) return;
  if (!src) src = "";
  strncpy(dest, src, len - 1);
  dest[len - 1] = '\0';
}

static bool sentenceTypeEndsWith(const char *type, const char *suffix) {
  if (!type || !suffix) return false;
  size_t len = strlen(type);
  size_t suffixLen = strlen(suffix);
  return len >= suffixLen && strcmp(type + len - suffixLen, suffix) == 0;
}

static double parseDouble(const char *s) {
  return (s && *s) ? atof(s) : 0;
}

static int parseInt(const char *s) {
  return (s && *s) ? atoi(s) : 0;
}

static double nmeaCoordToDecimal(const char *coord, const char *hemisphere) {
  if (!coord || !*coord || !hemisphere || !*hemisphere) return 0;
  double raw = atof(coord);
  int degrees = (int)(raw / 100.0);
  double minutes = raw - (degrees * 100.0);
  double dec = degrees + (minutes / 60.0);
  if (hemisphere[0] == 'S' || hemisphere[0] == 'W') dec = -dec;
  return dec;
}

static void splitFields(char *line, char **fields, int &count, int maxFields) {
  count = 0;
  if (!line) return;
  char *p = line;
  if (*p == '$') p++;
  while (*p && count < maxFields) {
    fields[count++] = p;
    while (*p && *p != ',' && *p != '*') p++;
    if (*p == ',' || *p == '*') {
      *p = '\0';
      p++;
    }
  }
}

static int hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'A' && c <= 'F') return 10 + c - 'A';
  if (c >= 'a' && c <= 'f') return 10 + c - 'a';
  return -1;
}

static bool validChecksum(const char *s) {
  if (!s || s[0] != '$') return false;
  const char *star = strchr(s, '*');
  if (!star || strlen(star) < 3) return false;
  uint8_t checksum = 0;
  for (const char *p = s + 1; p < star; ++p) checksum ^= (uint8_t)*p;
  int hi = hexNibble(star[1]);
  int lo = hexNibble(star[2]);
  if (hi < 0 || lo < 0) return false;
  return checksum == (uint8_t)((hi << 4) | lo);
}

static SatInfo *satByPrn(uint8_t prn) {
  if (prn == 0) return nullptr;
  for (auto &sat : sats) if (sat.prn == prn) return &sat;
  for (auto &sat : sats) {
    if (sat.prn == 0) {
      sat.prn = prn;
      return &sat;
    }
  }
  return nullptr;
}

static bool prnIsUsed(uint8_t prn) {
  for (uint8_t i = 0; i < usedPrnCount; i++) if (usedPrns[i] == prn) return true;
  return false;
}

static void refreshUsedFlags() {
  for (auto &sat : sats) if (sat.prn) sat.used = prnIsUsed(sat.prn);
}

static void parseGGA(char **f, int c) {
  if (c < 10) return;
  safeCopy(fix.utcTime, f[1], sizeof(fix.utcTime));
  fix.latitude = nmeaCoordToDecimal(f[2], f[3]);
  fix.longitude = nmeaCoordToDecimal(f[4], f[5]);
  fix.fixQuality = (uint8_t)parseInt(f[6]);
  fix.hasFix = fix.fixQuality > 0;
  fix.satsUsed = (uint8_t)parseInt(f[7]);
  fix.hdop = parseDouble(f[8]);
  fix.altitudeMeters = parseDouble(f[9]);
  if (c > 11) fix.geoidSeparationMeters = parseDouble(f[11]);
}

static void parseRMC(char **f, int c) {
  if (c < 10) return;
  safeCopy(fix.utcTime, f[1], sizeof(fix.utcTime));
  bool active = f[2] && f[2][0] == 'A';
  if (active) {
    fix.latitude = nmeaCoordToDecimal(f[3], f[4]);
    fix.longitude = nmeaCoordToDecimal(f[5], f[6]);
    fix.hasFix = true;
  } else if (fix.fixQuality == 0) {
    fix.hasFix = false;
  }
  fix.speedKnots = parseDouble(f[7]);
  fix.speedKph = fix.speedKnots * 1.852;
  fix.courseDeg = parseDouble(f[8]);
  safeCopy(fix.utcDate, f[9], sizeof(fix.utcDate));
}

static void parseGSA(char **f, int c) {
  if (c < 17) return;
  fix.fixMode = (uint8_t)parseInt(f[2]);
  usedPrnCount = 0;
  for (int i = 3; i <= 14 && i < c && usedPrnCount < sizeof(usedPrns); i++) {
    uint8_t prn = (uint8_t)parseInt(f[i]);
    if (prn) usedPrns[usedPrnCount++] = prn;
  }
  if (c > 15) fix.pdop = parseDouble(f[15]);
  if (c > 16) fix.hdop = parseDouble(f[16]);
  if (c > 17) fix.vdop = parseDouble(f[17]);
  refreshUsedFlags();
}

static void parseGSV(char **f, int c) {
  if (c < 4) return;
  fix.satsInView = (uint8_t)parseInt(f[3]);
  for (int i = 4; i + 3 < c; i += 4) {
    uint8_t prn = (uint8_t)parseInt(f[i]);
    SatInfo *sat = satByPrn(prn);
    if (!sat) continue;
    sat->elevation = (uint8_t)parseInt(f[i + 1]);
    sat->azimuth = (uint16_t)parseInt(f[i + 2]);
    sat->snr = (uint8_t)parseInt(f[i + 3]);
    sat->used = prnIsUsed(prn);
    sat->lastSeenMs = millis();
  }
}

static void parseVTG(char **f, int c) {
  if (c > 1) fix.courseDeg = parseDouble(f[1]);
  if (c > 5) fix.speedKnots = parseDouble(f[5]);
  if (c > 7) fix.speedKph = parseDouble(f[7]);
}

static void printEscaped(const char *s) {
  Serial.print('"');
  for (const char *p = s; p && *p; ++p) {
    if (*p == '"' || *p == '\\') Serial.print('\\');
    if (*p >= 32) Serial.print(*p);
  }
  Serial.print('"');
}

static void emitRaw(const char *sentence) {
  Serial.print("{\"type\":\"raw\",\"nmea\":");
  printEscaped(sentence);
  Serial.println("}");
}

static void parseNmea(char *sentence) {
  fix.totalSentences++;
  fix.lastSentenceMs = millis();

  if (echoRaw) emitRaw(sentence);

  if (!validChecksum(sentence)) {
    fix.badChecksums++;
    return;
  }
  fix.validSentences++;

  char line[128];
  safeCopy(line, sentence, sizeof(line));
  char *fields[36];
  int count = 0;
  splitFields(line, fields, count, 36);
  if (count == 0) return;

  if (sentenceTypeEndsWith(fields[0], "GGA")) parseGGA(fields, count);
  else if (sentenceTypeEndsWith(fields[0], "RMC")) parseRMC(fields, count);
  else if (sentenceTypeEndsWith(fields[0], "GSA")) parseGSA(fields, count);
  else if (sentenceTypeEndsWith(fields[0], "GSV")) parseGSV(fields, count);
  else if (sentenceTypeEndsWith(fields[0], "VTG")) parseVTG(fields, count);
}

static uint8_t countFreshSatellites(uint32_t now) {
  uint8_t count = 0;
  for (auto &sat : sats) if (sat.prn && now - sat.lastSeenMs <= SAT_EXPIRY_MS) count++;
  return count;
}

static void emitStatus() {
  uint32_t now = millis();
  Serial.print("{\"type\":\"gps\",\"version\":\"1.0.0\",\"ms\":"); Serial.print(now);
  Serial.print(",\"pins\":{\"gpsTxToPicoRx\":\"GP5/pin7\",\"gpsRxFromPicoTx\":\"GP4/pin6\"}");
  Serial.print(",\"fix\":{");
  Serial.print("\"hasFix\":"); Serial.print(fix.hasFix ? "true" : "false");
  Serial.print(",\"quality\":"); Serial.print(fix.fixQuality);
  Serial.print(",\"mode\":"); Serial.print(fix.fixMode);
  Serial.print(",\"lat\":"); Serial.print(fix.latitude, 7);
  Serial.print(",\"lon\":"); Serial.print(fix.longitude, 7);
  Serial.print(",\"altM\":"); Serial.print(fix.altitudeMeters, 2);
  Serial.print(",\"geoidSepM\":"); Serial.print(fix.geoidSeparationMeters, 2);
  Serial.print(",\"speedKnots\":"); Serial.print(fix.speedKnots, 2);
  Serial.print(",\"speedKph\":"); Serial.print(fix.speedKph, 2);
  Serial.print(",\"courseDeg\":"); Serial.print(fix.courseDeg, 2);
  Serial.print(",\"satsUsed\":"); Serial.print(fix.satsUsed);
  Serial.print(",\"satsInView\":"); Serial.print(fix.satsInView);
  Serial.print(",\"hdop\":"); Serial.print(fix.hdop, 2);
  Serial.print(",\"pdop\":"); Serial.print(fix.pdop, 2);
  Serial.print(",\"vdop\":"); Serial.print(fix.vdop, 2);
  Serial.print(",\"utcTime\":"); printEscaped(fix.utcTime);
  Serial.print(",\"utcDate\":"); printEscaped(fix.utcDate);
  Serial.print("},\"stats\":{");
  Serial.print("\"totalSentences\":"); Serial.print(fix.totalSentences);
  Serial.print(",\"validSentences\":"); Serial.print(fix.validSentences);
  Serial.print(",\"badChecksums\":"); Serial.print(fix.badChecksums);
  Serial.print(",\"overflowedSentences\":"); Serial.print(fix.overflowedSentences);
  Serial.print(",\"lastSentenceAgeMs\":"); Serial.print(fix.lastSentenceMs ? now - fix.lastSentenceMs : 0);
  Serial.print(",\"freshSatellites\":"); Serial.print(countFreshSatellites(now));
  Serial.print(",\"rawBytesTotal\":"); Serial.print(rawBytesTotal);
  Serial.print(",\"selfTestTxTotal\":"); Serial.print(selfTestTxTotal);
  Serial.print("},\"satellites\":[");

  bool first = true;
  for (auto &sat : sats) {
    if (!sat.prn || now - sat.lastSeenMs > SAT_EXPIRY_MS) continue;
    if (!first) Serial.print(',');
    first = false;
    Serial.print("{\"prn\":"); Serial.print(sat.prn);
    Serial.print(",\"elevation\":"); Serial.print(sat.elevation);
    Serial.print(",\"azimuth\":"); Serial.print(sat.azimuth);
    Serial.print(",\"snr\":"); Serial.print(sat.snr);
    Serial.print(",\"used\":"); Serial.print(sat.used ? "true" : "false");
    Serial.print('}');
  }
  Serial.println("]}");
}

static void printInfo(const char *message) {
  Serial.print("{\"type\":\"info\",\"message\":");
  printEscaped(message);
  Serial.println("}");
}

static void handleUsbCommands() {
  static String cmd;
  while (Serial.available()) {
    char ch = (char)Serial.read();
    if (ch == '\r') continue;
    if (ch == '\n') {
      cmd.trim();
      cmd.toUpperCase();
      if (cmd == "RAW ON") {
        echoRaw = true;
        printInfo("raw NMEA echo enabled");
      } else if (cmd == "RAW OFF") {
        echoRaw = false;
        printInfo("raw NMEA echo disabled");
      } else if (cmd == "STATUS") {
        emitStatus();
      } else if (cmd == "HEX ON") {
        echoHex = true;
        hexBufCount = 0;
        printInfo("hex byte dump enabled");
      } else if (cmd == "HEX OFF") {
        echoHex = false;
        hexBufCount = 0;
        printInfo("hex byte dump disabled");
      } else if (cmd == "LOOP ON") {
        loopbackTest = true;
        printInfo("loopback self-test enabled (jumper GP4->GP5)");
      } else if (cmd == "LOOP OFF") {
        loopbackTest = false;
        printInfo("loopback self-test disabled");
      } else if (cmd == "HELP") {
        printInfo("commands: STATUS, RAW ON/OFF, HEX ON/OFF, LOOP ON/OFF, HELP");
      } else if (cmd.length()) {
        printInfo("unknown command; try HELP");
      }
      cmd = "";
    } else if (cmd.length() < 64) {
      cmd += ch;
    }
  }
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(USB_BAUD);
  delay(300);

  Serial2.setTX(GPS_TX_PIN);
  Serial2.setRX(GPS_RX_PIN);
  Serial2.begin(GPS_BAUD);

  printInfo("Pico GPS USB V1 ready: GPS TX -> GP5/pin7, GPS RX -> GP4/pin6, USB serial 115200");
}

void loop() {
  handleUsbCommands();

  while (Serial2.available()) {
    char ch = (char)Serial2.read();
    rawBytesTotal++;
    if (echoHex && hexBufCount < 64) {
      static const char hexChars[] = "0123456789ABCDEF";
      if (hexBufCount > 0) hexBuf[hexBufCount * 3 - 1] = ' ';
      hexBuf[hexBufCount * 3]     = hexChars[(uint8_t)ch >> 4];
      hexBuf[hexBufCount * 3 + 1] = hexChars[(uint8_t)ch & 0x0F];
      hexBuf[hexBufCount * 3 + 2] = '\0';
      hexBufCount++;
    }
    if (ch == '\r') continue;
    if (ch == '\n') {
      if (nmeaLen > 0) {
        nmeaBuf[nmeaLen] = '\0';
        parseNmea(nmeaBuf);
        nmeaLen = 0;
      }
    } else {
      if (nmeaLen < sizeof(nmeaBuf) - 1) {
        nmeaBuf[nmeaLen++] = ch;
      } else {
        nmeaLen = 0;
        fix.overflowedSentences++;
      }
    }
  }

  uint32_t now = millis();
  if (now - lastStatusMs >= STATUS_INTERVAL_MS) {
    lastStatusMs = now;
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
    // Loopback self-test: transmit a known pattern on GP4 (UART1 TX).
    // With a jumper from GP4(pin6) to GP5(pin7), these bytes loop back into
    // RX, bumping rawBytesTotal and (with RAW ON) echoing as a raw frame.
    // Enable with: LOOP ON
    if (loopbackTest) {
      Serial2.print("$PLOOP,TEST*00\r\n");
      selfTestTxTotal += 16;
    }
    emitStatus();
    if (echoHex && hexBufCount > 0) {
      Serial.print("{\"type\":\"hex\",\"bytes\":");
      Serial.print(hexBufCount);
      Serial.print(",\"data\":\"");
      Serial.print(hexBuf);
      Serial.println("\"}");
      hexBufCount = 0;
      hexBuf[0] = '\0';
    }
  }
}
