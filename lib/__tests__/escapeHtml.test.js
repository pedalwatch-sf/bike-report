import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../escapeHtml';

describe('escapeHtml', () => {
  it('escapes ampersands and angle brackets', () => {
    expect(escapeHtml('<b>A & B</b>')).toBe('&lt;b&gt;A &amp; B&lt;/b&gt;');
  });

  it('leaves text with no special characters unchanged', () => {
    expect(escapeHtml('Missing lane on 5th and Oak')).toBe('Missing lane on 5th and Oak');
  });

  it('coerces non-string input', () => {
    expect(escapeHtml(42)).toBe('42');
  });
});
