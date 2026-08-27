import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { attachReporterNames } from './reporterNames';

export const REPORT_PAGE_SIZE = 20;

function normalizeReport(row) {
  const { subscriber_count, ...report } = row;
  delete report.total_count;
  return {
    ...report,
    subscribers: [{ count: Number(subscriber_count || 0) }],
    report_images: Array.isArray(report.report_images) ? report.report_images : [],
  };
}

export function useReportFeed(options, resetKey, pageSize = REPORT_PAGE_SIZE) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(Boolean(options.enabled ?? true));
  const [error, setError] = useState(false);

  const cursorRef = useRef(null);
  const loadingRef = useRef(false);
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (replace) => {
    const current = optionsRef.current;
    const enabled = current.enabled ?? true;

    if (!enabled) {
      requestIdRef.current += 1;
      cursorRef.current = null;
      loadingRef.current = false;
      setItems([]);
      setTotal(0);
      setHasMore(false);
      setLoading(false);
      setError(false);
      return;
    }

    if (loadingRef.current && !replace) return;

    const requestId = ++requestIdRef.current;
    const cursor = replace ? null : cursorRef.current;
    if (replace) {
      cursorRef.current = null;
      setItems([]);
      setTotal(0);
      setHasMore(false);
    }
    loadingRef.current = true;
    setLoading(true);
    setError(false);

    try {
      const { data, error: requestError } = await supabase.rpc('get_report_page', {
        p_statuses: current.statuses?.length ? current.statuses : null,
        p_categories: current.categories?.length ? current.categories : null,
        p_search: current.search?.trim() || null,
        p_user_id: current.userId || null,
        p_ids: current.ids?.length ? current.ids : null,
        p_cursor_submitted_at: cursor?.submittedAt || null,
        p_cursor_id: cursor?.id || null,
        p_limit: pageSize + 1,
      });
      if (requestError) throw requestError;
      if (requestId !== requestIdRef.current) return;

      const responseRows = data || [];
      const pageRows = responseRows.slice(0, pageSize);
      const normalized = pageRows.map(normalizeReport);
      const namedRows = current.attachNames === false
        ? normalized
        : await attachReporterNames(normalized);
      if (requestId !== requestIdRef.current) return;

      const last = pageRows.at(-1);
      cursorRef.current = last
        ? { submittedAt: last.submitted_at, id: last.id }
        : cursor;
      setItems((previous) => replace ? namedRows : [...previous, ...namedRows]);
      setTotal(Number(responseRows[0]?.total_count || 0));
      setHasMore(responseRows.length > pageSize);
    } catch (requestError) {
      if (requestId !== requestIdRef.current) return;
      console.error('Failed to load report page:', requestError);
      setError(true);
    } finally {
      if (requestId === requestIdRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [pageSize]);

  useEffect(() => {
    fetchPage(true);
  }, [fetchPage, resetKey]);

  return {
    items,
    total,
    hasMore,
    loading,
    error,
    loadMore: () => fetchPage(false),
    reload: () => fetchPage(true),
  };
}
