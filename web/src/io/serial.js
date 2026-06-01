/**
 * serial.js — Web Serial wrapper for PiGps.
 * Manages port lifecycle, read loop, and race-safe teardown.
 */

import { splitFrames } from '../core/frames.js';

export class SerialLink {
  constructor({ baudRate = 115200 } = {}) {
    this._baudRate = baudRate;
    this._port = null;
    this._reader = null;
    this._pipePromise = null;
    this._keepReading = false;
    this._writeChain = Promise.resolve();
  }

  /** @returns {boolean} */
  isSupported() {
    return 'serial' in navigator;
  }

  /** Open a new port chosen by the user via the browser picker. */
  async requestAndOpen() {
    const port = await navigator.serial.requestPort(); // throws on cancel
    await port.open({ baudRate: this._baudRate });
    this._port = port;
    return port;
  }

  /** Open a previously-granted port (for auto-reconnect). */
  async openExisting(port) {
    await port.open({ baudRate: this._baudRate });
    this._port = port;
    return port;
  }

  /**
   * Start the read loop.
   * @param {(line: string) => void} onLine   called for each complete line
   * @param {() => void}            onEnd    called when stream ends cleanly
   * @param {(err: Error) => void}  onError  called on read error
   */
  startReadLoop(onLine, onEnd, onError) {
    this._keepReading = true;
    const decoder = new TextDecoderStream();
    // Capture the pipeTo promise so teardown can await it.
    this._pipePromise = this._port.readable.pipeTo(decoder.writable).catch(() => {});
    const readable = decoder.readable;
    this._reader = readable.getReader();

    let buffer = '';

    const loop = async () => {
      try {
        while (this._keepReading) {
          const { value, done } = await this._reader.read();
          if (done) break;
          buffer += value;
          const { lines, rest } = splitFrames(buffer);
          buffer = rest;
          for (const line of lines) {
            onLine(line);
          }
        }
        // A deliberate close() sets _keepReading=false before cancelling the
        // reader (which makes read() return {done:true}); in that case do NOT
        // fire onEnd, or it would trigger a spurious auto-reconnect.
        if (this._keepReading) onEnd();
      } catch (err) {
        if (this._keepReading) {
          onError(err);
        }
        // If _keepReading was set to false by close(), this is expected — ignore.
      }
    };

    loop();
  }

  /**
   * Write a text command (newline appended) to the device.
   * @param {string} text
   */
  async write(text) {
    // Serialize writes through a promise chain so a second getWriter() never
    // runs before the first releaseLock() ("WritableStream is locked").
    const run = async () => {
      if (!this._port || !this._port.writable) return;
      const writer = this._port.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(text + '\n'));
      } finally {
        writer.releaseLock();
      }
    };
    // Append to the chain; swallow chain errors so one failure doesn't break the next.
    this._writeChain = this._writeChain.then(run, run);
    return this._writeChain;
  }

  /**
   * Race-safe teardown: stop loop, cancel reader, await pipe, close port.
   */
  async close() {
    this._keepReading = false;

    try {
      if (this._reader) await this._reader.cancel();
    } catch {
      // Already cancelled or released — ignore.
    }

    if (this._pipePromise) {
      await this._pipePromise;
      this._pipePromise = null;
    }

    try {
      if (this._reader) this._reader.releaseLock();
    } catch {
      // Already released — ignore.
    }
    this._reader = null;

    try {
      if (this._port) await this._port.close();
    } catch {
      // Already closed — ignore.
    }
    this._port = null;
  }

  get port() {
    return this._port;
  }
}
