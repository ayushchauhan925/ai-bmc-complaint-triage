import { describe, expect, test } from 'vitest';
import { directionsUrl, formatDistance, haversineMeters } from './geo';

describe('geo helpers', () => {
  test('haversine matches known distances', () => {
    expect(haversineMeters(19.076, 72.8777, 19.076, 72.8777)).toBe(0);
    // ~111.2 km per degree of latitude
    expect(haversineMeters(19, 72.9, 20, 72.9)).toBeGreaterThan(110900);
    expect(haversineMeters(19, 72.9, 20, 72.9)).toBeLessThan(111500);
    // symmetric
    expect(haversineMeters(19.0, 72.8, 19.1, 72.9)).toBeCloseTo(haversineMeters(19.1, 72.9, 19.0, 72.8), 6);
  });

  test('formatDistance is human friendly', () => {
    expect(formatDistance(42)).toBe('40 m');
    expect(formatDistance(4)).toBe('10 m');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(25000)).toBe('25 km');
    expect(formatDistance(Number.NaN)).toBe('');
  });

  test('directions link carries the destination', () => {
    expect(directionsUrl(19.1, 72.9)).toContain('destination=19.1,72.9');
  });
});
