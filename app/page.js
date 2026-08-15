'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../components/Header';
import Nav from '../components/Nav';
import ReportCard from '../components/ReportCard';
import { supabase } from '../lib/supabaseClient';
import { matchesSearch } from '../lib/searchReports';
import { SF_CENTER } from '../lib/constants';

export default function BrowsePage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

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

  return (
    <main>
      <Header subtitle="Flag a bike lane or crossing that needs work. Approved reports go public — add your name to the list and we'll track who's watching each one." />
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
        {loaded && active.length === 0 && (
          <div className="empty">
            {search.trim() ? 'No reports match your search.' : <>No active reports yet.<br />Be the first to submit one.</>}
          </div>
        )}
        {active.map((s) => (
          <ReportCard key={s.id} report={s} />
        ))}

        {resolved.length > 0 && (
          <>
            <p className="hint" style={{ margin: '18px 0 10px' }}>Resolved</p>
            {resolved.map((s) => (
              <ReportCard key={s.id} report={s} />
            ))}
          </>
        )}
      </div>
    </main>
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
