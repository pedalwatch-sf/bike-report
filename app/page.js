'use client';

import { useEffect, useRef, useState } from 'react';
import ReportCard from '../components/ReportCard';
import LoadMoreButton from '../components/LoadMoreButton';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/useUser';
import { filterReports } from '../lib/searchReports';
import { SF_CENTER } from '../lib/constants';
import { escapeHtml } from '../lib/escapeHtml';
import { dotIcon } from '../lib/leafletDotIcon';
import { attachReporterNames } from '../lib/reporterNames';
import { CATEGORIES } from '../lib/categories';
import { usePersistedFilter, usePersistedMultiFilter, toggleFilterValue } from '../lib/usePersistedFilter';
import { usePagination } from '../lib/usePagination';

const VIEWS = ['active', 'resolved', 'following'];
const CATEGORY_FILTERS = ['all', ...CATEGORIES];

function RequestError({ title, onRetry }) {
  return (
    <div className="card" role="alert">
      <h3>{title}</h3>
      <p>The request failed. Check your connection and try again.</p>
      <button type="button" className="btn outline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export default function BrowsePage() {
  const user = useUser();
  const [suggestions, setSuggestions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = usePersistedFilter('browse-view', 'active', VIEWS);
  const [categoryFilters, setCategoryFilters] = usePersistedMultiFilter('browse-category-filters', ['all'], CATEGORY_FILTERS);
  const [categoryFiltersOpen, setCategoryFiltersOpen] = useState(() => !categoryFilters.includes('all'));
  const [myInterests, setMyInterests] = useState(new Set());
  const [followingReports, setFollowingReports] = useState(undefined);
  const [followingError, setFollowingError] = useState(false);
  const [updatedIds, setUpdatedIds] = useState(new Set());
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (user) {
      loadFollowing();
    } else if (user === null) {
      setMyInterests(new Set());
      setFollowingReports([]);
      setFollowingError(false);
      setUpdatedIds(new Set());
    }
  }, [user]);

  // Loaded eagerly (not just when the Following pill is opened) so its
  // count and "Updated" dot are accurate as soon as Browse loads.
  async function loadFollowing() {
    setFollowingReports(undefined);
    setFollowingError(false);

    try {
      const { data: subs, error: subscriptionsError } = await supabase.rpc('get_my_subscriptions');
      if (subscriptionsError) throw subscriptionsError;

      const ids = (subs || []).map((s) => s.suggestion_id);
      setMyInterests(new Set(ids));
      if (ids.length === 0) {
        setFollowingReports([]);
        setUpdatedIds(new Set());
        return;
      }

      const { data, error: reportsError } = await supabase
        .from('suggestions')
        .select('*, subscribers(count), report_images(url)')
        .in('id', ids);
      if (reportsError) throw reportsError;

      const bySubscribedOrder = ids
        .map((id) => (data || []).find((r) => r.id === id))
        .filter(Boolean);
      setFollowingReports(await attachReporterNames(bySubscribedOrder));
      setUpdatedIds(new Set((subs || []).filter((s) => s.has_update).map((s) => s.suggestion_id)));
    } catch (error) {
      console.error('Failed to load followed reports:', error);
      setFollowingReports([]);
      setFollowingError(true);
    }
  }

  // Shared by both the Active/Resolved cards and the Following cards, so
  // following/unfollowing from either place keeps myInterests and the
  // Following pill's own list in sync with each other.
  function handleFollowingChange(report, nowFollowing) {
    setMyInterests((prev) => {
      const next = new Set(prev);
      if (nowFollowing) next.add(report.id);
      else next.delete(report.id);
      return next;
    });
    setFollowingReports((prev) => {
      const list = prev || [];
      if (nowFollowing) {
        return list.some((r) => r.id === report.id) ? list : [report, ...list];
      }
      return list.filter((r) => r.id !== report.id);
    });
    if (!nowFollowing) {
      setUpdatedIds((prev) => {
        const next = new Set(prev);
        next.delete(report.id);
        return next;
      });
    }
  }

  useEffect(() => {
    if (loaded) drawMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  async function loadSuggestions() {
    setLoaded(false);
    setSuggestionsError(false);

    try {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*, subscribers(count), report_images(url)')
        .in('status', ['approved', 'resolved'])
        .order('submitted_at', { ascending: false });
      if (error) throw error;

      setSuggestions(await attachReporterNames(data || []));
    } catch (error) {
      console.error('Failed to load reports:', error);
      setSuggestionsError(true);
    } finally {
      setLoaded(true);
    }
  }

  async function drawMap() {
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }
    const L = (await import('leaflet')).default;
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView(SF_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    suggestions.forEach((s) => {
      if (s.lat && s.lng) {
        const color = s.status === 'resolved' ? 'var(--yellow)' : 'var(--teal)';
        L.marker([s.lat, s.lng], { icon: dotIcon(L, color) })
          .addTo(map)
          .bindPopup(
            `<b>${escapeHtml(s.title)}</b><br/><a href="/report/${s.id}" style="color:var(--teal)">View report →</a>`
          );
      }
    });
    mapInstance.current = map;
  }

  const filtered = filterReports(suggestions, search, categoryFilters);
  const active = filtered.filter((s) => s.status === 'approved');
  const resolved = filtered.filter((s) => s.status === 'resolved');
  const visible = view === 'active' ? active : resolved;
  const visibleFollowing = filterReports(followingReports || [], search, categoryFilters);
  const activeCategoryFilterCount = categoryFilters.includes('all') ? 0 : categoryFilters.length;
  const currentList = view === 'following' ? visibleFollowing : visible;
  const page = usePagination(currentList, `${view}|${search}|${categoryFilters.join(',')}`);

  return (
    <main>
      <div className="content">
        <div ref={mapRef} id="map" />
        <p className="hint" style={{ margin: '8px 0 14px' }}>
          <span style={{ color: 'var(--teal)' }}>●</span> active · <span style={{ color: 'var(--yellow)' }}>●</span> resolved
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports by title, description, or category…"
        />
        <div className="filter-row">
          <button className={`filter-btn ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
            Active ({active.length})
          </button>
          <button className={`filter-btn ${view === 'resolved' ? 'active' : ''}`} onClick={() => setView('resolved')}>
            Resolved ({resolved.length})
          </button>
          <button className={`filter-btn ${view === 'following' ? 'active' : ''}`} onClick={() => setView('following')}>
            Following{Array.isArray(followingReports) ? ` (${visibleFollowing.length})` : ''}
            {updatedIds.size > 0 && <span className="stat-dot" style={{ background: 'var(--coral)', marginLeft: 5 }} />}
          </button>
          <button
            type="button"
            className={`filter-btn ${categoryFiltersOpen ? 'active' : ''}`}
            onClick={() => setCategoryFiltersOpen((v) => !v)}
          >
            Category{activeCategoryFilterCount > 0 && ` (${activeCategoryFilterCount})`}
          </button>
        </div>
        {categoryFiltersOpen && (
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <label style={{ margin: 0 }}>Category</label>
              {activeCategoryFilterCount > 0 && (
                <button type="button" className="btn outline" onClick={() => setCategoryFilters(['all'])}>
                  Clear
                </button>
              )}
            </div>
            <div className="filter-row" style={{ marginTop: 10 }}>
              {CATEGORY_FILTERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`filter-btn ${categoryFilters.includes(c) ? 'active' : ''}`}
                  onClick={() => setCategoryFilters((prev) => toggleFilterValue(prev, c))}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'following' ? (
          <>
            {(user === undefined || followingReports === undefined) && !followingError && <p className="hint">Loading…</p>}
            {user && followingError && (
              <RequestError title="Couldn’t load followed reports" onRetry={loadFollowing} />
            )}
            {user === null && (
              <div className="lock">
                <h3>Not signed in</h3>
                <p className="hint">Sign in to see the reports you&apos;re following.</p>
                <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
                  <a className="btn" href="/login">Sign in</a>
                  <a className="btn outline" href="/signup">Create account</a>
                </div>
              </div>
            )}
            {user && !followingError && Array.isArray(followingReports) && followingReports.length === 0 && (
              <div className="empty">
                You&apos;re not following any reports yet.<br />
                Tap &quot;I&apos;m interested&quot; on a report to get updates here.
              </div>
            )}
            {user && !followingError && Array.isArray(followingReports) && followingReports.length > 0 && visibleFollowing.length === 0 && (
              <div className="empty">No followed reports match your search or category filters.</div>
            )}
            {user &&
              !followingError &&
              page.visible.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  following
                  updated={updatedIds.has(r.id)}
                  onFollowingChange={(nowFollowing) => handleFollowingChange(r, nowFollowing)}
                />
              ))}
            {user && !followingError && (
              <LoadMoreButton hasMore={page.hasMore} remaining={page.total - page.visible.length} onClick={page.loadMore} />
            )}
          </>
        ) : (
          <>
            {!loaded && <p className="hint">Loading…</p>}
            {suggestionsError ? (
              <RequestError title="Couldn’t load reports" onRetry={loadSuggestions} />
            ) : (
              <>
                {loaded && visible.length === 0 && (
                  <div className="empty">
                    {search.trim()
                      ? 'No reports match your search.'
                      : view === 'active'
                      ? <>No active reports yet.<br />Be the first to submit one.</>
                      : 'No resolved reports yet.'}
                  </div>
                )}
                {page.visible.map((s) => (
                  <ReportCard
                    key={s.id}
                    report={s}
                    following={myInterests.has(s.id)}
                    onFollowingChange={(nowFollowing) => handleFollowingChange(s, nowFollowing)}
                  />
                ))}
                <LoadMoreButton hasMore={page.hasMore} remaining={page.total - page.visible.length} onClick={page.loadMore} />
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
