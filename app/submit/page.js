'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const CATEGORIES = [
  'New bike lane needed',
  'Existing lane needs repair',
  'Intersection safety',
  'Signage / markings',
  'Bike parking',
  'Other',
];

export default function SubmitPage() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  const [coords, setCoords] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [imageFile, setImageFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let map;
    (async () => {
      const L = (await import('leaflet')).default;
      map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([39, -98.5], 4);
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
  }, []);

  async function handleSubmit() {
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

    let image_url = null;
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('submission-images')
        .upload(path, imageFile);
      if (uploadError) {
        setMessage('Image upload failed: ' + uploadError.message);
        setSubmitting(false);
        return;
      }
      const { data } = supabase.storage.from('submission-images').getPublicUrl(path);
      image_url = data.publicUrl;
    }

    const { error } = await supabase.from('suggestions').insert({
      title: title.trim(),
      description: description.trim(),
      category,
      lat: coords.lat,
      lng: coords.lng,
      status: 'pending',
      image_url,
    });

    setSubmitting(false);
    if (error) {
      setMessage('Something went wrong: ' + error.message);
      return;
    }
    setMessage('Submitted for review — thank you!');
    setTitle('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setImageFile(null);
    setCoords(null);
    if (markerRef.current && mapInstance.current) {
      mapInstance.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }

  return (
    <main>
      <header className="page-header">
        <div className="shield">RT</div>
        <p className="eyebrow">Community infrastructure survey</p>
        <h1>Route Report</h1>
      </header>
      <nav className="tabs">
        <Link href="/" className="tab">Browse</Link>
        <Link href="/submit" className="tab active">Submit</Link>
        <Link href="/moderate" className="tab">Moderate</Link>
      </nav>
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
        {message && <p className="hint" style={{ marginTop: 10 }}>{message}</p>}
      </div>
    </main>
  );
}
