# Flashing Firmware

Two methods are available. Method 1 (UF2 drag-and-drop) works on every platform with no driver installation.

## Prerequisites

Build the firmware first:

```bash
pio run -e pico
```

The output file is `.pio/build/pico/firmware.uf2`.

---

## Method 1 — UF2 Drag-and-Drop (Recommended)

This method requires no drivers or additional tools.

### 1a — Via BOOTSEL button

1. Disconnect the Pico from USB.
2. Hold the **BOOTSEL** button on the Pico.
3. While holding BOOTSEL, plug the Pico into USB.
4. Release BOOTSEL.
5. The Pico appears as a mass-storage drive named **RPI-RP2** (Windows Explorer, macOS Finder, or a file manager on Linux).
6. Copy `firmware.uf2` onto the RPI-RP2 drive.
7. The drive disappears and the Pico reboots automatically into the new firmware. The built-in LED will begin blinking once per second.

### 1b — Via 1200-Baud Touch Reset

If the Pico is already running firmware (for example, on a subsequent update), most builds support a soft reboot into the bootloader triggered by opening the USB serial port at 1200 baud and then closing it:

1. Close any application using the Pico serial port (browser, serial monitor).
2. Open the Pico port at **1200 baud** using any serial tool (PuTTY, screen, pyserial, etc.) and immediately close it.
3. The Pico reboots into the bootloader and the **RPI-RP2** drive appears.
4. Copy `firmware.uf2` onto the RPI-RP2 drive.
5. The drive disappears and the Pico reboots.

> **Note:** The earlephilhower core supports 1200-baud touch reset when `upload_protocol = picotool` is set in `platformio.ini`, which it is in this project.

---

## Method 2 — PlatformIO / picotool Upload

```bash
pio run -e pico -t upload
```

PlatformIO calls `picotool` to write directly over USB. The Pico must be in bootloader mode (BOOTSEL held, or 1200-baud touch reset triggered) before this command runs, unless `picotool` can trigger the reset itself.

### Windows: WinUSB Driver Requirement

On Windows, `picotool` requires a **WinUSB** driver for the Pico's RP2 Boot interface. The default Windows driver (USBSER) does not work for this.

**Install the driver with Zadig:**

1. Download [Zadig](https://zadig.akeo.ie/) (no installation required).
2. Put the Pico into bootloader mode (BOOTSEL + plug in USB).
3. Open Zadig. If the device is not visible, go to **Options → List All Devices**.
4. Select **RP2 Boot** from the device list.
5. Set the driver to **WinUSB**.
6. Click **Install Driver** (or **Replace Driver**).

After the WinUSB driver is installed, `pio run -e pico -t upload` will work from that machine for all future flashes.

If Zadig is unavailable or you prefer not to modify system drivers, use Method 1 (UF2 drag-and-drop) instead — it requires no drivers at all.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| RPI-RP2 drive does not appear | BOOTSEL not held long enough, or USB cable is charge-only | Hold BOOTSEL before plugging in; use a data-capable USB cable |
| `picotool` fails with "no device found" | Pico not in bootloader mode | Trigger bootloader via BOOTSEL or 1200-baud touch reset before running upload |
| `picotool` fails on Windows with access error | WinUSB driver not installed | Install WinUSB with Zadig as described above |
| Upload starts but port is busy / access denied | Browser or serial monitor has the port open | Close all applications using the Pico serial port before flashing |
| Firmware flashed but Pico does not respond | `.uf2` file is stale or build failed | Run `pio run -e pico` again and confirm it exits with success, then reflash |
