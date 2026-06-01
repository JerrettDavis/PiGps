/**
 * Serialize an array of TrackPoints to a CSV string.
 * Pure ES module — no DOM, no browser APIs.
 */

const HEADER = 'time_iso,lat,lon,alt_m,speed_kph,course_deg';

function fmtNum(n) {
  // Always use '.' decimal regardless of locale
  return Number(n).toString().replace(',', '.');
}

/**
 * @param {Array<{lat:number,lon:number,altM:number,speedKph:number,courseDeg:number,timeMs:number,utcIso:string|null}>} points
 * @returns {string}
 */
export function pointsToCsv(points) {
  const rows = points.map((p) => {
    // utcIso never contains a comma (ISO 8601 format), but guard anyway
    const time = p.utcIso != null ? String(p.utcIso).replace(/,/g, '') : '';
    return [
      time,
      fmtNum(p.lat),
      fmtNum(p.lon),
      fmtNum(p.altM),
      fmtNum(p.speedKph),
      fmtNum(p.courseDeg),
    ].join(',');
  });

  return [HEADER, ...rows].join('\n');
}
