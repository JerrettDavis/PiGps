import { describe, it, expect } from 'vitest';
import { projectSatellite, projectSatellites, snrBucket } from '../src/core/skymap.js';

const CX = 200, CY = 200, R = 100;

describe('projectSatellite', () => {
  it('elevation 0 → point on outer ring (dist ≈ radius)', () => {
    const { x, y } = projectSatellite({ elevation: 0, azimuth: 0 }, CX, CY, R);
    const dist = Math.hypot(x - CX, y - CY);
    expect(dist).toBeCloseTo(R, 5);
  });

  it('elevation 90 → centre (x≈cx, y≈cy)', () => {
    const { x, y } = projectSatellite({ elevation: 90, azimuth: 0 }, CX, CY, R);
    expect(x).toBeCloseTo(CX, 5);
    expect(y).toBeCloseTo(CY, 5);
  });

  it('elevation < 0 is clamped to 0 (on outer ring)', () => {
    const { x, y, inHorizon } = projectSatellite({ elevation: -10, azimuth: 0 }, CX, CY, R);
    const dist = Math.hypot(x - CX, y - CY);
    expect(dist).toBeCloseTo(R, 5);
    expect(inHorizon).toBe(true);
  });

  it('elevation > 90 is clamped to 90 (at centre)', () => {
    const { x, y } = projectSatellite({ elevation: 120, azimuth: 0 }, CX, CY, R);
    expect(x).toBeCloseTo(CX, 5);
    expect(y).toBeCloseTo(CY, 5);
  });

  // Azimuth directions: angle = (az - 90) * PI/180
  // az=0  → angle=-90° → cos=-0→0, sin=-1 → y < cy, x≈cx  (North = up)
  it('azimuth 0 (North) → above centre (y < cy, x ≈ cx)', () => {
    const { x, y } = projectSatellite({ elevation: 0, azimuth: 0 }, CX, CY, R);
    expect(x).toBeCloseTo(CX, 3);
    expect(y).toBeLessThan(CY);
  });

  // az=90 → angle=0° → cos=1, sin=0 → x > cx (East = right)
  it('azimuth 90 (East) → right of centre (x > cx)', () => {
    const { x, y } = projectSatellite({ elevation: 0, azimuth: 90 }, CX, CY, R);
    expect(x).toBeGreaterThan(CX);
    expect(y).toBeCloseTo(CY, 3);
  });

  // az=180 → angle=90° → cos=0, sin=1 → y > cy (South = down)
  it('azimuth 180 (South) → below centre (y > cy)', () => {
    const { x, y } = projectSatellite({ elevation: 0, azimuth: 180 }, CX, CY, R);
    expect(y).toBeGreaterThan(CY);
    expect(x).toBeCloseTo(CX, 3);
  });

  // az=270 → angle=180° → cos=-1, sin=0 → x < cx (West = left)
  it('azimuth 270 (West) → left of centre (x < cx)', () => {
    const { x, y } = projectSatellite({ elevation: 0, azimuth: 270 }, CX, CY, R);
    expect(x).toBeLessThan(CX);
    expect(y).toBeCloseTo(CY, 3);
  });

  it('missing elevation and azimuth → no NaN in output', () => {
    const { x, y } = projectSatellite({}, CX, CY, R);
    expect(isNaN(x)).toBe(false);
    expect(isNaN(y)).toBe(false);
  });

  it('undefined sat → no NaN in output', () => {
    const { x, y } = projectSatellite(undefined, CX, CY, R);
    expect(isNaN(x)).toBe(false);
    expect(isNaN(y)).toBe(false);
  });

  it('NaN elevation/azimuth treated as 0 → no NaN', () => {
    const { x, y } = projectSatellite({ elevation: NaN, azimuth: NaN }, CX, CY, R);
    expect(isNaN(x)).toBe(false);
    expect(isNaN(y)).toBe(false);
  });

  it('inHorizon true when elevation ≤ 0', () => {
    expect(projectSatellite({ elevation: 0,  azimuth: 0 }, CX, CY, R).inHorizon).toBe(true);
    expect(projectSatellite({ elevation: -5, azimuth: 0 }, CX, CY, R).inHorizon).toBe(true);
  });

  it('inHorizon false when elevation > 0', () => {
    expect(projectSatellite({ elevation: 45, azimuth: 0 }, CX, CY, R).inHorizon).toBe(false);
  });
});

describe('snrBucket', () => {
  it('≥35 → strong', () => {
    expect(snrBucket(35)).toBe('strong');
    expect(snrBucket(50)).toBe('strong');
  });

  it('25–34 → medium', () => {
    expect(snrBucket(25)).toBe('medium');
    expect(snrBucket(34)).toBe('medium');
  });

  it('>0 and <25 → weak', () => {
    expect(snrBucket(1)).toBe('weak');
    expect(snrBucket(24)).toBe('weak');
  });

  it('0 or negative → none', () => {
    expect(snrBucket(0)).toBe('none');
    expect(snrBucket(-5)).toBe('none');
  });

  it('NaN / undefined / null → none', () => {
    expect(snrBucket(NaN)).toBe('none');
    expect(snrBucket(undefined)).toBe('none');
    expect(snrBucket(null)).toBe('none');
  });
});

describe('projectSatellites', () => {
  it('maps valid sats and includes prn/used/snr', () => {
    const sats = [
      { prn: 1, elevation: 45, azimuth: 90, used: true,  snr: 40 },
      { prn: 2, elevation: 20, azimuth: 0,  used: false, snr: 20 },
    ];
    const result = projectSatellites(sats, CX, CY, R);
    expect(result).toHaveLength(2);
    expect(result[0].prn).toBe(1);
    expect(result[0].used).toBe(true);
    expect(result[0].snr).toBe(40);
  });

  it('skips entries without a numeric prn', () => {
    const sats = [
      { prn: 'abc', elevation: 45, azimuth: 0 },
      { elevation: 30, azimuth: 0 },
      { prn: null, elevation: 10, azimuth: 0 },
      { prn: 5, elevation: 10, azimuth: 0 },
    ];
    const result = projectSatellites(sats, CX, CY, R);
    expect(result).toHaveLength(1);
    expect(result[0].prn).toBe(5);
  });

  it('returns empty array for empty input', () => {
    expect(projectSatellites([], CX, CY, R)).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(projectSatellites(null, CX, CY, R)).toEqual([]);
  });
});
