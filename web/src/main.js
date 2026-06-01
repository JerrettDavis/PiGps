/**
 * main.js — PiGps app bootstrap.
 * Wires SerialLink, Recorder, TrackMap, FSM, and all UI renderers.
 */

import { SerialLink }   from './io/serial.js';
import { Recorder }     from './io/recorder.js';
import { TrackMap }     from './ui/map.js';
import { render as renderSky } from './ui/skyview.js';
import { renderSatTable }      from './ui/sat-table.js';
import { updatePanels }        from './ui/panels.js';
import { getRefs, setDisabled, setText } from './ui/dom.js';
import {
  updatePill, showToast, hideToast,
  showUnsupportedNotice, showStaleWarning,
} from './ui/statusbar.js';
import {
  parseFrame, isGpsFrame, normalizeFix, normalizeSats, hasValidPosition,
} from './core/frames.js';
import {
  States, initialState, reduce, backoffMs,
} from './core/connection-fsm.js';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const serial   = new SerialLink({ baudRate: 115200 });
const recorder = new Recorder();

let fsm        = initialState(loadAutoReconnect());
let trackMap   = null;
let lastFrameMs = null;
let staleTimer  = null;
let reconnectTimer = null;
let recordStartMs  = null;
let logLines       = [];
let _reconnecting  = false;

// ---------------------------------------------------------------------------
// DOM refs (available after DOMContentLoaded, but <script type="module"> defers)
// ---------------------------------------------------------------------------

const refs = getRefs();

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

function loadAutoReconnect() {
  try { return localStorage.getItem('pigps-auto-reconnect') !== 'false'; } catch { return true; }
}

function saveAutoReconnect(val) {
  try { localStorage.setItem('pigps-auto-reconnect', String(val)); } catch {}
}

// ---------------------------------------------------------------------------
// FSM dispatch
// ---------------------------------------------------------------------------

function dispatch(event) {
  const prev = fsm.status;
  fsm = reduce(fsm, event);
  if (fsm.status !== prev) onStatusChange(prev, fsm.status);
}

function onStatusChange(prev, next) {
  updatePill(next);
  updateButtons();

  if (next === States.DISCONNECTED || next === States.ERROR) {
    cancelStaleTimer();
    cancelReconnectTimer();
  }

  if (next === States.RECONNECTING) {
    // Stop the stale-detection interval during backoff so it doesn't keep
    // firing STALE_TICK / flooding the warning. It restarts on PORT_OPENED.
    cancelStaleTimer();
    scheduleReconnect();
  }

  if (next === States.STREAMING) {
    hideToast();
  }

  if (next === States.ERROR && fsm.lastError) {
    showToast(`Connection error: ${fsm.lastError}`, 'error');
  }

  if (next === States.DISCONNECTED && prev !== States.DISCONNECTED) {
    hideToast();
  }
}

// ---------------------------------------------------------------------------
// Button enable/disable logic
// ---------------------------------------------------------------------------

function updateButtons() {
  const connected = fsm.status === States.CONNECTED
    || fsm.status === States.STREAMING
    || fsm.status === States.STALE;

  setDisabled('connectBtn',     connected || fsm.status === States.CONNECTING || fsm.status === States.RECONNECTING);
  setDisabled('disconnectBtn',  !connected && fsm.status !== States.CONNECTING && fsm.status !== States.RECONNECTING);
  setDisabled('rawOnBtn',       !connected);
  setDisabled('rawOffBtn',      !connected);
  setDisabled('statusBtn',      !connected);
  setDisabled('recordBtn',      !connected);
  setDisabled('downloadGpxBtn', recorder.count === 0);
  setDisabled('downloadCsvBtn', recorder.count === 0);
  setDisabled('clearTrackBtn',  recorder.count === 0);
}

// ---------------------------------------------------------------------------
// Log helper
// ---------------------------------------------------------------------------

function log(line) {
  logLines.push(line);
  if (logLines.length > 140) logLines.shift();
  if (refs.log) {
    refs.log.textContent = logLines.join('\n');
    refs.log.scrollTop   = refs.log.scrollHeight;
  }
}

// ---------------------------------------------------------------------------
// Connect / Disconnect
// ---------------------------------------------------------------------------

async function connect() {
  if (!serial.isSupported() || !window.isSecureContext) {
    showUnsupportedNotice();
    return;
  }

  dispatch({ type: 'CONNECT_REQUEST' });
  try {
    await serial.requestAndOpen();
  } catch (err) {
    // User cancelled the picker or open failed.
    dispatch({ type: 'DISCONNECT_REQUEST' });
    if (err.name !== 'NotFoundError') {
      showToast(`Connect failed: ${err.message}`, 'error');
    }
    return;
  }

  onPortOpened(true /* clearTrail */);
}

function onPortOpened(clearTrail) {
  dispatch({ type: 'PORT_OPENED' });
  log('Connected. Waiting for JSON frames…');
  lastFrameMs = null;

  if (clearTrail && trackMap) trackMap.clearTrail();

  startStaleTimer();

  serial.startReadLoop(
    onLine,
    onStreamEnd,
    onStreamError,
  );
}

async function disconnect() {
  dispatch({ type: 'DISCONNECT_REQUEST' });
  cancelStaleTimer();
  cancelReconnectTimer();
  try {
    await serial.close();
  } catch {
    // Ignore — already closed.
  }
  log('Disconnected.');
  hideToast();
}

// ---------------------------------------------------------------------------
// Frame handling
// ---------------------------------------------------------------------------

function onLine(line) {
  log(line);
  const frame = parseFrame(line);
  const nowMs = Date.now();

  if (frame.type === 'unparseable') {
    log(`[unparseable] ${frame.error}`);
    return;
  }

  if (isGpsFrame(frame)) {
    dispatch({ type: 'FRAME', atMs: nowMs });
    lastFrameMs = nowMs;

    const fix  = normalizeFix(frame);
    const sats = normalizeSats(frame);

    updatePanels(fix, frame);

    if (refs.sky) renderSky(refs.sky, sats);
    if (refs.satRows) renderSatTable(refs.satRows, sats);

    if (hasValidPosition(fix)) {
      const follow = true; // always follow for now
      if (trackMap) {
        trackMap.setPosition(fix.lat, fix.lon, follow);
        trackMap.appendTrail(fix.lat, fix.lon);
      }
      const pt = recorder.append(fix, nowMs);
      if (pt !== null) {
        updateRecordReadout();
        updateButtons(); // re-enable download buttons when first point recorded
      }
    }

    return;
  }

  // raw / info / hex → just logged above; annotate type for clarity
  if (frame.type === 'info' || frame.type === 'raw' || frame.type === 'hex') {
    // Already logged raw; dispatch FRAME so FSM knows data is flowing
    dispatch({ type: 'FRAME', atMs: nowMs });
    lastFrameMs = nowMs;
  }
}

// ---------------------------------------------------------------------------
// Stream end / error → auto-reconnect
// ---------------------------------------------------------------------------

function onStreamEnd() {
  log('Stream ended.');
  dispatch({ type: 'STREAM_ENDED' });
  // FSM moves to RECONNECTING (if auto) or DISCONNECTED
}

function onStreamError(err) {
  log(`Stream error: ${err.message || err}`);
  dispatch({ type: 'ERROR', error: String(err.message || err) });
}

// ---------------------------------------------------------------------------
// Auto-reconnect
// ---------------------------------------------------------------------------

function scheduleReconnect() {
  cancelReconnectTimer();
  const delay = backoffMs(fsm.attempt);
  log(`Reconnecting in ${delay}ms (attempt ${fsm.attempt})…`);
  reconnectTimer = setTimeout(tryReconnect, delay);
}

async function tryReconnect() {
  reconnectTimer = null;
  // In-flight guard: the backoff timer and the 'connect' listener can both
  // call this. Prevent a second openExisting() on an already-open port.
  if (_reconnecting) return;
  if (fsm.status !== States.RECONNECTING) return;

  _reconnecting = true;
  dispatch({ type: 'RECONNECT_TICK' });

  try {
    const ports = await navigator.serial.getPorts();
    const port  = ports[0];
    if (!port) throw new Error('No previously-granted port found.');
    await serial.openExisting(port);
    onPortOpened(false /* don't clear trail on reconnect */);
  } catch (err) {
    log(`Reconnect failed: ${err.message}`);
    dispatch({ type: 'ERROR', error: String(err.message) });
  } finally {
    _reconnecting = false;
  }
}

function cancelReconnectTimer() {
  if (reconnectTimer != null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}

// ---------------------------------------------------------------------------
// Stale detection
// ---------------------------------------------------------------------------

function startStaleTimer() {
  cancelStaleTimer();
  staleTimer = setInterval(() => {
    if (lastFrameMs == null) return;
    const elapsed = Date.now() - lastFrameMs;
    if (elapsed >= 3000) {
      dispatch({ type: 'STALE_TICK' });
      showStaleWarning(elapsed);
    }
  }, 250);
}

function cancelStaleTimer() {
  if (staleTimer != null) { clearInterval(staleTimer); staleTimer = null; }
}

// ---------------------------------------------------------------------------
// Recording readout
// ---------------------------------------------------------------------------

function updateRecordReadout() {
  const count  = recorder.count;
  const distKm = (recorder.distanceMeters / 1000).toFixed(2);
  setText('recordCount', String(count));
  setText('recordDist',  `${distKm} km`);

  if (recorder.recording && recordStartMs != null) {
    const durS = Math.round((Date.now() - recordStartMs) / 1000);
    const mm   = Math.floor(durS / 60).toString().padStart(2, '0');
    const ss   = (durS % 60).toString().padStart(2, '0');
    setText('recordDur', `${mm}:${ss}`);
  } else {
    setText('recordDur', '-');
  }
}

// ---------------------------------------------------------------------------
// Timestamped filename helper
// ---------------------------------------------------------------------------

function timestampFilename(ext) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const y   = now.getUTCFullYear();
  const mo  = pad(now.getUTCMonth() + 1);
  const d   = pad(now.getUTCDate());
  const h   = pad(now.getUTCHours());
  const mi  = pad(now.getUTCMinutes());
  const s   = pad(now.getUTCSeconds());
  return `pigps-${y}${mo}${d}-${h}${mi}${s}.${ext}`;
}

// ---------------------------------------------------------------------------
// Button event wiring
// ---------------------------------------------------------------------------

refs.connectBtn?.addEventListener('click', () => connect());

refs.disconnectBtn?.addEventListener('click', () => disconnect());

refs.recordBtn?.addEventListener('click', () => {
  if (recorder.recording) {
    recorder.stop();
    refs.recordBtn.textContent = 'Record';
    refs.recordBtn.classList.remove('btn-recording');
    setText('recordDur', '-');
  } else {
    recorder.start();
    recordStartMs = Date.now();
    refs.recordBtn.textContent = 'Stop';
    refs.recordBtn.classList.add('btn-recording');
  }
  updateRecordReadout();
});

refs.downloadGpxBtn?.addEventListener('click', () => {
  if (recorder.count === 0) return;
  recorder.downloadGpx(timestampFilename('gpx'));
});

refs.downloadCsvBtn?.addEventListener('click', () => {
  if (recorder.count === 0) return;
  recorder.downloadCsv(timestampFilename('csv'));
});

refs.clearTrackBtn?.addEventListener('click', () => {
  recorder.clear();
  if (trackMap) trackMap.clearTrail();
  updateRecordReadout();
  updateButtons();
});

refs.rawOnBtn?.addEventListener('click',  () => serial.write('RAW ON'));
refs.rawOffBtn?.addEventListener('click', () => serial.write('RAW OFF'));
refs.statusBtn?.addEventListener('click', () => serial.write('STATUS'));

refs.autoReconnectCb?.addEventListener('change', () => {
  dispatch({ type: 'TOGGLE_AUTO' });
  saveAutoReconnect(fsm.autoReconnect);
});

refs.toastDismiss?.addEventListener('click', () => hideToast());

// ---------------------------------------------------------------------------
// navigator.serial 'connect' / 'disconnect' events (for auto-reconnect on replug)
// ---------------------------------------------------------------------------

if ('serial' in navigator) {
  navigator.serial.addEventListener('connect', () => {
    if (fsm.status === States.RECONNECTING) {
      cancelReconnectTimer();
      tryReconnect();
    }
  });

  navigator.serial.addEventListener('disconnect', () => {
    if (fsm.status === States.STREAMING || fsm.status === States.CONNECTED || fsm.status === States.STALE) {
      dispatch({ type: 'STREAM_ENDED' });
    }
  });
}

// ---------------------------------------------------------------------------
// Auto-reconnect checkbox: reflect persisted state
// ---------------------------------------------------------------------------

if (refs.autoReconnectCb) {
  refs.autoReconnectCb.checked = fsm.autoReconnect;
}

// ---------------------------------------------------------------------------
// Map init + window resize
// ---------------------------------------------------------------------------

// Initialise map after DOM is ready (it already is — ES module deferred).
trackMap = new TrackMap('map');

window.addEventListener('resize', () => {
  if (trackMap) trackMap.invalidate();
});

// Allow layout to settle before first invalidation.
setTimeout(() => { if (trackMap) trackMap.invalidate(); }, 100);

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

updatePill(fsm.status);
updateButtons();
updateRecordReadout();

// Draw the empty skymap grid on load.
if (refs.sky) renderSky(refs.sky, []);

if (!serial.isSupported() || !window.isSecureContext) {
  showUnsupportedNotice();
}

log('PiGps ready. Click Connect to begin.');
