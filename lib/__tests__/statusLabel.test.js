import { describe, it, expect } from 'vitest';
import { statusLabel } from '../statusLabel';

describe('statusLabel', () => {
  it('shows "Active" for approved, the public-facing rename', () => {
    expect(statusLabel('approved')).toBe('Active');
  });

  it('title-cases the other known statuses', () => {
    expect(statusLabel('pending')).toBe('Pending');
    expect(statusLabel('rejected')).toBe('Rejected');
    expect(statusLabel('resolved')).toBe('Resolved');
    expect(statusLabel('withdrawn')).toBe('Withdrawn');
  });

  it('falls back to the raw value for anything unrecognized', () => {
    expect(statusLabel('something-else')).toBe('something-else');
  });
});
