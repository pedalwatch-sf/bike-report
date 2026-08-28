'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { uploadImage } from '../../lib/uploadImage';
import { SF_CENTER } from '../../lib/constants';
import { DUPLICATE_RADIUS_METERS, haversineMeters } from '../../lib/geo';
import { escapeHtml } from '../../lib/escapeHtml';
import { dotIcon } from '../../lib/leafletDotIcon';
import { CATEGORIES } from '../../lib/categories';

async function findNearbyReports(lat, lng) {
  const { data } = await supabase
    .from('suggestions')
    .select('id, title, lat, lng, category')
    .eq('status', 'approved');
  return (data || []).filter(
    (r) =>
      r.lat != null &&
      r.lng != null &&
      haversineMeters(lat, lng, r.lat, r.lng) <= DUPLICATE_RADIUS_METERS
  );
}

export default function SubmitPage() {
  const { user, profile } = useProfile();
  const router = useRouter();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const submitLockRef = useRef(false);

  const [coords, setCoords] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [pendingDuplicates, setPendingDuplicates] = useState(null);

  useEffect(() => {
    if (!user) return;
    let map;
    (async () => {
      const L = (await import('leaflet')).default;
      map = L.map(mapRef.current, { scrollWheelZoom: false }).setView(SF_CENTER, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      const { data: approved } = await supabase
        .from('suggestions')
        .select('id, title, lat, lng')
        .eq('status', 'approved');
      (approved || []).forEach((r) => {
        if (r.lat != null && r.lng != null) {
          L.marker([r.lat, r.lng], { icon: dotIcon(L, 'var(--teal)') })
            .addTo(map)
            .bindPopup(
              `<b>${escapeHtml(r.title)}</b><br/><a href="/report/${r.id}" target="_blank" rel="noopener noreferrer" style="color:var(--teal)">View report →</a>`
            );
        }
      });

      map.on('click', (e) => {
        setCoords(e.latlng);
        setPendingDuplicates(null);
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.marker(e.latlng, { icon: dotIcon(L, 'var(--yellow)') }).addTo(map);
      });
      mapInstance.current = map;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 12);
        }, () => {});
      }
    })();
    return () => {
      if (map) map.remove();
    };
  }, [user]);

  async function handleSubmit(skipDuplicateCheck = false) {
    // Synchronous guard against double-clicks/taps landing before React
    // re-renders the disabled button -- setSubmitting(true) alone leaves a
    // brief window where a second click can still slip through.
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    try {
      if (title.trim().toLowerCase() === 'kitten') {
        router.push('/kitten');
        return;
      }
      if (!title.trim() || !description.trim()) {
        setMessage('Add a title and description first.');
        return;
      }
      if (!coords) {
        setMessage('Drop a pin on the map first.');
        return;
      }

      if (!skipDuplicateCheck) {
        const nearby = await findNearbyReports(coords.lat, coords.lng);
        if (nearby.length > 0) {
          setPendingDuplicates(nearby);
          return;
        }
      }
      setPendingDuplicates(null);

      setSubmitting(true);
      setMessage('');
      setJustSubmitted(false);

      let image_url = null;
      if (imageFile) {
        try {
          image_url = await uploadImage(imageFile, user.id);
        } catch (uploadError) {
          setMessage('Image upload failed: ' + uploadError.message);
          setSubmitting(false);
          return;
        }
      }

      const { data: inserted, error } = await supabase
        .from('suggestions')
        .insert({
          title: title.trim(),
          description: description.trim(),
          category,
          lat: coords.lat,
          lng: coords.lng,
          status: 'pending',
          user_id: user.id,
        })
        .select('id')
        .single();

      setSubmitting(false);
      if (error) {
        setMessage('Something went wrong: ' + error.message);
        return;
      }
      if (image_url) {
        await supabase.from('report_images').insert({ suggestion_id: inserted.id, url: image_url });
      }
      setMessage('Submitted for review — thank you!');
      setJustSubmitted(true);
      setTitle('');
      setDescription('');
      setCategory(CATEGORIES[0]);
      setImageFile(null);
      setCoords(null);
      if (markerRef.current && mapInstance.current) {
        mapInstance.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    } finally {
      submitLockRef.current = false;
    }
  }

  if (user === undefined) {
    return (
      <main>
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <div className="content">
          <div className="lock">
            <h3>Sign in to submit a report</h3>
            <p className="hint">Creating an account lets you track your own submissions.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <a className="btn" href="/login">Sign in</a>
              <a className="btn outline" href="/signup">Create account</a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (profile?.banned) {
    return (
      <main>
        <div className="content">
          <div className="lock">
            <h3>Submitting is disabled</h3>
            <p className="hint">Your account has been restricted from submitting new reports.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="content">
        <label>What needs improvement?</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Missing lane on 5th & Oak"
        />

        <label>Details</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's happening, and why it matters"
        />

        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <label>Photo (optional)</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0] || null)}
        />

        <label>Location</label>
        <div ref={mapRef} id="submitMap" />
        <p className="hint">
          Tap the map to drop a pin at the location.{' '}
          <span style={{ color: 'var(--teal)' }}>●</span> existing approved reports ·{' '}
          <span style={{ color: 'var(--yellow)' }}>●</span> your new pin
        </p>
        <div className="coords">
          {coords ? `Pin set: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'No pin placed yet'}
        </div>

        {pendingDuplicates && (
          <div className="card" style={{ marginTop: 18, borderColor: 'var(--coral)' }}>
            <h3>This might already be reported</h3>
            <p>
              This looks close to {pendingDuplicates.length === 1 ? 'an existing report' : 'existing reports'}:
            </p>
            {pendingDuplicates.map((r) => (
              <p key={r.id} style={{ margin: '0 0 6px' }}>
                <a href={`/report/${r.id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)' }}>
                  {r.title} →
                </a>
              </p>
            ))}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={() => handleSubmit(true)} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit anyway'}
              </button>
              <button className="btn outline" onClick={() => setPendingDuplicates(null)} disabled={submitting}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {!pendingDuplicates && (
          <div style={{ marginTop: 18 }}>
            <button className="btn" onClick={() => handleSubmit()} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        )}
        {message && (
          <p className="hint" style={{ marginTop: 10 }}>
            {message}
            {justSubmitted && (
              <>
                {' '}
                <a href="/my-reports" style={{ color: 'var(--teal)' }}>View your submissions</a>
              </>
            )}
          </p>
        )}
      </div>
    </main>
  );
}

