/**
 * frames.js — Pure frame parsing helpers for PiGps web app.
 * No DOM, no browser APIs, no side effects.
 */

/**
 * Parse one JSON line into a frame object.
 * Returns a valid parsed object if it has a string `type` field.
 * Never throws — returns {type:'unparseable', raw, error} on any failure.
 * @param {string} line
 * @returns {object}
 */
export function parseFrame(line) {
  try {
    const obj = JSON.parse(line);
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj) && typeof obj.type === 'string') {
      return obj;
    }
    return { type: 'unparseable', raw: line, error: 'missing or non-string type field' };
  } catch (e) {
    return { type: 'unparseable', raw: line, error: e.message };
  }
}

/**
 * Split an accumulating string buffer into complete lines and a leftover partial.
 * Complete lines are trimmed of trailing \r and whitespace-only lines are excluded.
 * @param {string} buffer
 * @returns {{ lines: string[], rest: string }}
 */
export function splitFrames(buffer) {
  const parts = buffer.split('\n');
  // Last element is either '' (buffer ended with \n) or a partial line
  const rest = parts.pop() ?? '';
  const lines = parts
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim().length > 0);
  return { lines, rest };
}

/**
 * Return true iff the frame is a GPS frame with a fix object.
 * @param {*} frame
 * @returns {boolean}
 */
export function isGpsFrame(frame) {
  return (
    frame != null &&
    frame.type === 'gps' &&
    frame.fix !== null &&
    typeof frame.fix === 'object' &&
    !Array.isArray(frame.fix)
  );
}

/**
 * Normalize the fix sub-object of a GPS frame into a consistent shape.
 * Missing or NaN numeric fields default to 0; hasFix defaults to false;
 * string fields default to ''.
 * @param {object} frame
 * @returns {object}
 */
export function normalizeFix(frame) {
  const fix = (frame && frame.fix && typeof frame.fix === 'object') ? frame.fix : {};

  const num = (v, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  return {
    hasFix:       Boolean(fix.hasFix) || false,
    quality:      num(fix.quality),
    mode:         num(fix.mode),
    lat:          num(fix.lat),
    lon:          num(fix.lon),
    altM:         num(fix.altM),
    geoidSepM:    num(fix.geoidSepM),
    speedKnots:   num(fix.speedKnots),
    speedKph:     num(fix.speedKph),
    courseDeg:    num(fix.courseDeg),
    satsUsed:     num(fix.satsUsed),
    satsInView:   num(fix.satsInView),
    hdop:         num(fix.hdop),
    pdop:         num(fix.pdop),
    vdop:         num(fix.vdop),
    utcTime:      typeof fix.utcTime === 'string' ? fix.utcTime : '',
    utcDate:      typeof fix.utcDate === 'string' ? fix.utcDate : '',
  };
}

/**
 * Return true iff the fix has a valid, non-null-island position.
 * @param {object} fix  (as returned by normalizeFix or a raw fix object)
 * @returns {boolean}
 */
export function hasValidPosition(fix) {
  if (!fix) return false;
  const lat = fix.lat;
  const lon = fix.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  if (lat === 0 && lon === 0) return false;
  return true;
}

/**
 * Normalize the satellites array from a GPS frame.
 * Each entry is coerced to {prn, elevation, azimuth, snr, used}.
 * Entries without a numeric prn are skipped.
 * Returns [] if the frame has no satellites field.
 * @param {object} frame
 * @returns {Array<{prn:number, elevation:number, azimuth:number, snr:number, used:boolean}>}
 */
export function normalizeSats(frame) {
  const raw = (frame && Array.isArray(frame.satellites)) ? frame.satellites : [];
  const result = [];
  for (const s of raw) {
    const prn = Number(s.prn);
    if (!Number.isFinite(prn)) continue;
    result.push({
      prn,
      elevation: Number.isFinite(Number(s.elevation)) ? Number(s.elevation) : 0,
      azimuth:   Number.isFinite(Number(s.azimuth))   ? Number(s.azimuth)   : 0,
      snr:       Number.isFinite(Number(s.snr))       ? Number(s.snr)       : 0,
      used:      Boolean(s.used),
    });
  }
  return result;
}
