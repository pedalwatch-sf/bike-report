import { useEffect, useState } from 'react';

export const DEFAULT_PAGE_SIZE = 20;

// Client-side "Load more" pagination over an already-filtered list --
// search and filters still run over the full loaded dataset (so results
// stay correct), this only limits how many cards render/mount at once.
// resetKey should change whenever the caller's search/filter inputs
// change, so the visible count snaps back to pageSize instead of
// staying stuck at a stale offset into a newly-filtered list.
export function usePagination(items, resetKey, pageSize = DEFAULT_PAGE_SIZE) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, pageSize]);
  return {
    visible: items.slice(0, visibleCount),
    hasMore: visibleCount < items.length,
    loadMore: () => setVisibleCount((c) => c + pageSize),
    total: items.length,
  };
}
