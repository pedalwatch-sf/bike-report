import { useEffect, useState } from 'react';

// Keeps a single-choice pill/tab selection across page refreshes -- read
// once on mount from localStorage, written back on every change. Falls
// back to defaultValue when nothing's stored yet or a stored value no
// longer matches an allowed option (e.g. after a filter's choices change).
export function usePersistedFilter(key, defaultValue, allowed) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    const stored = window.localStorage.getItem(key);
    return stored && allowed.includes(stored) ? stored : defaultValue;
  });
  useEffect(() => {
    window.localStorage.setItem(key, value);
  }, [key, value]);
  return [value, setValue];
}

// Same idea, but for a pill row where more than one option can be active
// at once. Always holds at least one value -- ['all'] means no filtering.
export function usePersistedMultiFilter(key, defaultValue, allowed) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = JSON.parse(window.localStorage.getItem(key));
      if (Array.isArray(stored) && stored.length > 0 && stored.every((v) => allowed.includes(v))) {
        return stored;
      }
    } catch {
      // fall through to default
    }
    return defaultValue;
  });
  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue];
}

// Clicking 'all' resets to just ['all']; clicking any other pill toggles
// it on/off within the current selection (dropping 'all' first), and
// falls back to ['all'] if that empties the selection.
export function toggleFilterValue(current, value) {
  if (value === 'all') return ['all'];
  const withoutAll = current.filter((v) => v !== 'all');
  const next = withoutAll.includes(value)
    ? withoutAll.filter((v) => v !== value)
    : [...withoutAll, value];
  return next.length > 0 ? next : ['all'];
}
