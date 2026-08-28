// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('../../lib/useUser', () => ({
  useUser: () => ({ id: 'test-user' }),
}));

import { supabase } from '../../lib/supabaseClient';
import InterestButton from '../InterestButton';

beforeEach(() => {
  supabase.rpc.mockReset();
  supabase.rpc.mockResolvedValue({ error: null });
});

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

  // Callers pass a `count` loaded once and never refetched, so after a toggle
  // the parent echoes back an updated `following` alongside that stale count.
  // Re-seeding from those props would undo the optimistic count.
  it('keeps the optimistic count when the parent echoes the toggle back with a stale count', async () => {
    const { rerender } = render(
      <InterestButton suggestionId="report-1" count={2} following={false} />
    );

    fireEvent.click(screen.getByRole('button', { name: "I'm interested" }));

    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());

    rerender(<InterestButton suggestionId="report-1" count={2} following />);

    expect(screen.getByRole('button', { name: "You're following" })).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('keeps the optimistic count after unfollowing', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { rerender } = render(
      <InterestButton suggestionId="report-1" count={5} following />
    );

    fireEvent.click(screen.getByRole('button', { name: "You're following" }));

    await waitFor(() => expect(screen.getByText('4')).toBeTruthy());

    rerender(<InterestButton suggestionId="report-1" count={5} following={false} />);

    expect(screen.getByRole('button', { name: "I'm interested" })).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();

    window.confirm.mockRestore();
  });

  it('re-seeds from props when reused for a different report', async () => {
    const { rerender } = render(
      <InterestButton suggestionId="report-1" count={2} following={false} />
    );

    fireEvent.click(screen.getByRole('button', { name: "I'm interested" }));
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());

    rerender(<InterestButton suggestionId="report-2" count={9} following={false} />);

    expect(screen.getByRole('button', { name: "I'm interested" })).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });
});
