'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import Nav from '../components/Nav';
import InterestButton from '../components/InterestButton';
import { supabase } from '../lib/supabaseClient';

export default function BrowsePage() {
  const [suggestions, setSuggestions] = useState([]);
  const [loaded, setLoaded] = useState(false);
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
      .select('*, subscribers(count)')
      .eq('status', 'approved')
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
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([39, -98.5], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    suggestions.forEach((s) => {
      if (s.lat && s.lng) {
        L.marker([s.lat, s.lng]).addTo(map).bindPopup(`<b>${escapeHtml(s.title)}</b>`);
      }
    });
    mapInstance.current = map;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 12);
      }, () => {});
    }
  }

  return (
    <main>
      <Header subtitle="Flag a bike lane or crossing that needs work. Approved reports go public — add your name to the list and we'll track who's watching each one." />
      <Nav />
      <div className="content">
        <div ref={mapRef} id="map" />
        {loaded && suggestions.length === 0 && (
          <div className="empty">No approved reports yet.<br />Be the first to submit one.</div>
        )}
        {suggestions.map((s) => (
          <div className="card" key={s.id}>
            <Link href={`/report/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {s.image_url && <img src={s.image_url} alt="" className="card-image" />}
              <span className="badge cat">{s.category}</span>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <div className="meta">Reported {new Date(s.submitted_at).toLocaleDateString()}</div>
            </Link>
            <InterestButton suggestionId={s.id} count={s.subscribers?.[0]?.count ?? 0} />
          </div>
        ))}
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
