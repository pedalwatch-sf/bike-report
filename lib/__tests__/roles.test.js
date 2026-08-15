import { describe, it, expect } from 'vitest';
import { roleLevel, isModOrAdmin } from '../roles';

describe('roleLevel', () => {
  it('ranks owner > admin > moderator > user', () => {
    expect(roleLevel('owner')).toBeGreaterThan(roleLevel('admin'));
    expect(roleLevel('admin')).toBeGreaterThan(roleLevel('moderator'));
    expect(roleLevel('moderator')).toBeGreaterThan(roleLevel('user'));
  });

  it('treats unknown or missing roles as user level', () => {
    expect(roleLevel(undefined)).toBe(roleLevel('user'));
    expect(roleLevel('bogus')).toBe(roleLevel('user'));
  });
});

describe('isModOrAdmin', () => {
  it('is true for moderator, admin, and owner', () => {
    expect(isModOrAdmin('moderator')).toBe(true);
    expect(isModOrAdmin('admin')).toBe(true);
    expect(isModOrAdmin('owner')).toBe(true);
  });

  it('is false for plain users or no role', () => {
    expect(isModOrAdmin('user')).toBe(false);
    expect(isModOrAdmin(undefined)).toBe(false);
  });
});
