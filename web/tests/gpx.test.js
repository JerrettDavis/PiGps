import { describe, it, expect } from 'vitest';
import { pointsToGpx } from '../src/core/gpx.js';

const pt = (overrides = {}) => ({
  lat: 51.5074,
  lon: -0.1278,
  altM: 10.5,
  speedKph: 5.2,
  courseDeg: 90,
  timeMs: 1700000000000,
  utcIso: '2023-11-14T22:13:20Z',
  ...overrides,
});

describe('pointsToGpx', () => {
  it('0 points → valid GPX with empty <trkseg>', () => {
    const out = pointsToGpx([]);
    expect(out).toContain('<?xml version="1.0"');
    expect(out).toContain('<gpx');
    expect(out).toContain('<trkseg>');
    expect(out).toContain('</trkseg>');
    expect(out).not.toContain('<trkpt');
  });

  it('contains GPX 1.1 namespace', () => {
    const out = pointsToGpx([]);
    expect(out).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
    expect(out).toContain('version="1.1"');
  });

  it('many points → all <trkpt> present in order', () => {
    const points = [
      pt({ lat: 1.1, lon: 2.2 }),
      pt({ lat: 3.3, lon: 4.4 }),
      pt({ lat: 5.5, lon: 6.6 }),
    ];
    const out = pointsToGpx(points);
    const matches = [...out.matchAll(/<trkpt/g)];
    expect(matches.length).toBe(3);
    // Order preserved
    const idx1 = out.indexOf('lat="1.1"');
    const idx2 = out.indexOf('lat="3.3"');
    const idx3 = out.indexOf('lat="5.5"');
    expect(idx1).toBeLessThan(idx2);
    expect(idx2).toBeLessThan(idx3);
  });

  it('lat/lon sign and decimals correct', () => {
    const out = pointsToGpx([pt({ lat: -33.8688, lon: 151.2093 })]);
    expect(out).toContain('lat="-33.8688"');
    expect(out).toContain('lon="151.2093"');
    // No locale commas
    expect(out).not.toMatch(/lat="[^"]*,/);
  });

  it('<time> present when utcIso set', () => {
    const out = pointsToGpx([pt({ utcIso: '2023-11-14T22:13:20Z' })]);
    expect(out).toContain('<time>2023-11-14T22:13:20Z</time>');
  });

  it('<time> absent when utcIso is null', () => {
    const out = pointsToGpx([pt({ utcIso: null })]);
    expect(out).not.toContain('<time>');
  });

  it('uses default name and creator', () => {
    const out = pointsToGpx([]);
    expect(out).toContain('<name>PiGps Track</name>');
    expect(out).toContain('creator="PiGps"');
  });

  it('uses provided name and creator', () => {
    const out = pointsToGpx([], { name: 'My Trip', creator: 'TestApp' });
    expect(out).toContain('<name>My Trip</name>');
    expect(out).toContain('creator="TestApp"');
  });

  it('XML-escapes name and creator', () => {
    const out = pointsToGpx([], { name: 'A & B <test>', creator: 'Me&You' });
    expect(out).toContain('A &amp; B &lt;test&gt;');
    expect(out).toContain('Me&amp;You');
    expect(out).not.toContain('Me&You');
  });

  it('ele uses altM value', () => {
    const out = pointsToGpx([pt({ altM: 123.45 })]);
    expect(out).toContain('<ele>123.45</ele>');
  });
});
