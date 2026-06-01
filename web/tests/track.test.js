import { describe, it, expect } from 'vitest';
import { utcToIso, fixToPoint, haversineMeters, totalDistanceMeters, shouldAppend } from '../src/core/track.js';

// ── utcToIso ──────────────────────────────────────────────────────────────────
describe('utcToIso', () => {
  it('valid date+time → parseable ISO 8601 UTC string', () => {
    const iso = utcToIso('010125', '123456');
    expect(iso).not.toBeNull();
    expect(isNaN(Date.parse(iso))).toBe(false);
    expect(iso).toMatch(/Z$/);
  });

  it('preserves correct year/month/day/time values', () => {
    const iso = utcToIso('150624', '083000');
    const d = new Date(iso);
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(5);   // June = 5
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(8);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it('fractional seconds → still valid ISO', () => {
    const iso = utcToIso('010125', '123456.78');
    expect(isNaN(Date.parse(iso))).toBe(false);
  });

  it('empty utcDate → null', () => {
    expect(utcToIso('', '123456')).toBeNull();
  });

  it('empty utcTime → null', () => {
    expect(utcToIso('010125', '')).toBeNull();
  });

  it('null/undefined → null', () => {
    expect(utcToIso(null, '123456')).toBeNull();
    expect(utcToIso('010125', undefined)).toBeNull();
  });

  it('malformed (too short) → null', () => {
    expect(utcToIso('0101', '1234')).toBeNull();
  });
});

// ── fixToPoint ────────────────────────────────────────────────────────────────
describe('fixToPoint', () => {
  const goodFix = { lat: 51.5, lon: -0.1, altM: 30, speedKph: 10, courseDeg: 45, utcDate: '010125', utcTime: '120000' };
  const nowMs = 1_700_000_000_000;

  it('returns a valid TrackPoint for a good fix', () => {
    const pt = fixToPoint(goodFix, nowMs);
    expect(pt).not.toBeNull();
    expect(pt.lat).toBe(51.5);
    expect(pt.lon).toBe(-0.1);
    expect(pt.timeMs).toBe(nowMs);
    expect(pt.utcIso).not.toBeNull();
  });

  it('preserves negative lat (Southern hemisphere)', () => {
    const pt = fixToPoint({ ...goodFix, lat: -33.9, lon: 151.2 }, nowMs);
    expect(pt).not.toBeNull();
    expect(pt.lat).toBe(-33.9);
  });

  it('preserves negative lon (Western hemisphere)', () => {
    const pt = fixToPoint({ ...goodFix, lat: 40.7, lon: -74.0 }, nowMs);
    expect(pt).not.toBeNull();
    expect(pt.lon).toBe(-74.0);
  });

  it('returns null for null island (0, 0)', () => {
    expect(fixToPoint({ ...goodFix, lat: 0, lon: 0 }, nowMs)).toBeNull();
  });

  it('returns null when lat is non-finite', () => {
    expect(fixToPoint({ ...goodFix, lat: NaN }, nowMs)).toBeNull();
    expect(fixToPoint({ ...goodFix, lat: Infinity }, nowMs)).toBeNull();
  });

  it('returns null when lon is non-finite', () => {
    expect(fixToPoint({ ...goodFix, lon: NaN }, nowMs)).toBeNull();
  });

  it('returns null for lat out of range', () => {
    expect(fixToPoint({ ...goodFix, lat: 95 }, nowMs)).toBeNull();
    expect(fixToPoint({ ...goodFix, lat: -91 }, nowMs)).toBeNull();
  });

  it('returns null for lon out of range', () => {
    expect(fixToPoint({ ...goodFix, lon: 181 }, nowMs)).toBeNull();
    expect(fixToPoint({ ...goodFix, lon: -181 }, nowMs)).toBeNull();
  });

  it('returns null for null fix', () => {
    expect(fixToPoint(null, nowMs)).toBeNull();
  });
});

// ── haversineMeters ───────────────────────────────────────────────────────────
describe('haversineMeters', () => {
  it('≈111 km for 1° latitude separation', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 1, lon: 0 };
    const d = haversineMeters(a, b);
    expect(d).toBeGreaterThan(111_000 * 0.99);
    expect(d).toBeLessThan(111_000 * 1.01);
  });

  it('0 for identical points', () => {
    const a = { lat: 48.85, lon: 2.35 };
    expect(haversineMeters(a, a)).toBe(0);
  });

  it('symmetric', () => {
    const a = { lat: 51.5, lon: -0.1 };
    const b = { lat: 48.9, lon:  2.3 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 3);
  });
});

// ── totalDistanceMeters ───────────────────────────────────────────────────────
describe('totalDistanceMeters', () => {
  it('0 points → 0', () => {
    expect(totalDistanceMeters([])).toBe(0);
  });

  it('1 point → 0', () => {
    expect(totalDistanceMeters([{ lat: 0, lon: 0 }])).toBe(0);
  });

  it('sums distances over multiple points', () => {
    const pts = [
      { lat: 0, lon: 0 },
      { lat: 1, lon: 0 },
      { lat: 2, lon: 0 },
    ];
    const total = totalDistanceMeters(pts);
    // Should be approximately 2 × 111 km
    expect(total).toBeGreaterThan(220_000);
    expect(total).toBeLessThan(225_000);
  });
});

// ── shouldAppend ──────────────────────────────────────────────────────────────
describe('shouldAppend', () => {
  const base = { lat: 0, lon: 0, timeMs: 1000 };
  const far  = { lat: 1, lon: 0, timeMs: 1000 }; // ~111 km away
  const near = { lat: 0, lon: 0.00001, timeMs: 1001 }; // ~1 m away, +1 ms

  it('true when lastPoint is null', () => {
    expect(shouldAppend(null, base, 10, 5000)).toBe(true);
  });

  it('true when lastPoint is undefined', () => {
    expect(shouldAppend(undefined, base, 10, 5000)).toBe(true);
  });

  it('true when distance threshold is met', () => {
    expect(shouldAppend(base, far, 100, 999_999)).toBe(true);
  });

  it('true when time threshold is met', () => {
    const late = { ...base, lat: 0, lon: 0, timeMs: base.timeMs + 5000 };
    expect(shouldAppend(base, late, 999_999, 5000)).toBe(true);
  });

  it('false when neither threshold is met', () => {
    expect(shouldAppend(base, near, 50, 5000)).toBe(false);
  });
});
