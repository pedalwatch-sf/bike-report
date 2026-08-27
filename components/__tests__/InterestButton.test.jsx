// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('../../lib/useUser', () => ({
  useUser: () => ({ id: 'test-user' }),
}));

import InterestButton from '../InterestButton';

afterEach(cleanup);

describe('InterestButton', () => {
  it('resynchronizes when asynchronously loaded following data arrives', () => {
    const { rerender } = render(
      <InterestButton suggestionId="report-1" count={2} following={false} />
    );

    expect(screen.getByRole('button', { name: "I'm interested" })).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    rerender(<InterestButton suggestionId="report-1" count={3} following />);

    expect(screen.getByRole('button', { name: "You're following" })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });
});
