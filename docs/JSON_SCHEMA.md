# JSON Frame Schema

Firmware emits newline-delimited JSON frames over USB serial at 115200 baud, one `gps` frame per second plus additional frame types controlled by USB commands.

---

## `gps` Frame

The primary frame type, emitted once per second regardless of fix state.

```json
{
  "type": "gps",
  "version": "1.0.0",
  "ms": 123456,
  "pins": {
    "gpsTxToPicoRx": "GP5/pin7",
    "gpsRxFromPicoTx": "GP4/pin6"
  },
  "fix": { ... },
  "stats": { ... },
  "satellites": [ ... ]
}
```

### Top-Level Fields

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"gps"` |
| `version` | string | Firmware version string, e.g. `"1.0.0"` |
| `ms` | number | Milliseconds since boot (`millis()`) |
| `pins` | object | Wiring confirmation (constant) |
| `pins.gpsTxToPicoRx` | string | Always `"GP5/pin7"` |
| `pins.gpsRxFromPicoTx` | string | Always `"GP4/pin6"` |

### `fix` Object

| Field | Type | Description |
|---|---|---|
| `hasFix` | boolean | True when GGA quality > 0 or RMC status is Active |
| `quality` | number | GGA fix quality: 0 = invalid, 1 = GPS fix, 2 = DGPS, 3 = PPS, 4 = RTK fixed, 5 = RTK float, 6 = estimated, 7 = manual, 8 = simulation |
| `mode` | number | GSA fix mode: 1 = no fix, 2 = 2D fix, 3 = 3D fix |
| `lat` | number | Latitude in decimal degrees (positive = North, negative = South); 7 decimal places |
| `lon` | number | Longitude in decimal degrees (positive = East, negative = West); 7 decimal places |
| `altM` | number | Altitude above mean sea level, metres; 2 decimal places |
| `geoidSepM` | number | Geoid separation (WGS84 ellipsoid minus mean sea level), metres; 2 decimal places |
| `speedKnots` | number | Speed over ground, knots; 2 decimal places |
| `speedKph` | number | Speed over ground, kilometres per hour; 2 decimal places |
| `courseDeg` | number | Course over ground, degrees true; 2 decimal places |
| `satsUsed` | number | Number of satellites used in the fix solution (from GGA) |
| `satsInView` | number | Number of satellites currently in view (from GSV) |
| `hdop` | number | Horizontal dilution of precision; 2 decimal places |
| `pdop` | number | Positional (3D) dilution of precision; 2 decimal places |
| `vdop` | number | Vertical dilution of precision; 2 decimal places |
| `utcTime` | string | UTC time from NMEA, format `"hhmmss.ss"` (e.g. `"123456.00"`) |
| `utcDate` | string | UTC date from NMEA RMC, format `"ddmmyy"` (e.g. `"310526"`) |

**Quality value meanings:**

| Value | Meaning |
|---|---|
| 0 | Invalid / no fix |
| 1 | Autonomous GPS fix |
| 2 | DGPS fix |
| 3 | PPS fix |
| 4 | RTK fixed integer |
| 5 | RTK float |
| 6 | Estimated (dead reckoning) |
| 7 | Manual input mode |
| 8 | Simulation mode |

The NEO-6M typically reports 0 (no fix) or 1 (GPS fix) under normal operation.

### `stats` Object

| Field | Type | Description |
|---|---|---|
| `totalSentences` | number | Total NMEA sentences received on UART1 since boot |
| `validSentences` | number | Sentences that passed checksum validation |
| `badChecksums` | number | Sentences that failed checksum validation |
| `overflowedSentences` | number | Sentences dropped because the 128-byte receive buffer was full |
| `lastSentenceAgeMs` | number | Milliseconds since the last NMEA sentence was received (0 if none yet) |
| `freshSatellites` | number | Satellites seen within the last 20 seconds (expiry window) |
| `rawBytesTotal` | number | Total raw bytes received on UART1 since boot |
| `selfTestTxTotal` | number | Total bytes sent during LOOP ON self-test (0 when loopback is off) |

### `satellites` Array

Array of satellite objects. Only satellites seen within the last 20 seconds are included.

| Field | Type | Description |
|---|---|---|
| `prn` | number | Satellite PRN (pseudo-random noise code number) |
| `elevation` | number | Elevation above horizon, degrees (0–90) |
| `azimuth` | number | Azimuth, degrees true (0–359) |
| `snr` | number | Signal-to-noise ratio, dBHz (0 when not tracking) |
| `used` | boolean | True if this satellite's PRN appears in the current GSA used-satellite list |

---

## `raw` Frame

Emitted for every NMEA sentence received when `RAW ON` is active. Contains the sentence before checksum validation.

```json
{ "type": "raw", "nmea": "$GPGGA,123456.00,3607.4038,N,09507.4038,W,1,08,0.9,220.5,M,-29.1,M,,*47" }
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"raw"` |
| `nmea` | string | The raw NMEA sentence string including `$` prefix and `*CS` checksum |

---

## `info` Frame

Emitted by the firmware in response to USB commands or on startup.

```json
{ "type": "info", "message": "Pico GPS USB V1 ready: GPS TX -> GP5/pin7, GPS RX -> GP4/pin6, USB serial 115200" }
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"info"` |
| `message` | string | Human-readable status or acknowledgement string |

---

## `hex` Frame

Emitted once per second when `HEX ON` is active. Contains a hex dump of the raw GPS UART bytes received in that second interval.

```json
{ "type": "hex", "bytes": 3, "data": "24 47 50" }
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"hex"` |
| `bytes` | number | Number of bytes in this frame (max 64 per interval) |
| `data` | string | Space-separated uppercase hex bytes, e.g. `"24 47 50 47 47 41"` |

Useful for confirming raw UART traffic when `totalSentences` stays at 0 (rules out a wiring fault vs. a parsing problem).

---

## NMEA Sentences Parsed

The firmware parses these standard NMEA 0183 sentence types:

| Sentence | Source fields |
|---|---|
| `GGA` | Fix quality, lat/lon, altitude, satellites used, HDOP, geoid separation, UTC time |
| `RMC` | Active/void status, lat/lon, speed, course, UTC date/time |
| `GSA` | Fix mode (2D/3D), satellites used (PRN list), PDOP/HDOP/VDOP |
| `GSV` | Visible satellites: PRN, elevation, azimuth, SNR |
| `VTG` | Course over ground, speed over ground |

Sentences from any talker ID are accepted (e.g. `$GPGGA`, `$GNGGA`, `$GLGGA`). The parser matches by the last three characters of the sentence type field.
