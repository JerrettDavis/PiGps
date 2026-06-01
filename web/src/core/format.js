/**
 * format.js — Pure formatting helpers for PiGps web app.
 * No DOM, no browser APIs, no side effects.
 */

/**
 * Format a numeric value to a fixed number of decimal places with an optional suffix.
 * Returns '-' for non-finite values (NaN, Infinity, null, undefined, non-numbers).
 * @param {*} value
 * @param {number} digits
 * @param {string} suffix
 * @returns {string}
 */
export function fmtNumber(value, digits = 5, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toFixed(digits) + suffix;
}

/**
 * Format a latitude or longitude value to 7 decimal places.
 * Returns '-' for non-finite values.
 * @param {*} value
 * @returns {string}
 */
export function fmtCoord(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return value.toFixed(7);
}

/**
 * Format firmware UTC date + time strings into a human-readable display string.
 * @param {string} utcDate  firmware format "ddmmyy"
 * @param {string} utcTime  firmware format "hhmmss.ss"
 * @returns {string} "YYYY-MM-DD hh:mm:ss UTC" or '-' if either is missing/malformed
 */
export function utcDisplay(utcDate, utcTime) {
  if (!utcDate || !utcTime) return '-';
  if (typeof utcDate !== 'string' || typeof utcTime !== 'string') return '-';
  if (utcDate.length < 6 || utcTime.length < 6) return '-';

  const dd = utcDate.slice(0, 2);
  const mo = utcDate.slice(2, 4);
  const yy = utcDate.slice(4, 6);

  const hh = utcTime.slice(0, 2);
  const mm = utcTime.slice(2, 4);
  const ss = utcTime.slice(4, 6);

  // Validate all parts are numeric
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mo) || !/^\d{2}$/.test(yy)) return '-';
  if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm) || !/^\d{2}$/.test(ss)) return '-';

  const year = `20${yy}`;
  return `${year}-${mo}-${dd} ${hh}:${mm}:${ss} UTC`;
}

/**
 * Map NMEA GGA fix quality integer to a human-readable name.
 * @param {number} q
 * @returns {string}
 */
export function qualityName(q) {
  const names = {
    0: 'invalid',
    1: 'GPS',
    2: 'DGPS',
    3: 'PPS',
    4: 'RTK fixed',
    5: 'RTK float',
    6: 'estimated',
    7: 'manual',
    8: 'simulation',
  };
  return Object.prototype.hasOwnProperty.call(names, q) ? names[q] : 'unknown';
}

/**
 * Map NMEA GSA fix mode integer to a human-readable name.
 * @param {number} mode
 * @returns {string}
 */
export function fixModeName(mode) {
  if (mode === 3) return '3D';
  if (mode === 2) return '2D';
  return 'No fix';
}
