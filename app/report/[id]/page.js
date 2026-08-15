'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '../../../components/Header';
import Nav from '../../../components/Nav';
import InterestButton from '../../../components/InterestButton';
import ImageGallery from '../../../components/ImageGallery';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';
import { uploadImage } from '../../../lib/uploadImage';

const ACTIVE_STATUSES = ['approved', 'resolved'];

export default function ReportDetailPage({ params }) {
  const { id } = params;
  const { user, profile } = useProfile();
  const router = useRouter();

  const [report, setReport] = useState(undefined); // undefined = loading, null = not found
  const [reporter, setReporter] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [following, setFollowing] = useState(false);

  const [changeMessage, setChangeMessage] = useState('');
  const [changeImages, setChangeImages] = useState([]);
  const [suggestingChange, setSuggestingChange] = useState(false);
  const [changeSent, setChangeSent] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    loadReport();
    loadUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (report) drawMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  useEffect(() => {
    if (user) loadFollowing();
    else setFollowing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  async function loadFollowing() {
    const { data } = await supabase.rpc('get_my_subscriptions');
    setFollowing((data || []).some((r) => r.suggestion_id === id));
  }

  async function loadReport() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, subscribers(count), report_images(id, url)')
      .eq('id', id)
      .single();
    setReport(data || null);
    if (data?.user_id) {
      const { data: profileData } = await supabase.rpc('get_public_profile', { p_user_id: data.user_id });
      setReporter(profileData?.[0] || null);
    }
  }

  async function loadUpdates() {
    const { data } = await supabase.rpc('get_timeline_updates', { p_suggestion_id: id });
    setUpdates(data || []);
  }

  async function drawMap() {
    if (!report?.lat || !report?.lng) return;
    const L = (await import('leaflet')).default;
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }
    const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([report.lat, report.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    L.marker([report.lat, report.lng]).addTo(map);
    mapInstance.current = map;
  }

  async function submitChangeSuggestion() {
    if (!changeMessage.trim()) return;
    setSuggestingChange(true);
    let image_urls = null;
    if (changeImages.length > 0) {
      try {
        image_urls = await Promise.all(changeImages.map(uploadImage));
      } catch (uploadError) {
        setSuggestingChange(false);
        return;
      }
    }
    const { error } = await supabase.from('change_suggestions').insert({
      suggestion_id: id,
      user_id: user.id,
      submitter_email: user.email,
      message: changeMessage.trim(),
      image_urls,
    });
    setSuggestingChange(false);
    if (!error) {
      setChangeMessage('');
      setChangeImages([]);
      setChangeSent(true);
    }
  }

  if (report === undefined) {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (report === null) {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content">
          <div className="empty">Report not found.</div>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button className="btn outline" onClick={() => router.push('/')}>Back to Browse</button>
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
        <button className="btn outline" onClick={() => router.push('/')} style={{ marginBottom: 16 }}>
          ← Back to Browse
        </button>

        <div className="card">
          <ImageGallery images={report.report_images} />
          {report.status === 'resolved' && <span className="badge resolved">Resolved</span>}
          <span className="badge cat">{report.category}</span>
          <h3>{report.title}</h3>
          <p>{report.description}</p>
          <div className="meta">
            Reported {new Date(report.submitted_at).toLocaleDateString()}
            {report.user_id && (
              <>
                {' · '}
                <Link href={`/profile/${report.user_id}`} style={{ color: 'var(--teal)' }}>
                  {reporter?.display_name || 'view reporter'}
                </Link>
              </>
            )}
          </div>
          {report.lat && report.lng && <div ref={mapRef} id="map" />}
          <InterestButton suggestionId={report.id} count={report.subscribers?.[0]?.count ?? 0} following={following} />
        </div>

        <p className="hint" style={{ margin: '18px 0 10px' }}>Progress timeline</p>
        {updates.length === 0 && <div className="empty">No updates yet.</div>}
        {updates.map((u) => (
          <div className="card" key={u.id}>
            <div className="meta">
              {new Date(u.created_at).toLocaleString()}
              {u.created_by_email ? ` · ${u.created_by_email}` : ''}
            </div>
            <p style={{ margin: 0 }}>{u.message}</p>
          </div>
        ))}

        {user && ACTIVE_STATUSES.includes(report.status) && (
          <div className="card">
            <label>Suggest a change</label>
            {profile?.banned ? (
              <p className="hint">Your account has been restricted from suggesting changes.</p>
            ) : changeSent ? (
              <p className="hint">Thanks — a moderator will review your suggestion.</p>
            ) : (
              <>
                <textarea
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  placeholder="e.g. This has actually been fixed, or the category should be different"
                />
                <label>Add photos (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setChangeImages(Array.from(e.target.files || []))}
                />
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn outline"
                    onClick={submitChangeSuggestion}
                    disabled={suggestingChange || !changeMessage.trim()}
                  >
                    {suggestingChange ? 'Sending…' : 'Send suggestion'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
