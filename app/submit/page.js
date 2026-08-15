'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';
import { useProfile } from '../../lib/useProfile';
import { uploadImage } from '../../lib/uploadImage';
import { SF_CENTER } from '../../lib/constants';

const CATEGORIES = [
  'New bike lane needed',
  'Existing lane needs repair',
  'Intersection safety',
  'Signage / markings',
  'Bike parking',
  'Other',
];

const DUPLICATE_RADIUS_METERS = 75;

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function findNearbyReports(lat, lng, category) {
  const { data: approved } = await supabase
    .from('suggestions')
    .select('id, title, lat, lng, category')
    .eq('status', 'approved');
  const nearbyApproved = (approved || []).filter(
    (r) =>
      r.category === category &&
      r.lat != null &&
      r.lng != null &&
      haversineMeters(lat, lng, r.lat, r.lng) <= DUPLICATE_RADIUS_METERS
  );

  // RLS only lets a user see their own pending reports, so a plain query
  // can't catch someone else's still-pending submission for the same
  // spot -- this RPC checks for that too.
  const { data: pending } = await supabase.rpc('find_nearby_pending_reports', {
    p_lat: lat,
    p_lng: lng,
    p_category: category,
    p_radius_meters: DUPLICATE_RADIUS_METERS,
  });

  return [...nearbyApproved, ...(pending || [])];
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

  useEffect(() => {
    if (!user) return;
    let map;
    (async () => {
      const L = (await import('leaflet')).default;
      map = L.map(mapRef.current, { scrollWheelZoom: false }).setView(SF_CENTER, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      map.on('click', (e) => {
        setCoords(e.latlng);
        if (markerRef.current) map.removeLayer(markerRef.current);
        markerRef.current = L.marker(e.latlng).addTo(map);
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

  async function handleSubmit() {
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

      const nearby = await findNearbyReports(coords.lat, coords.lng, category);
      if (nearby.length > 0) {
        const names = nearby.map((r) => `"${r.title}"`).join(', ');
        const proceed = window.confirm(
          `This looks close to an existing report: ${names}. Submit anyway as a possible duplicate?`
        );
        if (!proceed) return;
      }

      setSubmitting(true);
      setMessage('');
      setJustSubmitted(false);

      let image_url = null;
      if (imageFile) {
        try {
          image_url = await uploadImage(imageFile);
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
        <Header />
        <Nav />
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <Header />
        <Nav />
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
        <Header />
        <Nav />
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
      <Header />
      <Nav />
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
        <p className="hint">Tap the map to drop a pin at the location.</p>
        <div className="coords">
          {coords ? `Pin set: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'No pin placed yet'}
        </div>

        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
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
