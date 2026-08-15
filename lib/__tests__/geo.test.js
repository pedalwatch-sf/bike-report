import { describe, it, expect } from 'vitest';
import { haversineMeters, DUPLICATE_RADIUS_METERS } from '../geo';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(37.7749, -122.4194, 37.7749, -122.4194)).toBe(0);
  });

  it('matches the well-known ~111.2m per 0.001 degree of latitude', () => {
    const d = haversineMeters(0, 0, 0.001, 0);
    expect(d).toBeCloseTo(111.19, 0);
  });
});

describe('DUPLICATE_RADIUS_METERS', () => {
  it('is a positive distance', () => {
    expect(DUPLICATE_RADIUS_METERS).toBeGreaterThan(0);
  });
});
