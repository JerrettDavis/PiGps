# Wiring Reference

## GPS Module to Pico Pin Table

| GPS module pin | Pico GPIO / function | Pico physical pin | Direction | Required? |
|---|---|---:|---|---|
| VCC | 3V3 OUT | **36** | Power to GPS | Yes |
| GND | GND | 8 (or 13, 18, 23, 28, 38) | Common ground | Yes |
| TX | GP5 / UART1 RX | 7 | GPS → Pico | Yes |
| RX | GP4 / UART1 TX | 6 | Pico → GPS | Optional |
| PPS | Not connected | — | GPS pulse output | No |

Cross the TX/RX lines: GPS **TX** goes to Pico **RX** (GP5), and GPS **RX** goes to Pico **TX** (GP4).

## Power Warning — Pin 36, Not Pin 37

> **WARNING**
>
> Connect GPS VCC to physical pin **36** (labeled **3V3 OUT**).  
> Do **not** use physical pin **37** (labeled **3V3\_EN**).
>
> - **Pin 36 (3V3 OUT)** is the 3.3 V power rail driven by the Pico's on-board regulator. This is the correct supply for the GPS module.
> - **Pin 37 (3V3\_EN)** is an active-high *enable input* to that same regulator. It is not a power supply. Connecting GPS VCC to pin 37 supplies no power; the GPS module will appear completely dead.
>
> This is the most common bring-up failure.

## Locating Pin 36 on the Pico

The Raspberry Pi Pico has 40 physical pins in two columns of 20. With the USB connector at the top:

- Pins 1–20 run down the **left** edge (odd-numbered physical pins per the standard schematic numbering)
- Pins 21–40 run down the **right** edge

Pin 36 is the **fifth pin from the bottom** on the right edge (right column, counting up from pin 40 at the bottom). Recount carefully — it is two pins above the bottom-right corner pin (pin 40, VBUS).

A safe check: the Pico silkscreen prints "3V3(OUT)" next to pin 36. Confirm the label before wiring.

## Serial Interface

| Parameter | Value |
|---|---|
| UART | UART1 (Serial2 in Arduino-Pico) |
| GPS TX pin (Pico RX) | GP5 / physical pin 7 |
| GPS TX pin (Pico TX) | GP4 / physical pin 6 |
| GPS baud rate | 9600 |
| USB serial baud rate | 115200 |

Most NEO-6M modules default to 9600 baud 8N1 from the factory. If you have reconfigured the baud rate with u-center, match it to `GPS_BAUD` in `firmware/src/main.cpp`.

## Voltage Levels

Pico GPIO is 3.3 V only. The NEO-6M TX output is 3.3 V TTL, which is directly compatible. Most GY-GPS6MV2 breakout boards include an LDO regulator and accept 3.3 V–5 V on VCC; powering from pin 36 (3.3 V) is safe for all standard NEO-6M breakout boards.

Do not connect GPS signals to 5 V GPIO — the Pico is not 5 V tolerant.
