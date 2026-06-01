/**
 * Serialize an array of TrackPoints to a GPX 1.1 document string.
 * Pure ES module — no DOM, no browser APIs.
 */

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtNum(n) {
  // Always use '.' decimal regardless of locale
  return Number(n).toString().replace(',', '.');
}

/**
 * @param {Array<{lat:number,lon:number,altM:number,speedKph:number,courseDeg:number,timeMs:number,utcIso:string|null}>} points
 * @param {{ name?: string, creator?: string }} opts
 * @returns {string}
 */
export function pointsToGpx(points, opts = {}) {
  const creator = xmlEscape(opts.creator ?? 'PiGps');
  const name = xmlEscape(opts.name ?? 'PiGps Track');

  const trkpts = points.map((p) => {
    const lat = fmtNum(p.lat);
    const lon = fmtNum(p.lon);
    const ele = `    <ele>${fmtNum(p.altM)}</ele>`;
    const time = p.utcIso != null ? `    <time>${xmlEscape(p.utcIso)}</time>` : null;

    const inner = [ele, time].filter(Boolean).join('\n');
    return `  <trkpt lat="${lat}" lon="${lon}">\n${inner}\n  </trkpt>`;
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="${creator}" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `<trk>\n` +
    `<name>${name}</name>\n` +
    `<trkseg>\n` +
    trkpts.join('\n') +
    `\n</trkseg>\n` +
    `</trk>\n` +
    `</gpx>`
  );
}
