/**
 * Track model + geo math.
 * Pure ES module: no DOM, no canvas, no browser APIs.
 *
 * TrackPoint: { lat, lon, altM, speedKph, courseDeg, timeMs, utcIso }
 */

/**
 * Convert firmware UTC date/time strings to ISO 8601 UTC.
 * @param {string} utcDate  "ddmmyy"
 * @param {string} utcTime  "hhmmss" or "hhmmss.ss"
 * @returns {string|null}
 */
export function utcToIso(utcDate, utcTime) {
  if (!utcDate || !utcTime || typeof utcDate !== 'string' || typeof utcTime !== 'string') return null;
  const d = utcDate.trim();
  const t = utcTime.trim();
  if (d.length < 6 || t.length < 6) return null;

  const dd = d.slice(0, 2);
  const mm = d.slice(2, 4);
  const yy = d.slice(4, 6);
  const hh = t.slice(0, 2);
  const mi = t.slice(2, 4);
  const ss = t.slice(4); // may include fractional seconds

  // Validate all numeric
  if ([dd, mm, yy, hh, mi].some(s => !/^\d+$/.test(s))) return null;
  if (!/^\d+(\.\d*)?$/.test(ss)) return null;

  const year = 2000 + parseInt(yy, 10);
  const secFull = parseFloat(ss);
  const secInt  = Math.floor(secFull);
  const ms      = Math.round((secFull - secInt) * 1000);
  const msPad   = String(ms).padStart(3, '0');

  const iso = `${year}-${mm}-${dd}T${hh}:${mi}:${String(secInt).padStart(2, '0')}.${msPad}Z`;

  // Sanity-check
  if (isNaN(Date.parse(iso))) return null;
  return iso;
}

/**
 * Convert a normalised GPS fix object to a TrackPoint, or null if invalid.
 * Rejects: non-finite lat/lon, out-of-range values, exact (0, 0).
 * @param {{lat:number, lon:number, altM:number, speedKph:number, courseDeg:number,
 *           utcDate:string, utcTime:string}} fix
 * @param {number} nowMs  epoch ms (caller-supplied)
 * @returns {TrackPoint|null}
 */
export function fixToPoint(fix, nowMs) {
  if (!fix) return null;
  const lat = Number(fix.lat);
  const lon = Number(fix.lon);
  if (!isFinite(lat) || !isFinite(lon)) return null;
  if (lat < -90 || lat > 90)   return null;
  if (lon < -180 || lon > 180) return null;
  if (lat === 0 && lon === 0)  return null; // null island

  return {
    lat,
    lon,
    altM:      Number(fix.altM)      || 0,
    speedKph:  Number(fix.speedKph)  || 0,
    courseDeg: Number(fix.courseDeg) || 0,
    timeMs:    nowMs,
    utcIso:    utcToIso(fix.utcDate, fix.utcTime),
  };
}

const R = 6_371_000; // Earth radius in metres

/**
 * Haversine great-circle distance between two {lat, lon} points.
 * @returns {number} metres
 */
export function haversineMeters(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sum of haversine distances over a sequence of TrackPoints.
 * @param {Array} points
 * @returns {number} metres
 */
export function totalDistanceMeters(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Decide whether a candidate point should be appended to the track.
 * @param {TrackPoint|null|undefined} lastPoint
 * @param {TrackPoint} candidate
 * @param {number} minMeters
 * @param {number} minMs
 * @returns {boolean}
 */
export function shouldAppend(lastPoint, candidate, minMeters, minMs) {
  if (!lastPoint) return true;
  if (haversineMeters(lastPoint, candidate) >= minMeters) return true;
  if ((candidate.timeMs - lastPoint.timeMs) >= minMs) return true;
  return false;
}
