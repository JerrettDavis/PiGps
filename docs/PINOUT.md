# Pi Pico v1 + GY-GPS6MV2 pinout

This v1 firmware expects the GPS on **UART1** using these Pico physical pins:

| GPS module pin | Pico GPIO/function | Pico physical pin | Direction | Required? |
|---|---:|---:|---|---|
| VCC | **3V3 OUT** | **36** | Power to GPS | Yes |
| GND | GND | 8, 13, 18, 23, 28, or 38 | Common ground | Yes |
| TX | GP5 / UART1 RX | 7 | GPS → Pico | Yes |
| RX | GP4 / UART1 TX | 6 | Pico → GPS | Optional in phase 1 |
| PPS | Not connected | - | GPS pulse output | No |

> **WARNING — Pin 36 (3V3 OUT), NOT pin 37 (3V3\_EN)**
>
> Connect GPS VCC to physical pin **36** (3V3 OUT). **Do not use pin 37 (3V3\_EN).**
> Pin 37 is an enable *input* to the on-board regulator — it is not a power supply.
> Wiring VCC to pin 37 delivers no power; the GPS module will appear completely dead.
> This is the number-one bring-up failure. Confirm the silkscreen label "3V3(OUT)" before wiring.

## Important notes

- Cross TX/RX:
  - **GPS TX goes to Pico GP5 / physical pin 7**.
  - **GPS RX goes to Pico GP4 / physical pin 6**.
- The Pico labels GP4/GP5 with SPI alternates too. Ignore the SPI labels for this project. These same pins can also be used by UART1.
- Pico GPIO is **3.3 V only**. NEO-6M module TX is normally 3.3 V TTL, which is safe for the Pico.
- All standard GY-GPS6MV2 breakout boards accept 3.3 V on VCC (they include an LDO regulator). Physical pin 36 (3V3 OUT) is the recommended and primary supply.
- First fix can take several minutes, especially indoors. Start near a window or outside.

## Data path

```text
GPS NMEA @ 9600 baud
    ↓
Pico UART1 on GP5 RX / GP4 TX
    ↓
Firmware parses GGA, RMC, GSA, GSV, VTG
    ↓
USB serial JSON @ 115200 baud
    ↓
Browser companion app via Web Serial
```
