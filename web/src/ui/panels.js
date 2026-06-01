/**
 * panels.js — Hero + quality/DOP panel updaters.
 * Uses core/format helpers. No innerHTML with untrusted data.
 */

import { fmtCoord, fmtNumber, utcDisplay, qualityName, fixModeName } from '../core/format.js';
import { setText } from './dom.js';

/**
 * Update all hero and quality/DOP panels from a normalized fix + raw GPS frame.
 * @param {object} fix      result of normalizeFix()
 * @param {object} frame    raw GPS frame (for stats, pins, rawBytesTotal)
 */
export function updatePanels(fix, frame) {
  const stats = (frame && typeof frame.stats === 'object' && frame.stats) ? frame.stats : {};

  // --- Hero panel ---
  setText('fixState', fix.hasFix
    ? `Fix (${fix.satsUsed || 0} used)`
    : 'No fix yet');
  setText('lat',    fmtCoord(fix.lat));
  setText('lon',    fmtCoord(fix.lon));
  setText('alt',    fmtNumber(fix.altM, 1, ' m'));
  setText('speed',  fmtNumber(fix.speedKph, 1, ' km/h'));
  setText('course', fmtNumber(fix.courseDeg, 1, '°'));
  setText('satSummary', `${fix.satsUsed ?? 0} used / ${fix.satsInView ?? 0} in view`);

  // --- Quality/DOP panel ---
  setText('utc',      utcDisplay(fix.utcDate, fix.utcTime));
  setText('quality',  `${fix.quality ?? '-'} (${qualityName(fix.quality)})`);
  setText('mode',     fixModeName(fix.mode));
  setText('satsUsed', `${fix.satsUsed ?? '-'} / ${fix.satsInView ?? '-'} / ${stats.freshSatellites ?? '-'}`);
  setText('dop',      `${fix.hdop ?? '-'} / ${fix.pdop ?? '-'} / ${fix.vdop ?? '-'}`);
  setText('checksums',`${stats.totalSentences ?? 0} / ${stats.validSentences ?? 0} / ${stats.badChecksums ?? 0}`);
  setText('overflowed', stats.overflowedSentences ?? 0);
  setText('age',      stats.lastSentenceAgeMs != null ? `${stats.lastSentenceAgeMs} ms` : '-');
  setText('rawBytes', stats.rawBytesTotal != null ? String(stats.rawBytesTotal) : '-');
}
