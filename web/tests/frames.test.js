import { describe, it, expect } from 'vitest';
import {
  parseFrame,
  splitFrames,
  isGpsFrame,
  normalizeFix,
  hasValidPosition,
  normalizeSats,
} from '../src/core/frames.js';

// Minimal valid GPS frame for reuse
const GPS_FRAME = {
  type: 'gps',
  version: '1.0.0',
  ms: 12345,
  fix: {
    hasFix: true,
    quality: 1,
    mode: 3,
    lat: 51.5074,
    lon: -0.1278,
    altM: 10.0,
    geoidSepM: 47.0,
    speedKnots: 0.1,
    speedKph: 0.185,
    courseDeg: 90.0,
    satsUsed: 8,
    satsInView: 12,
    hdop: 1.2,
    pdop: 1.8,
    vdop: 1.4,
    utcTime: '123456.00',
    utcDate: '010125',
  },
  satellites: [],
};

// ─── parseFrame ────────────────────────────────────────────────────────────────

describe('parseFrame', () => {
  it('parses a valid gps frame', () => {
    const line = JSON.stringify(GPS_FRAME);
    const result = parseFrame(line);
    expect(result.type).toBe('gps');
    expect(result.fix.lat).toBe(51.5074);
  });

  it('parses a raw frame', () => {
    const line = JSON.stringify({ type: 'raw', nmea: '$GPGGA,...' });
    const result = parseFrame(line);
    expect(result.type).toBe('raw');
    expect(result.nmea).toBe('$GPGGA,...');
  });

  it('parses an info frame', () => {
    const line = JSON.stringify({ type: 'info', message: 'booted' });
    const result = parseFrame(line);
    expect(result.type).toBe('info');
  });

  it('parses a hex frame', () => {
    const line = JSON.stringify({ type: 'hex', bytes: 4, data: 'deadbeef' });
    const result = parseFrame(line);
    expect(result.type).toBe('hex');
  });

  it('returns unparseable for malformed JSON — does NOT throw', () => {
    const result = parseFrame('{bad json}');
    expect(result.type).toBe('unparseable');
    expect(result.raw).toBe('{bad json}');
    expect(typeof result.error).toBe('string');
  });

  it('returns unparseable for empty string', () => {
    const result = parseFrame('');
    expect(result.type).toBe('unparseable');
  });

  it('returns unparseable for a JSON array', () => {
    const result = parseFrame('[1,2,3]');
    expect(result.type).toBe('unparseable');
  });

  it('returns unparseable for a JSON number', () => {
    const result = parseFrame('42');
    expect(result.type).toBe('unparseable');
  });

  it('returns unparseable for an object missing type field', () => {
    const result = parseFrame('{"foo":"bar"}');
    expect(result.type).toBe('unparseable');
  });

  it('returns unparseable for an object with numeric type', () => {
    const result = parseFrame('{"type":1}');
    expect(result.type).toBe('unparseable');
  });

  it('returns unparseable for null JSON', () => {
    const result = parseFrame('null');
    expect(result.type).toBe('unparseable');
  });
});

// ─── splitFrames ───────────────────────────────────────────────────────────────

describe('splitFrames', () => {
  it('splits a buffer with two complete lines and no remainder', () => {
    const buf = '{"type":"raw","nmea":"A"}\n{"type":"raw","nmea":"B"}\n';
    const { lines, rest } = splitFrames(buf);
    expect(lines).toHaveLength(2);
    expect(rest).toBe('');
  });

  it('returns partial trailing line in rest', () => {
    const buf = '{"type":"info","message":"boot"}\n{"type":"raw"';
    const { lines, rest } = splitFrames(buf);
    expect(lines).toHaveLength(1);
    expect(rest).toBe('{"type":"raw"');
  });

  it('returns empty lines array and full buffer in rest when no newline', () => {
    const buf = '{"type":"info","message":"partial"';
    const { lines, rest } = splitFrames(buf);
    expect(lines).toHaveLength(0);
    expect(rest).toBe('{"type":"info","message":"partial"');
  });

  it('excludes empty lines', () => {
    const buf = '\n\n{"type":"info","message":"x"}\n\n';
    const { lines, rest } = splitFrames(buf);
    expect(lines).toHaveLength(1);
    expect(rest).toBe('');
  });

  it('excludes whitespace-only lines', () => {
    const buf = '   \n{"type":"info","message":"y"}\n  \n';
    const { lines, rest } = splitFrames(buf);
    expect(lines).toHaveLength(1);
  });

  it('handles \\r\\n line endings — strips \\r', () => {
    const buf = '{"type":"info","message":"cr"}\r\n';
    const { lines } = splitFrames(buf);
    expect(lines[0]).toBe('{"type":"info","message":"cr"}');
  });

  it('handles empty buffer', () => {
    const { lines, rest } = splitFrames('');
    expect(lines).toHaveLength(0);
    expect(rest).toBe('');
  });

  it('handles multiple lines in one buffer', () => {
    const lines3 = Array.from({ length: 5 }, (_, i) => `{"type":"t${i}"}`).join('\n') + '\n';
    const { lines } = splitFrames(lines3);
    expect(lines).toHaveLength(5);
  });
});

// ─── isGpsFrame ────────────────────────────────────────────────────────────────

describe('isGpsFrame', () => {
  it('returns true for a valid gps frame with fix object', () => {
    expect(isGpsFrame(GPS_FRAME)).toBe(true);
  });

  it('returns false for a raw frame', () => {
    expect(isGpsFrame({ type: 'raw', nmea: '' })).toBe(false);
  });

  it('returns false for gps frame without fix', () => {
    expect(isGpsFrame({ type: 'gps' })).toBe(false);
  });

  it('returns false for gps frame with null fix', () => {
    expect(isGpsFrame({ type: 'gps', fix: null })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGpsFrame(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGpsFrame(undefined)).toBe(false);
  });
});

// ─── normalizeFix ──────────────────────────────────────────────────────────────

describe('normalizeFix', () => {
  it('returns correct values from a fully populated fix', () => {
    const fix = normalizeFix(GPS_FRAME);
    expect(fix.hasFix).toBe(true);
    expect(fix.lat).toBe(51.5074);
    expect(fix.lon).toBe(-0.1278);
    expect(fix.quality).toBe(1);
    expect(fix.mode).toBe(3);
    expect(fix.utcTime).toBe('123456.00');
    expect(fix.utcDate).toBe('010125');
  });

  it('coerces string numbers', () => {
    const frame = { fix: { lat: '48.8566', lon: '2.3522', quality: '2' } };
    const fix = normalizeFix(frame);
    expect(fix.lat).toBe(48.8566);
    expect(fix.lon).toBe(2.3522);
    expect(fix.quality).toBe(2);
  });

  it('defaults missing numeric fields to 0', () => {
    const fix = normalizeFix({ fix: {} });
    expect(fix.lat).toBe(0);
    expect(fix.lon).toBe(0);
    expect(fix.altM).toBe(0);
    expect(fix.hdop).toBe(0);
  });

  it('defaults hasFix to false when missing', () => {
    const fix = normalizeFix({ fix: {} });
    expect(fix.hasFix).toBe(false);
  });

  it('defaults utcTime and utcDate to empty string when missing', () => {
    const fix = normalizeFix({ fix: {} });
    expect(fix.utcTime).toBe('');
    expect(fix.utcDate).toBe('');
  });

  it('handles frame with no fix property', () => {
    const fix = normalizeFix({});
    expect(fix.lat).toBe(0);
    expect(fix.hasFix).toBe(false);
    expect(fix.utcTime).toBe('');
  });

  it('handles null frame gracefully', () => {
    const fix = normalizeFix(null);
    expect(fix.lat).toBe(0);
    expect(fix.hasFix).toBe(false);
  });

  it('does not include NaN in numeric fields', () => {
    const frame = { fix: { lat: 'not-a-number', hdop: undefined } };
    const fix = normalizeFix(frame);
    expect(fix.lat).toBe(0);
    expect(fix.hdop).toBe(0);
  });
});

// ─── hasValidPosition ──────────────────────────────────────────────────────────

describe('hasValidPosition', () => {
  it('returns true for a real coordinate', () => {
    expect(hasValidPosition({ lat: 51.5074, lon: -0.1278 })).toBe(true);
  });

  it('returns false for null island (0,0)', () => {
    expect(hasValidPosition({ lat: 0, lon: 0 })).toBe(false);
  });

  it('returns false when lat is NaN', () => {
    expect(hasValidPosition({ lat: NaN, lon: -0.1278 })).toBe(false);
  });

  it('returns false when lon is NaN', () => {
    expect(hasValidPosition({ lat: 51.5074, lon: NaN })).toBe(false);
  });

  it('returns false when lat is out of range (>90)', () => {
    expect(hasValidPosition({ lat: 91, lon: 10 })).toBe(false);
  });

  it('returns false when lat is out of range (<-90)', () => {
    expect(hasValidPosition({ lat: -91, lon: 10 })).toBe(false);
  });

  it('returns false when lon is out of range (>180)', () => {
    expect(hasValidPosition({ lat: 10, lon: 181 })).toBe(false);
  });

  it('returns false when lon is out of range (<-180)', () => {
    expect(hasValidPosition({ lat: 10, lon: -181 })).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasValidPosition(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasValidPosition(undefined)).toBe(false);
  });

  it('returns true for boundary coordinates (not 0,0)', () => {
    expect(hasValidPosition({ lat: 90, lon: 180 })).toBe(true);
    expect(hasValidPosition({ lat: -90, lon: -180 })).toBe(true);
  });

  it('returns true for near-zero but not exact zero', () => {
    expect(hasValidPosition({ lat: 0.0001, lon: 0 })).toBe(true);
    expect(hasValidPosition({ lat: 0, lon: 0.0001 })).toBe(true);
  });
});

// ─── normalizeSats ─────────────────────────────────────────────────────────────

describe('normalizeSats', () => {
  it('returns empty array when satellites field is missing', () => {
    expect(normalizeSats({})).toEqual([]);
  });

  it('returns empty array when satellites is empty array', () => {
    expect(normalizeSats({ satellites: [] })).toEqual([]);
  });

  it('returns empty array for null frame', () => {
    expect(normalizeSats(null)).toEqual([]);
  });

  it('normalizes a valid satellite entry', () => {
    const frame = {
      satellites: [{ prn: 5, elevation: 45, azimuth: 90, snr: 35, used: true }],
    };
    const sats = normalizeSats(frame);
    expect(sats).toHaveLength(1);
    expect(sats[0]).toEqual({ prn: 5, elevation: 45, azimuth: 90, snr: 35, used: true });
  });

  it('skips entries with missing prn', () => {
    const frame = {
      satellites: [
        { elevation: 45, azimuth: 90, snr: 35, used: true },
        { prn: 7, elevation: 30, azimuth: 180, snr: 28, used: false },
      ],
    };
    const sats = normalizeSats(frame);
    expect(sats).toHaveLength(1);
    expect(sats[0].prn).toBe(7);
  });

  it('skips entries with non-numeric prn', () => {
    const frame = {
      satellites: [
        { prn: 'G01', elevation: 45, azimuth: 90, snr: 35, used: true },
        { prn: 12, elevation: 50, azimuth: 270, snr: 40, used: true },
      ],
    };
    const sats = normalizeSats(frame);
    expect(sats).toHaveLength(1);
    expect(sats[0].prn).toBe(12);
  });

  it('coerces string numbers in satellite fields', () => {
    const frame = {
      satellites: [{ prn: '3', elevation: '60', azimuth: '45', snr: '30', used: false }],
    };
    const sats = normalizeSats(frame);
    expect(sats[0].prn).toBe(3);
    expect(sats[0].elevation).toBe(60);
    expect(sats[0].azimuth).toBe(45);
    expect(sats[0].snr).toBe(30);
  });

  it('coerces used to boolean', () => {
    const frame = {
      satellites: [
        { prn: 1, used: 1 },
        { prn: 2, used: 0 },
        { prn: 3, used: true },
        { prn: 4, used: false },
      ],
    };
    const sats = normalizeSats(frame);
    expect(sats[0].used).toBe(true);
    expect(sats[1].used).toBe(false);
    expect(sats[2].used).toBe(true);
    expect(sats[3].used).toBe(false);
  });

  it('defaults missing numeric fields to 0', () => {
    const frame = { satellites: [{ prn: 9 }] };
    const sats = normalizeSats(frame);
    expect(sats[0].elevation).toBe(0);
    expect(sats[0].azimuth).toBe(0);
    expect(sats[0].snr).toBe(0);
    expect(sats[0].used).toBe(false);
  });

  it('handles multiple satellites', () => {
    const frame = {
      satellites: [
        { prn: 1, elevation: 10, azimuth: 10, snr: 20, used: true },
        { prn: 2, elevation: 20, azimuth: 20, snr: 30, used: false },
        { prn: 3, elevation: 30, azimuth: 30, snr: 40, used: true },
      ],
    };
    expect(normalizeSats(frame)).toHaveLength(3);
  });
});
