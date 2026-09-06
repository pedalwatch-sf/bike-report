// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ markers: [], map: null, group: null, tileError: null }));
vi.mock('leaflet', () => ({ default: {
  map: vi.fn(() => fake.map),
  tileLayer: () => ({ addTo() { return this; }, on(_event, callback) { fake.tileError = callback; return this; } }),
  featureGroup: () => fake.group,
  divIcon: (options) => options,
  marker: (coords, options) => {
    const marker = { coords, options, addTo() { fake.markers.push(this); return this; }, bindPopup(popup) { this.popup = popup; return this; } };
    return marker;
  },
} }));

import ReportMap from '../ReportMap';

const report = { id: 'report-a', title: 'Damaged lane', lat: 37.77, lng: -122.42, status: 'approved' };
beforeEach(() => {
  fake.markers = [];
  fake.map = { setView: vi.fn().mockReturnThis(), fitBounds: vi.fn(), remove: vi.fn() };
  fake.group = { addTo() { return this; }, clearLayers() { fake.markers = []; }, getBounds: () => ({ isValid: () => fake.markers.length > 0 }) };
});
afterEach(cleanup);

describe('ReportMap', () => {
  it('replaces markers when the matching feed changes without recreating the map', async () => {
    const { rerender } = render(<ReportMap reports={[report]} total={21} loading={false} />);
    await waitFor(() => expect(fake.markers).toHaveLength(1));
    expect(screen.getByText(/Load more below/)).toBeTruthy();
    rerender(<ReportMap reports={[{ ...report, id: 'report-b', status: 'resolved' }]} total={1} loading={false} />);
    await waitFor(() => expect(fake.markers[0].options.icon.html).toContain('var(--yellow)'));
    expect(fake.markers).toHaveLength(1);
    expect(fake.map.remove).not.toHaveBeenCalled();
    rerender(<ReportMap reports={[]} total={0} loading={false} />);
    await waitFor(() => expect(fake.markers).toHaveLength(0));
  });

  it('renders report titles as text and skips records without usable coordinates', async () => {
    render(<ReportMap reports={[{ ...report, title: '<img src=x onerror=alert(1)>' }, { ...report, lat: null }]} total={2} loading={false} />);
    await waitFor(() => expect(fake.markers).toHaveLength(1));
    expect(fake.markers[0].popup.querySelector('img')).toBeNull();
    expect(fake.markers[0].popup.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(fake.markers[0].popup.querySelector('a').getAttribute('href')).toBe('/report/report-a');
  });

  it('fits the current report locations and cleans up on navigation', async () => {
    const { unmount } = render(<ReportMap reports={[report]} total={1} loading={false} />);
    await waitFor(() => expect(fake.markers).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Fit reports' }));
    expect(fake.map.fitBounds).toHaveBeenCalled();
    unmount();
    expect(fake.map.remove).toHaveBeenCalledTimes(1);
  });

  it('offers recovery after tile failures and restores the matching markers', async () => {
    render(<ReportMap reports={[report]} total={1} loading={false} />);
    await waitFor(() => expect(fake.markers).toHaveLength(1));
    act(() => fake.tileError());
    expect(screen.getByRole('alert').textContent).toContain('You can still browse');
    fireEvent.click(screen.getByRole('button', { name: 'Retry map' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await waitFor(() => expect(fake.markers).toHaveLength(1));
    expect(fake.map.remove).toHaveBeenCalledTimes(1);
  });
});
