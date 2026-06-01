/**
 * recorder.js — Track recording with GPX/CSV export.
 */

import { fixToPoint, shouldAppend, totalDistanceMeters } from '../core/track.js';
import { pointsToGpx } from '../core/gpx.js';
import { pointsToCsv } from '../core/csv.js';

export class Recorder {
  constructor() {
    this._points = [];
    this._recording = false;
    this._lastPoint = null;
  }

  start() {
    this._recording = true;
  }

  stop() {
    this._recording = false;
  }

  clear() {
    this._points = [];
    this._lastPoint = null;
  }

  /**
   * Attempt to append a GPS fix to the track.
   * Only appends when recording AND shouldAppend passes.
   * @param {object} fix  normalized fix from normalizeFix()
   * @param {number} nowMs
   * @returns {object|null} the appended TrackPoint, or null
   */
  append(fix, nowMs) {
    if (!this._recording) return null;
    const candidate = fixToPoint(fix, nowMs);
    if (!candidate) return null;
    if (!shouldAppend(this._lastPoint, candidate, 2, 1000)) return null;
    this._points.push(candidate);
    this._lastPoint = candidate;
    return candidate;
  }

  get recording() {
    return this._recording;
  }

  get points() {
    return this._points;
  }

  get count() {
    return this._points.length;
  }

  get distanceMeters() {
    return totalDistanceMeters(this._points);
  }

  /**
   * Trigger a browser download of the track as GPX.
   * @param {string} filename
   */
  downloadGpx(filename) {
    const content = pointsToGpx(this._points, { name: filename, creator: 'PiGps' });
    this._download(content, filename, 'application/gpx+xml');
  }

  /**
   * Trigger a browser download of the track as CSV.
   * @param {string} filename
   */
  downloadCsv(filename) {
    const content = pointsToCsv(this._points);
    this._download(content, filename, 'text/csv');
  }

  _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke after a tick to allow the download to start.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
