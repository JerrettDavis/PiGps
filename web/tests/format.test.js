import { describe, it, expect } from 'vitest';
import { fmtNumber, fmtCoord, utcDisplay, qualityName, fixModeName } from '../src/core/format.js';

describe('fmtNumber', () => {
  it('formats a finite number to 5 decimal places by default', () => {
    expect(fmtNumber(1.23456789)).toBe('1.23457');
  });

  it('appends suffix when provided', () => {
    expect(fmtNumber(3.14, 2, ' km')).toBe('3.14 km');
  });

  it('respects custom digits', () => {
    expect(fmtNumber(100, 0)).toBe('100');
    expect(fmtNumber(1.5, 3, '°')).toBe('1.500°');
  });

  it('returns - for NaN', () => {
    expect(fmtNumber(NaN)).toBe('-');
  });

  it('returns - for undefined', () => {
    expect(fmtNumber(undefined)).toBe('-');
  });

  it('returns - for null', () => {
    expect(fmtNumber(null)).toBe('-');
  });

  it('returns - for Infinity', () => {
    expect(fmtNumber(Infinity)).toBe('-');
  });

  it('returns - for -Infinity', () => {
    expect(fmtNumber(-Infinity)).toBe('-');
  });

  it('returns - for a string that looks like a number', () => {
    expect(fmtNumber('3.14')).toBe('-');
  });

  it('formats zero', () => {
    expect(fmtNumber(0, 2)).toBe('0.00');
  });

  it('formats negative numbers', () => {
    expect(fmtNumber(-45.6789, 3)).toBe('-45.679');
  });
});

describe('fmtCoord', () => {
  it('formats a finite number to 7 decimal places', () => {
    expect(fmtCoord(51.5074000)).toBe('51.5074000');
  });

  it('formats a negative coordinate', () => {
    expect(fmtCoord(-73.9857000)).toBe('-73.9857000');
  });

  it('returns - for NaN', () => {
    expect(fmtCoord(NaN)).toBe('-');
  });

  it('returns - for undefined', () => {
    expect(fmtCoord(undefined)).toBe('-');
  });

  it('returns - for null', () => {
    expect(fmtCoord(null)).toBe('-');
  });

  it('returns - for Infinity', () => {
    expect(fmtCoord(Infinity)).toBe('-');
  });

  it('returns - for a string', () => {
    expect(fmtCoord('51.5')).toBe('-');
  });

  it('formats zero to 7 decimal places', () => {
    expect(fmtCoord(0)).toBe('0.0000000');
  });
});

describe('utcDisplay', () => {
  it('returns a formatted UTC string for valid date and time', () => {
    expect(utcDisplay('010125', '123456.00')).toBe('2025-01-01 12:34:56 UTC');
  });

  it('handles different valid dates', () => {
    expect(utcDisplay('311299', '235959.99')).toBe('2099-12-31 23:59:59 UTC');
  });

  it('returns - when utcTime is empty string', () => {
    expect(utcDisplay('010125', '')).toBe('-');
  });

  it('returns - when utcDate is empty string', () => {
    expect(utcDisplay('', '123456.00')).toBe('-');
  });

  it('returns - when both are empty', () => {
    expect(utcDisplay('', '')).toBe('-');
  });

  it('returns - when utcTime is undefined', () => {
    expect(utcDisplay('010125', undefined)).toBe('-');
  });

  it('returns - when utcDate is undefined', () => {
    expect(utcDisplay(undefined, '123456.00')).toBe('-');
  });

  it('returns - when utcDate is too short', () => {
    expect(utcDisplay('0101', '123456.00')).toBe('-');
  });

  it('returns - when utcTime is too short', () => {
    expect(utcDisplay('010125', '1234')).toBe('-');
  });

  it('returns - when utcDate contains non-digits', () => {
    expect(utcDisplay('xx0125', '123456.00')).toBe('-');
  });

  it('uses 20yy assumption for year', () => {
    expect(utcDisplay('010100', '000000.00')).toBe('2000-01-01 00:00:00 UTC');
  });
});

describe('qualityName', () => {
  it('maps 0 to invalid', () => expect(qualityName(0)).toBe('invalid'));
  it('maps 1 to GPS', () => expect(qualityName(1)).toBe('GPS'));
  it('maps 2 to DGPS', () => expect(qualityName(2)).toBe('DGPS'));
  it('maps 3 to PPS', () => expect(qualityName(3)).toBe('PPS'));
  it('maps 4 to RTK fixed', () => expect(qualityName(4)).toBe('RTK fixed'));
  it('maps 5 to RTK float', () => expect(qualityName(5)).toBe('RTK float'));
  it('maps 6 to estimated', () => expect(qualityName(6)).toBe('estimated'));
  it('maps 7 to manual', () => expect(qualityName(7)).toBe('manual'));
  it('maps 8 to simulation', () => expect(qualityName(8)).toBe('simulation'));
  it('maps unknown number to unknown', () => expect(qualityName(99)).toBe('unknown'));
  it('maps negative number to unknown', () => expect(qualityName(-1)).toBe('unknown'));
  it('maps undefined to unknown', () => expect(qualityName(undefined)).toBe('unknown'));
  it('maps string to unknown', () => expect(qualityName('GPS')).toBe('unknown'));
});

describe('fixModeName', () => {
  it('maps 3 to 3D', () => expect(fixModeName(3)).toBe('3D'));
  it('maps 2 to 2D', () => expect(fixModeName(2)).toBe('2D'));
  it('maps 1 to No fix', () => expect(fixModeName(1)).toBe('No fix'));
  it('maps 0 to No fix', () => expect(fixModeName(0)).toBe('No fix'));
  it('maps undefined to No fix', () => expect(fixModeName(undefined)).toBe('No fix'));
  it('maps 4 to No fix', () => expect(fixModeName(4)).toBe('No fix'));
});
