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

export default function BrowsePage() {
  const user = useUser();
  const [suggestions, setSuggestions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('active');
  const [myInterests, setMyInterests] = useState(new Set());
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  useEffect(() => {
    if (user) loadMyInterests();
    else setMyInterests(new Set());
  }, [user]);

  async function loadMyInterests() {
    const { data } = await supabase.rpc('get_my_subscriptions');
    setMyInterests(new Set((data || []).map((r) => r.suggestion_id)));
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
    if (!error) setSuggestions(data || []);
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
        L.marker([s.lat, s.lng]).addTo(map).bindPopup(`<b>${escapeHtml(s.title)}</b>`);
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
        </div>

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
          <ReportCard key={s.id} report={s} following={myInterests.has(s.id)} />
        ))}
      </div>
    </main>
  );
}
