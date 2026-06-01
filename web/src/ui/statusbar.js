/**
 * statusbar.js — Connection pill + toast/banner renderer.
 * Maps FSM states to colored pills and manages error banners.
 */

import { States } from '../core/connection-fsm.js';
import { $, show, hide } from './dom.js';

/** FSM status → { label, pillClass } */
const STATUS_MAP = {
  [States.DISCONNECTED]:  { label: 'Disconnected', pillClass: 'pill-gray' },
  [States.CONNECTING]:    { label: 'Connecting…',  pillClass: 'pill-amber' },
  [States.CONNECTED]:     { label: 'Connected',    pillClass: 'pill-amber' },
  [States.STREAMING]:     { label: 'Streaming',    pillClass: 'pill-green' },
  [States.STALE]:         { label: 'Stale',        pillClass: 'pill-amber' },
  [States.RECONNECTING]:  { label: 'Reconnecting…',pillClass: 'pill-amber' },
  [States.ERROR]:         { label: 'Error',        pillClass: 'pill-red'   },
};

const ALL_PILL_CLASSES = ['pill-gray', 'pill-amber', 'pill-green', 'pill-red'];

/**
 * Update the connection pill to reflect the current FSM status.
 * @param {string} status  one of States.*
 */
export function updatePill(status) {
  const pill = $('connectionPill');
  if (!pill) return;
  const { label, pillClass } = STATUS_MAP[status] ?? STATUS_MAP[States.DISCONNECTED];
  pill.textContent = label;
  for (const cls of ALL_PILL_CLASSES) pill.classList.remove(cls);
  pill.classList.add(pillClass);
}

/**
 * Show a dismissible toast/banner with a message.
 * Call with null/'' to hide.
 * @param {string|null} message
 * @param {'error'|'warn'|'info'} [level='error']
 */
export function showToast(message, level = 'error') {
  const banner = $('toastBanner');
  const msg    = $('toastMsg');
  if (!banner || !msg) return;

  if (!message) {
    hide(banner);
    return;
  }

  // Use textContent — message may contain device error strings (untrusted).
  msg.textContent = message;
  banner.className = `toast toast-${level}`;
  show(banner);
}

/** Hide the toast banner. */
export function hideToast() {
  showToast(null);
}

/**
 * Show the "unsupported browser / insecure context" notice.
 */
export function showUnsupportedNotice() {
  showToast(
    'Web Serial is not available. Use Chrome or Edge over https:// or http://localhost. ' +
    'Opening as file:// is not supported.',
    'warn'
  );
}

/**
 * Show a stale-data warning with elapsed seconds.
 * @param {number} elapsedMs
 */
export function showStaleWarning(elapsedMs) {
  const secs = Math.round(elapsedMs / 1000);
  showToast(
    `No frames for ${secs}s — check GPS power (pin 36!), wiring, or move outside for a fix.`,
    'warn'
  );
}

/** Clear the stale warning (if it was the active toast). */
export function clearStaleWarning() {
  hideToast();
}
