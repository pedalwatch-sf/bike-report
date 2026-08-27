'use client';

import { useEffect, useRef, useState } from 'react';
import ReportCard from '../components/ReportCard';
import LoadMoreButton from '../components/LoadMoreButton';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/useUser';
import { SF_CENTER } from '../lib/constants';
import { escapeHtml } from '../lib/escapeHtml';
import { dotIcon } from '../lib/leafletDotIcon';
import { CATEGORIES } from '../lib/categories';
import { usePersistedFilter, usePersistedMultiFilter, toggleFilterValue } from '../lib/usePersistedFilter';
import { useReportFeed } from '../lib/useReportFeed';

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
  const [mapSuggestions, setMapSuggestions] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [view, setView] = usePersistedFilter('browse-view', 'active', VIEWS);
  const [categoryFilters, setCategoryFilters] = usePersistedMultiFilter('browse-category-filters', ['all'], CATEGORY_FILTERS);
  const [categoryFiltersOpen, setCategoryFiltersOpen] = useState(() => !categoryFilters.includes('all'));
  const [myInterests, setMyInterests] = useState(new Set());
  const [followingSubscriptions, setFollowingSubscriptions] = useState(undefined);
  const [followingError, setFollowingError] = useState(false);
  const [updatedIds, setUpdatedIds] = useState(new Set());
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadMapSuggestions();
  }, []);

  useEffect(() => {
    if (user) {
      loadFollowing();
    } else if (user === null) {
      setMyInterests(new Set());
      setFollowingSubscriptions([]);
      setFollowingError(false);
      setUpdatedIds(new Set());
    }
  }, [user]);

  const selectedCategories = categoryFilters.includes('all') ? null : categoryFilters;
  const filterKey = `${debouncedSearch}|${categoryFilters.join(',')}`;
  const activeFeed = useReportFeed(
    { statuses: ['approved'], categories: selectedCategories, search: debouncedSearch },
    `active|${filterKey}`
  );
  const resolvedFeed = useReportFeed(
    { statuses: ['resolved'], categories: selectedCategories, search: debouncedSearch },
    `resolved|${filterKey}`
  );

  const followingIds = (followingSubscriptions || []).map((subscription) => subscription.suggestion_id);
  const followingFeed = useReportFeed(
    {
      ids: followingIds,
      categories: selectedCategories,
      search: debouncedSearch,
      enabled: Boolean(user) && followingIds.length > 0,
    },
    `following|${followingIds.join(',')}|${filterKey}`
  );

  async function loadFollowing() {
    setFollowingSubscriptions(undefined);
    setFollowingError(false);

    try {
      const { data, error } = await supabase.rpc('get_my_subscriptions');
      if (error) throw error;
      const subscriptions = data || [];
      setFollowingSubscriptions(subscriptions);
      setMyInterests(new Set(subscriptions.map((subscription) => subscription.suggestion_id)));
      setUpdatedIds(new Set(
        subscriptions
          .filter((subscription) => subscription.has_update)
          .map((subscription) => subscription.suggestion_id)
      ));
    } catch (error) {
      console.error('Failed to load followed reports:', error);
      setFollowingSubscriptions([]);
      setFollowingError(true);
    }
  }

  function handleFollowingChange(report, nowFollowing) {
    setMyInterests((previous) => {
      const next = new Set(previous);
      if (nowFollowing) next.add(report.id);
      else next.delete(report.id);
      return next;
    });
    setFollowingSubscriptions((previous) => {
      const subscriptions = previous || [];
      if (nowFollowing) {
        if (subscriptions.some((subscription) => subscription.suggestion_id === report.id)) {
          return subscriptions;
        }
        return [
          {
            suggestion_id: report.id,
            added_at: new Date().toISOString(),
            last_seen_status: report.status,
            has_update: false,
          },
          ...subscriptions,
        ];
      }
      return subscriptions.filter((subscription) => subscription.suggestion_id !== report.id);
    });
    if (!nowFollowing) {
      setUpdatedIds((previous) => {
        const next = new Set(previous);
        next.delete(report.id);
        return next;
      });
    }
  }

  async function loadMapSuggestions() {
    setMapLoaded(false);
    setMapError(false);
    const { data, error } = await supabase
      .from('suggestions')
      .select('id, title, status, lat, lng')
      .in('status', ['approved', 'resolved'])
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Failed to load map markers:', error);
      setMapSuggestions([]);
      setMapError(true);
    } else {
      setMapSuggestions(data || []);
    }
    setMapLoaded(true);
  }

  useEffect(() => {
    if (mapLoaded) drawMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, mapSuggestions]);

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
    mapSuggestions.forEach((suggestion) => {
      if (suggestion.lat && suggestion.lng) {
        const color = suggestion.status === 'resolved' ? 'var(--yellow)' : 'var(--teal)';
        L.marker([suggestion.lat, suggestion.lng], { icon: dotIcon(L, color) })
          .addTo(map)
          .bindPopup(
            `<b>${escapeHtml(suggestion.title)}</b><br/><a href="/report/${suggestion.id}" style="color:var(--teal)">View report →</a>`
          );
      }
    });
    mapInstance.current = map;
  }

  const activeCategoryFilterCount = categoryFilters.includes('all') ? 0 : categoryFilters.length;
  const currentFeed = view === 'active' ? activeFeed : resolvedFeed;

  return (
    <main>
      <div className="content">
        <div ref={mapRef} id="map" />
        <p className="hint" style={{ margin: '8px 0 14px' }}>
          <span style={{ color: 'var(--teal)' }}>●</span> active · <span style={{ color: 'var(--yellow)' }}>●</span> resolved
          {mapError && (
            <>
              {' · '}markers unavailable{' '}
              <button type="button" className="btn outline" onClick={loadMapSuggestions} style={{ padding: '3px 8px' }}>
                Retry
              </button>
            </>
          )}
        </p>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search reports by title, description, or category…"
          aria-label="Search reports"
        />
        <div className="filter-row">
          <button className={`filter-btn ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
            Active ({activeFeed.total})
          </button>
          <button className={`filter-btn ${view === 'resolved' ? 'active' : ''}`} onClick={() => setView('resolved')}>
            Resolved ({resolvedFeed.total})
          </button>
          <button className={`filter-btn ${view === 'following' ? 'active' : ''}`} onClick={() => setView('following')}>
            Following{Array.isArray(followingSubscriptions) ? ` (${followingFeed.total})` : ''}
            {updatedIds.size > 0 && <span className="stat-dot" style={{ background: 'var(--coral)', marginLeft: 5 }} />}
          </button>
          <button
            type="button"
            className={`filter-btn ${categoryFiltersOpen ? 'active' : ''}`}
            onClick={() => setCategoryFiltersOpen((open) => !open)}
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
              {CATEGORY_FILTERS.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`filter-btn ${categoryFilters.includes(category) ? 'active' : ''}`}
                  onClick={() => setCategoryFilters((previous) => toggleFilterValue(previous, category))}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'following' ? (
          <>
            {(user === undefined || followingSubscriptions === undefined) && !followingError && (
              <p className="hint">Loading…</p>
            )}
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
            {user && !followingError && followingFeed.error && (
              <RequestError title="Couldn’t load followed reports" onRetry={followingFeed.reload} />
            )}
            {user && !followingError && followingIds.length === 0 && (
              <div className="empty">
                You&apos;re not following any reports yet.<br />
                Tap &quot;I&apos;m interested&quot; on a report to get updates here.
              </div>
            )}
            {user && !followingError && followingIds.length > 0 && followingFeed.loading && followingFeed.items.length === 0 && (
              <p className="hint">Loading…</p>
            )}
            {user && !followingError && followingIds.length > 0 && !followingFeed.loading && !followingFeed.error && followingFeed.total === 0 && (
              <div className="empty">No followed reports match your search or category filters.</div>
            )}
            {user && !followingError && followingIds.length > 0 && followingFeed.items.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                following
                updated={updatedIds.has(report.id)}
                onFollowingChange={(nowFollowing) => handleFollowingChange(report, nowFollowing)}
              />
            ))}
            {user && !followingError && followingIds.length > 0 && (
              <LoadMoreButton
                hasMore={followingFeed.hasMore}
                remaining={followingFeed.total - followingFeed.items.length}
                onClick={followingFeed.loadMore}
                loading={followingFeed.loading}
              />
            )}
          </>
        ) : (
          <>
            {currentFeed.loading && currentFeed.items.length === 0 && <p className="hint">Loading…</p>}
            {currentFeed.error && (
              <RequestError title="Couldn’t load reports" onRetry={currentFeed.reload} />
            )}
            {!currentFeed.loading && !currentFeed.error && currentFeed.total === 0 && (
              <div className="empty">
                {debouncedSearch || activeCategoryFilterCount > 0
                  ? 'No reports match your search or category filters.'
                  : view === 'active'
                  ? <>No active reports yet.<br />Be the first to submit one.</>
                  : 'No resolved reports yet.'}
              </div>
            )}
            {currentFeed.items.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                following={myInterests.has(report.id)}
                onFollowingChange={(nowFollowing) => handleFollowingChange(report, nowFollowing)}
              />
            ))}
            <LoadMoreButton
              hasMore={currentFeed.hasMore}
              remaining={currentFeed.total - currentFeed.items.length}
              onClick={currentFeed.loadMore}
              loading={currentFeed.loading}
            />
          </>
        )}
      </div>
    </main>
  );
}
