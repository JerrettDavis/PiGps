/**
 * Pure reducer for the serial connection state machine.
 * No timers, no serial calls, no DOM/browser APIs.
 */

export const States = {
  DISCONNECTED:  'disconnected',
  CONNECTING:    'connecting',
  CONNECTED:     'connected',
  STREAMING:     'streaming',
  STALE:         'stale',
  RECONNECTING:  'reconnecting',
  ERROR:         'error',
};

/**
 * @param {boolean} autoReconnect
 * @returns {{ status: string, attempt: number, lastError: null, autoReconnect: boolean, lastFrameMs: null }}
 */
export function initialState(autoReconnect = true) {
  return {
    status: States.DISCONNECTED,
    attempt: 0,
    lastError: null,
    autoReconnect,
    lastFrameMs: null,
  };
}

/**
 * Pure reducer: (state, event) → nextState.
 * Always returns a NEW object.
 * @param {object} state
 * @param {{ type: string, [key: string]: any }} event
 * @returns {object}
 */
export function reduce(state, event) {
  switch (event.type) {
    case 'CONNECT_REQUEST':
      return { ...state, status: States.CONNECTING };

    case 'PORT_OPENED':
      return { ...state, status: States.CONNECTED, lastError: null };

    case 'FRAME':
      return { ...state, status: States.STREAMING, attempt: 0, lastFrameMs: event.atMs };

    case 'STALE_TICK':
      if (state.status === States.STREAMING || state.status === States.CONNECTED) {
        return { ...state, status: States.STALE };
      }
      return { ...state };

    case 'STREAM_ENDED':
      if (state.autoReconnect) {
        return { ...state, status: States.RECONNECTING, attempt: state.attempt + 1 };
      }
      return { ...state, status: States.DISCONNECTED, attempt: 0 };

    case 'ERROR':
      if (state.autoReconnect) {
        return { ...state, status: States.RECONNECTING, attempt: state.attempt + 1, lastError: event.error };
      }
      return { ...state, status: States.ERROR, lastError: event.error };

    case 'RECONNECT_TICK':
      return { ...state, status: States.CONNECTING };

    case 'DISCONNECT_REQUEST':
      return { ...state, status: States.DISCONNECTED, attempt: 0, lastError: null };

    case 'TOGGLE_AUTO':
      return { ...state, autoReconnect: !state.autoReconnect };

    default:
      return { ...state };
  }
}

/**
 * Exponential backoff in ms.
 * @param {number} attempt  — 1-based; <=0 treated as 0
 * @param {number} base     — base delay ms (default 1000)
 * @param {number} max      — ceiling ms (default 15000)
 * @returns {number}
 */
export function backoffMs(attempt, base = 1000, max = 15000) {
  if (attempt <= 0) return base;
  return Math.min(base * Math.pow(2, attempt - 1), max);
}
