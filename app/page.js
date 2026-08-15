'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import Nav from '../components/Nav';
import ReportCard from '../components/ReportCard';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/useUser';
import { matchesSearch } from '../lib/searchReports';
import { SF_CENTER } from '../lib/constants';
import { escapeHtml } from '../lib/escapeHtml';
import { dotIcon } from '../lib/leafletDotIcon';
import { attachReporterNames } from '../lib/reporterNames';

export default function BrowsePage() {
  const user = useUser();
  const [suggestions, setSuggestions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('active');
  const [myInterests, setMyInterests] = useState(new Set());
  const [followingReports, setFollowingReports] = useState(undefined);
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
      setUpdatedIds(new Set());
    }
  }, [user]);

  // Loaded eagerly (not just when the Following pill is opened) so its
  // count and "Updated" dot are accurate as soon as Browse loads.
  async function loadFollowing() {
    const { data: subs } = await supabase.rpc('get_my_subscriptions');
    const ids = (subs || []).map((s) => s.suggestion_id);
    setMyInterests(new Set(ids));
    if (ids.length === 0) {
      setFollowingReports([]);
      setUpdatedIds(new Set());
      return;
    }
    const { data } = await supabase
      .from('suggestions')
      .select('*, subscribers(count), report_images(url)')
      .in('id', ids);
    const bySubscribedOrder = ids
      .map((id) => (data || []).find((r) => r.id === id))
      .filter(Boolean);
    setFollowingReports(await attachReporterNames(bySubscribedOrder));
    setUpdatedIds(new Set((subs || []).filter((s) => s.has_update).map((s) => s.suggestion_id)));
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
    const { data, error } = await supabase
      .from('suggestions')
      .select('*, subscribers(count), report_images(url)')
      .in('status', ['approved', 'resolved'])
      .order('submitted_at', { ascending: false });
    if (!error) setSuggestions(await attachReporterNames(data || []));
    setLoaded(true);
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
          .bindPopup(`<b>${escapeHtml(s.title)}</b>`);
      }
    });
    mapInstance.current = map;
  }

  const filtered = suggestions.filter((s) => matchesSearch(s, search));
  const active = filtered.filter((s) => s.status === 'approved');
  const resolved = filtered.filter((s) => s.status === 'resolved');
  const visible = view === 'active' ? active : resolved;

  return (
    <main>
      <Header />
      <Nav />
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
          style={{ marginBottom: 14 }}
        />
        <div className="filter-row">
          <button className={`filter-btn ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>
            Active ({active.length})
          </button>
          <button className={`filter-btn ${view === 'resolved' ? 'active' : ''}`} onClick={() => setView('resolved')}>
            Resolved ({resolved.length})
          </button>
          <button className={`filter-btn ${view === 'following' ? 'active' : ''}`} onClick={() => setView('following')}>
            Following{Array.isArray(followingReports) ? ` (${followingReports.length})` : ''}
            {updatedIds.size > 0 && <span className="stat-dot" style={{ background: 'var(--coral)', marginLeft: 5 }} />}
          </button>
        </div>

        {view === 'following' ? (
          <>
            {(user === undefined || followingReports === undefined) && <p className="hint">Loading…</p>}
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
            {user && Array.isArray(followingReports) && followingReports.length === 0 && (
              <div className="empty">
                You&apos;re not following any reports yet.<br />
                Tap &quot;I&apos;m interested&quot; on a report to get updates here.
              </div>
            )}
            {user &&
              (followingReports || []).map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  following
                  updated={updatedIds.has(r.id)}
                  onFollowingChange={(nowFollowing) => handleFollowingChange(r, nowFollowing)}
                />
              ))}
          </>
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
            {visible.map((s) => (
              <ReportCard
                key={s.id}
                report={s}
                following={myInterests.has(s.id)}
                onFollowingChange={(nowFollowing) => handleFollowingChange(s, nowFollowing)}
              />
            ))}
          </>
        )}
      </div>
    </main>
  );
}
