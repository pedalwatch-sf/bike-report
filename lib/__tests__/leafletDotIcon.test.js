import { describe, it, expect, vi } from 'vitest';
import { dotIcon } from '../leafletDotIcon';

describe('dotIcon', () => {
  it('builds a divIcon with the given color baked into the html', () => {
    const divIcon = vi.fn((opts) => opts);
    const L = { divIcon };

    const icon = dotIcon(L, 'var(--teal)');

    expect(divIcon).toHaveBeenCalledTimes(1);
    expect(icon.html).toContain('var(--teal)');
    expect(icon.iconSize).toEqual([16, 16]);
    expect(icon.iconAnchor).toEqual([8, 8]);
  });
});
