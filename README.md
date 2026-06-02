# PiGps

RP2040 (Raspberry Pi Pico) + NEO-6M GPS receiver that streams JSON over USB-CDC, with a browser web app showing a live map, position trail, polar skymap, satellite table, fix/DOP panel, and GPX/CSV recording.

![CI](https://github.com/JerrettDavis/PiGps/actions/workflows/ci.yml/badge.svg)
![Pages](https://github.com/JerrettDavis/PiGps/actions/workflows/deploy-pages.yml/badge.svg)

## Features

- Live Leaflet map with a scrolling position trail
- Auto-reconnect with exponential backoff — cable-pull recovery is automatic
- GPX and CSV recording and one-click download
- Polar skymap showing satellite elevations and azimuths
- Satellite table with PRN, elevation, azimuth, SNR, and used-in-fix indicator
- Fix-quality and DOP panel (HDOP, PDOP, VDOP)
- Resilient connection state machine (DISCONNECTED → CONNECTING → STREAMING → STALE → RECONNECTING)
- USB command interface: STATUS, RAW ON/OFF, HEX ON/OFF, LOOP ON/OFF, HELP

## Hardware

### Parts

| Part | Notes |
|---|---|
| Raspberry Pi Pico v1 (RP2040) | Pico W also works |
| GY-GPS6MV2 / NEO-6M GPS module | Any NEO-6M breakout with 3.3 V TTL output |
| 4 male-to-female jumper wires | |

### Wiring

| GPS module pin | Pico GPIO | Pico physical pin | Direction |
|---|---|---:|---|
| VCC | 3V3 OUT | **36** | Power to GPS |
| GND | GND | 8 (or any GND) | Common ground |
| TX | GP5 / UART1 RX | 7 | GPS → Pico |
| RX | GP4 / UART1 TX | 6 | Pico → GPS |

> **WARNING — Pin 36, not pin 37.**
>
> Power the GPS from physical pin 36 (3V3 OUT). Do **not** use pin 37 (3V3\_EN).
> Pin 37 is an enable *input* to the on-board regulator, not a power supply — wiring VCC there gives the GPS module no power and the module will appear completely dead. This is the number-one bring-up failure. Count pins carefully: USB connector at the top, pin 1 is top-left, pin 36 is bottom-right (second from the end on the right rail).

GPS TX connects to Pico RX (GP5), and GPS RX connects to Pico TX (GP4). Cross the TX/RX lines.

See [`docs/WIRING.md`](docs/WIRING.md) for a detailed wiring reference and [`docs/PINOUT.md`](docs/PINOUT.md) for the full GPIO table.

## Build Firmware

This project uses [PlatformIO](https://platformio.org/) with the earlephilhower Arduino-Pico core.

Run from the repository root:

```bash
pio run -e pico
```

`platformio.ini` sets `src_dir = firmware/src`, so the source is at `firmware/src/main.cpp`. The build output is:

```text
.pio/build/pico/firmware.uf2
```

## Flash Firmware

Two methods are available. See [`docs/FLASHING.md`](docs/FLASHING.md) for the full guide.

### Method 1 — UF2 drag-and-drop (recommended)

1. Hold **BOOTSEL** while plugging the Pico into USB, then release.  
   The Pico appears as a mass-storage drive called **RPI-RP2**.
2. Copy `firmware.uf2` onto the drive.  
   The drive disappears and the Pico reboots automatically.

Alternatively, if the Pico is already running firmware, most boards support a **1200-baud touch reset**: open the port at 1200 baud and close it. The Pico reboots into the bootloader and the RPI-RP2 drive appears. Then copy the `.uf2` as above.

### Method 2 — PlatformIO upload

```bash
pio run -e pico -t upload
```

This uses `picotool`. On Windows, `picotool` requires a **WinUSB driver** for the Pico's bootloader interface. Install it with [Zadig](https://zadig.akeo.ie/): select the "RP2 Boot" device and install the WinUSB driver. If Zadig is unavailable or the driver is wrong, use the UF2 drag-and-drop method instead.

## Run the Web App

```bash
cd web
npm install
npm run dev
```

Open the URL printed in the terminal (default `http://localhost:5173`). Click **Connect**, choose the Pico serial port, and wait for frames.

**Production build:**

```bash
npm run build
npm run preview
```

### Browser and Secure-Context Requirements

Web Serial is available in Chromium-based browsers only (Chrome, Edge). It is **not** available in Firefox or Safari.

The page must be served from `localhost` or an `https://` origin. Opening `index.html` directly as a `file://` page will not work — Web Serial is blocked in that context.

### DTR Note

The earlephilhower USB-CDC implementation only transmits data once the host asserts DTR (Data Terminal Ready). The web app asserts DTR automatically when it opens the port. If you connect with a raw serial tool (PuTTY, screen, minicom) and see nothing, set **DtrEnable = true** (or the equivalent option for your tool). Without DTR the Pico's USB transmit buffer fills and no frames are delivered.

## Recording

| Action | How |
|---|---|
| Start recording | Click **Record** |
| Download GPX | Click **Download GPX** |
| Download CSV | Click **Download CSV** |
| Clear track | Click **Clear** |

GPX files include trackpoints with timestamp, latitude, longitude, and elevation. CSV files include all fix fields per frame.

## USB Commands

Send these over USB serial at 115200 baud, or use the buttons in the web app:

| Command | Effect |
|---|---|
| `STATUS` | Emit one status frame immediately |
| `RAW ON` | Include raw NMEA sentences in JSON output |
| `RAW OFF` | Stop raw NMEA echo |
| `HEX ON` | Emit hex byte dump of GPS UART traffic (diagnostic) |
| `HEX OFF` | Stop hex dump |
| `LOOP ON` | Enable diagnostic GP4→GP5 loopback self-test (default off) |
| `LOOP OFF` | Disable loopback self-test |
| `HELP` | Print command list |

`LOOP ON` is a hardware self-test mode. It requires a jumper wire from GP4 (pin 6) to GP5 (pin 7). Firmware sends a known pattern and the bytes should loop back through the receive path, incrementing `rawBytesTotal` and appearing in `selfTestTxTotal`.

## JSON Schema

Firmware emits one `gps` frame per second. Example:

```json
{
  "type": "gps",
  "version": "1.0.0",
  "ms": 123456,
  "pins": {
    "gpsTxToPicoRx": "GP5/pin7",
    "gpsRxFromPicoTx": "GP4/pin6"
  },
  "fix": {
    "hasFix": true,
    "quality": 1,
    "mode": 3,
    "lat": 36.1234567,
    "lon": -95.1234567,
    "altM": 220.5,
    "geoidSepM": -29.1,
    "speedKnots": 0.0,
    "speedKph": 0.0,
    "courseDeg": 0.0,
    "satsUsed": 8,
    "satsInView": 12,
    "hdop": 0.9,
    "pdop": 1.6,
    "vdop": 1.2,
    "utcTime": "123456.00",
    "utcDate": "310526"
  },
  "stats": {
    "totalSentences": 400,
    "validSentences": 398,
    "badChecksums": 2,
    "overflowedSentences": 0,
    "lastSentenceAgeMs": 45,
    "freshSatellites": 12,
    "rawBytesTotal": 18340,
    "selfTestTxTotal": 0
  },
  "satellites": [
    { "prn": 12, "elevation": 41, "azimuth": 105, "snr": 38, "used": true }
  ]
}
```

See [`docs/JSON_SCHEMA.md`](docs/JSON_SCHEMA.md) for the complete field reference and all frame types.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No frames in the browser | Wrong browser or opened as `file://` | Use Chrome or Edge; serve from `localhost` or `https://` |
| Frames in browser but nothing in a raw serial tool | DTR not asserted | Set DtrEnable=true (or equivalent) in your serial tool |
| GPS module appears dead / no LED, no data | VCC wired to pin 37 (3V3\_EN) instead of pin 36 (3V3 OUT) | Move VCC wire to physical pin 36 |
| `totalSentences` stays 0 after connecting | GPS TX not reaching GP5, or wrong baud rate | Confirm GPS TX → GP5 (pin 7); GPS default baud is 9600 |
| `picotool` upload fails on Windows | Missing WinUSB driver for RP2 Boot interface | Install WinUSB with Zadig, or use UF2 drag-and-drop |
| Satellites visible but no fix | Cold start or poor sky view | Move near a window or outdoors; allow several minutes |
| Connection drops on cable replug | Normal USB disconnect | Auto-reconnect with backoff recovers automatically |

## License

MIT — see [LICENSE](LICENSE).
