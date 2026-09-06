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
  const { data, error } = await supabase
    .from('suggestions')
    .select('id, title, lat, lng, category')
    .eq('status', 'approved');
  if (error) throw new Error('Could not check nearby reports. Please try again.');
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
  const imageInputRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');

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
    if (!user || !profile || profile.banned) return;
    let cancelled = false;
    let map;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      setCoords(null);
      setPendingDuplicates(null);
      map = L.map(mapRef.current, { scrollWheelZoom: false }).setView(SF_CENTER, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map).on('tileerror', () => { if (!cancelled) setMapError(true); });

      mapInstance.current = map;
      map.on('click', (e) => placePin(e.latlng, L, map));
      setMapReady(true);
      const { data: approved } = await supabase
        .from('suggestions')
        .select('id, title, lat, lng')
        .eq('status', 'approved');
      if (cancelled) return;
      (approved || []).forEach((r) => {
        if (r.lat != null && r.lng != null) {
          L.marker([r.lat, r.lng], { icon: dotIcon(L, 'var(--teal)') })
            .addTo(map)
            .bindPopup(
              `<b>${escapeHtml(r.title)}</b><br/><a href="/report/${r.id}" target="_blank" rel="noopener noreferrer" style="color:var(--teal)">View report →</a>`
            );
        }
      });

    })().catch(() => { if (!cancelled) setMapError(true); });
    return () => {
      cancelled = true;
      if (map) map.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, [user, profile, mapAttempt]);

  function placePin(latlng, L, map) {
    if (submitLockRef.current) return;
    setCoords(latlng);
    setPendingDuplicates(null);
    if (markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current = L.marker(latlng, { icon: dotIcon(L, 'var(--yellow)') }).addTo(map);
  }

  async function pinMapCenter() {
    const map = mapInstance.current;
    if (!map) return;
    const { default: L } = await import('leaflet');
    if (mapInstance.current === map) placePin(map.getCenter(), L, map);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setLocationMessage('Location is unavailable. Pan the map and place a pin instead.');
      return;
    }
    setLocating(true);
    setLocationMessage('');
    const requestedMap = mapInstance.current;
    navigator.geolocation.getCurrentPosition((position) => {
      if (mapInstance.current !== requestedMap) return;
      setLocating(false);
      mapInstance.current?.setView([position.coords.latitude, position.coords.longitude], 16);
      setLocationMessage('Map centered on your location. Place a pin at the issue, which may be somewhere else.');
    }, () => {
      if (mapInstance.current !== requestedMap) return;
      setLocating(false);
      setLocationMessage('Could not get your location. Pan the map and place a pin instead.');
    }, { timeout: 10000 });
  }

  async function handleSubmit(skipDuplicateCheck = false) {
    // Synchronous guard against double-clicks/taps landing before React
    // re-renders the disabled button -- setSubmitting(true) alone leaves a
    // brief window where a second click can still slip through.
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setJustSubmitted(false);
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

      setSubmitting(true);
      setMessage('');
      if (!skipDuplicateCheck) {
        const nearby = await findNearbyReports(coords.lat, coords.lng);
        if (nearby.length > 0) {
          setPendingDuplicates(nearby);
          return;
        }
      }
      setPendingDuplicates(null);

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

      if (error) {
        setMessage('Something went wrong: ' + error.message);
        return;
      }
      let imageWarning = '';
      if (image_url) {
        try {
          const { error: imageError } = await supabase.from('report_images').insert({ suggestion_id: inserted.id, url: image_url });
          if (imageError) throw imageError;
        } catch {
          imageWarning = ' Your report was saved, but the photo could not be attached. Please contact PedalWatch to add it; do not submit a duplicate.';
        }
      }
      setMessage('Submitted for community review. You can track it in your submissions.' + imageWarning);
      setJustSubmitted(true);
      setTitle('');
      setDescription('');
      setCategory(CATEGORIES[0]);
      setImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = '';
      setCoords(null);
      if (markerRef.current && mapInstance.current) {
        mapInstance.current.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
      submitLockRef.current = false;
    }
  }

  if (user === undefined || (user && profile === undefined)) {
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

  if (!profile) {
    return <main><div className="content"><div className="card" role="alert"><h1>Account unavailable</h1><p>We could not load your account. Reload the page to try again before submitting.</p><button className="btn" onClick={() => window.location.reload()}>Reload account</button></div></div></main>;
  }

  return (
    <main>
      <div className="content">
        <div className="form-intro"><p className="eyebrow">Make your route better</p><h1>Report a street issue</h1><p className="hint">A precise location and a clear description help the community understand what needs to change.</p></div>
        <div className="form-section"><h2>01 / Describe the issue</h2>
        <label htmlFor="issue-title">What needs improvement? <span className="hint">(required)</span></label>
        <input
          id="issue-title"
          disabled={submitting}
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Missing lane on 5th & Oak"
        />

        <label htmlFor="issue-description">Details <span className="hint">(required)</span></label>
        <textarea
          id="issue-description"
          disabled={submitting}
          required
          aria-describedby="description-help"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's happening, and why it matters"
        />

        <p className="hint" id="description-help">Include the nearest intersection, what you observed, and how it affects people riding.</p>
        <label htmlFor="issue-category">Category</label>
        <select id="issue-category" disabled={submitting} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <label htmlFor="issue-photo">Photo <span className="hint">(optional)</span></label>
        <input
          id="issue-photo"
          disabled={submitting}
          ref={imageInputRef}
          type="file"
          aria-describedby="photo-help"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0] || null)}
        />

        <p className="hint" id="photo-help">Show the issue and its surroundings. Take photos from a safe place and avoid including identifying details about other people.</p>
        </div>
        <div className="form-section"><h2>02 / Pin the location</h2><p className="hint">Check the blue markers for existing reports before adding yours.</p>
        <div ref={mapRef} id="submitMap" aria-label="Choose the issue location. Use arrow keys to pan, then the pin button below." />
        {mapError && <div role="alert" className="hint">The map could not load. <button className="btn outline" disabled={submitting} onClick={() => { setMapReady(false); setMapError(false); setCoords(null); setLocating(false); setMapAttempt((value) => value + 1); }}>Retry map</button></div>}
        <div className="row"><button type="button" className="btn outline" onClick={pinMapCenter} disabled={!mapReady || submitting}>Place pin at map center</button><button type="button" className="btn outline" onClick={locateMe} disabled={!mapReady || locating || submitting}>{locating ? 'Finding location…' : 'Use my location'}</button></div>
        {locationMessage && <p className="hint" role="status">{locationMessage}</p>}
        <p className="hint">
          Tap the map to drop a pin at the location.{' '}
          <span style={{ color: 'var(--teal)' }}>●</span> existing approved reports ·{' '}
          <span style={{ color: 'var(--yellow)' }}>●</span> your new pin
        </p>
        <div className="coords" role="status">
          {coords ? `Pin set: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'No pin placed yet'}
        </div>

        </div>
        <p className="submission-note"><strong>What happens next?</strong> A moderator reviews your report before it appears publicly. Submitting here does not automatically notify a city agency.</p>
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
          <p className="hint" role={justSubmitted ? 'status' : 'alert'} style={{ marginTop: 10 }}>
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
