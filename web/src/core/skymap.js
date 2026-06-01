/**
 * Polar sky projection — satellites onto a round sky plot.
 * North up, East right. Elevation 90° = center, 0° = outer ring.
 * Pure ES module: no DOM, no canvas, no browser APIs.
 */

/**
 * Project a single satellite onto the sky plot.
 * @param {{elevation:number, azimuth:number}} sat
 * @param {number} cx  centre x
 * @param {number} cy  centre y
 * @param {number} radius  outer-ring radius
 * @returns {{x:number, y:number, inHorizon:boolean}}
 */
export function projectSatellite(sat, cx, cy, radius) {
  const rawElev = (sat && !isNaN(Number(sat.elevation))) ? Number(sat.elevation) : 0;
  const rawAz   = (sat && !isNaN(Number(sat.azimuth)))   ? Number(sat.azimuth)   : 0;

  const elev = Math.max(0, Math.min(90, rawElev));
  const az   = (rawAz - 90) * Math.PI / 180;
  const dist = radius * (1 - elev / 90);

  return {
    x: cx + dist * Math.cos(az),
    y: cy + dist * Math.sin(az),
    inHorizon: rawElev <= 0,
  };
}

/**
 * Project an array of satellite objects.
 * Entries without a numeric prn are skipped.
 * @param {Array} sats
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {Array<{prn:number, x:number, y:number, used:boolean, snr:number}>}
 */
export function projectSatellites(sats, cx, cy, radius) {
  if (!Array.isArray(sats)) return [];
  const results = [];
  for (const s of sats) {
    const rawPrn = s == null ? undefined : s.prn;
    if (rawPrn == null || rawPrn === '' || rawPrn === false) continue;
    const prn = Number(rawPrn);
    if (!Number.isFinite(prn)) continue;
    const { x, y } = projectSatellite(s, cx, cy, radius);
    results.push({ prn, x, y, used: !!s.used, snr: Number(s.snr) || 0 });
  }
  return results;
}

/**
 * Classify signal strength into a named bucket.
 * @param {number|undefined|null} snr
 * @returns {'strong'|'medium'|'weak'|'none'}
 */
export function snrBucket(snr) {
  const v = Number(snr);
  if (!isFinite(v) || v <= 0) return 'none';
  if (v >= 35) return 'strong';
  if (v >= 25) return 'medium';
  return 'weak';
}
