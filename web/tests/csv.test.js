import { describe, it, expect } from 'vitest';
import { pointsToCsv } from '../src/core/csv.js';

const pt = (overrides = {}) => ({
  lat: 51.5074,
  lon: -0.1278,
  altM: 10.5,
  speedKph: 5.2,
  courseDeg: 90.0,
  timeMs: 1700000000000,
  utcIso: '2023-11-14T22:13:20Z',
  ...overrides,
});

const HEADER = 'time_iso,lat,lon,alt_m,speed_kph,course_deg';

describe('pointsToCsv', () => {
  it('0 points → header row only', () => {
    const out = pointsToCsv([]);
    expect(out).toBe(HEADER);
  });

  it('header always present', () => {
    const out = pointsToCsv([pt()]);
    expect(out.startsWith(HEADER)).toBe(true);
  });

  it('one row per point', () => {
    const out = pointsToCsv([pt(), pt(), pt()]);
    const lines = out.split('\n');
    expect(lines.length).toBe(4); // header + 3 rows
  });

  it('column order: time_iso,lat,lon,alt_m,speed_kph,course_deg', () => {
    const p = pt({
      lat: 1.0,
      lon: 2.0,
      altM: 3.0,
      speedKph: 4.0,
      courseDeg: 5.0,
      utcIso: '2023-01-01T00:00:00Z',
    });
    const out = pointsToCsv([p]);
    const lines = out.split('\n');
    expect(lines[1]).toBe('2023-01-01T00:00:00Z,1,2,3,4,5');
  });

  it('utcIso null → empty time field', () => {
    const out = pointsToCsv([pt({ utcIso: null })]);
    const dataRow = out.split('\n')[1];
    expect(dataRow.startsWith(',')).toBe(true); // first column empty
  });

  it('negative lat/lon unmodified', () => {
    const out = pointsToCsv([pt({ lat: -33.8688, lon: -70.6693 })]);
    const dataRow = out.split('\n')[1];
    expect(dataRow).toContain('-33.8688');
    expect(dataRow).toContain('-70.6693');
  });

  it('uses . decimal not , (locale safe)', () => {
    const out = pointsToCsv([pt({ lat: 51.5074, lon: -0.1278 })]);
    expect(out).toContain('51.5074');
    expect(out).not.toMatch(/\d,\d{4}/); // no locale-style comma in numbers
  });

  it('correct values for all columns', () => {
    const p = pt({
      utcIso: '2024-06-01T12:00:00Z',
      lat: 48.8566,
      lon: 2.3522,
      altM: 35.0,
      speedKph: 12.5,
      courseDeg: 270.0,
    });
    const out = pointsToCsv([p]);
    const dataRow = out.split('\n')[1];
    const cols = dataRow.split(',');
    expect(cols[0]).toBe('2024-06-01T12:00:00Z');
    expect(parseFloat(cols[1])).toBeCloseTo(48.8566);
    expect(parseFloat(cols[2])).toBeCloseTo(2.3522);
    expect(parseFloat(cols[3])).toBeCloseTo(35.0);
    expect(parseFloat(cols[4])).toBeCloseTo(12.5);
    expect(parseFloat(cols[5])).toBeCloseTo(270.0);
  });
});
