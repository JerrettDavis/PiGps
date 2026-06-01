/**
 * skyview.js — Polar satellite skymap renderer.
 * Draws on a <canvas> using projectSatellites() from core/skymap.js.
 */

import { projectSatellites, snrBucket } from '../core/skymap.js';

/** SNR bucket → fill color */
const SNR_FILL = {
  strong: '#4ade80',   // green
  medium: '#facc15',   // amber
  weak:   '#f87171',   // red
  none:   '#64748b',   // slate gray
};

const SNR_STROKE = {
  strong: '#86efac',
  medium: '#fde68a',
  weak:   '#fca5a5',
  none:   '#94a3b8',
};

/**
 * Render the polar sky grid + satellites onto a canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} sats  array of normalized sat objects {elevation, azimuth, snr, used, prn}
 */
export function render(canvas, sats) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.42;

  ctx.clearRect(0, 0, w, h);

  // --- Background ---
  ctx.fillStyle = '#0d121c';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // --- Rings (horizon, 30°, 60° elevation) ---
  ctx.strokeStyle = '#2a3a52';
  ctx.lineWidth = 1.5;
  for (const scale of [1, 0.667, 0.333]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Crosshairs ---
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx + r, cy);
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();

  // --- Cardinal labels ---
  ctx.fillStyle = '#96a3b7';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('N', cx, cy - r - 8);
  ctx.textBaseline = 'top';
  ctx.fillText('S', cx, cy + r + 8);
  ctx.textBaseline = 'middle';
  ctx.fillText('W', cx - r - 14, cy);
  ctx.fillText('E', cx + r + 14, cy);
  ctx.textBaseline = 'alphabetic';

  if (!Array.isArray(sats) || sats.length === 0) return;

  // --- Satellites ---
  const projected = projectSatellites(sats, cx, cy, r);

  for (const sat of projected) {
    const rawSat = sats.find(s => Number(s.prn) === sat.prn);
    const bucket = snrBucket(rawSat ? rawSat.snr : undefined);
    const fill = SNR_FILL[bucket];
    const stroke = SNR_STROKE[bucket];
    const dotR = 11;

    ctx.beginPath();
    ctx.arc(sat.x, sat.y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();

    // Brighter ring for used satellites
    ctx.lineWidth = sat.used ? 2.5 : 1;
    ctx.strokeStyle = sat.used ? '#ffffff' : stroke;
    ctx.stroke();

    // PRN label
    ctx.fillStyle = '#0b0d12';
    ctx.font = `bold ${dotR < 12 ? '9' : '10'}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(sat.prn), sat.x, sat.y);
  }

  ctx.textBaseline = 'alphabetic';
}
