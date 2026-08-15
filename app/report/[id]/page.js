'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/Header';
import Nav from '../../../components/Nav';
import InterestButton from '../../../components/InterestButton';
import { supabase } from '../../../lib/supabaseClient';
import { useProfile } from '../../../lib/useProfile';

export default function ReportDetailPage({ params }) {
  const { id } = params;
  const { user, profile } = useProfile();
  const router = useRouter();

  const [report, setReport] = useState(undefined); // undefined = loading, null = not found
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState('');
  const [posting, setPosting] = useState(false);

  const [changeMessage, setChangeMessage] = useState('');
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

  async function loadReport() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, subscribers(count)')
      .eq('id', id)
      .single();
    setReport(data || null);
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

  async function postUpdate() {
    if (!newUpdate.trim()) return;
    setPosting(true);
    const { error } = await supabase.from('updates').insert({
      suggestion_id: id,
      message: newUpdate.trim(),
      created_by_email: profile?.email || null,
    });
    setPosting(false);
    if (!error) {
      setNewUpdate('');
      loadUpdates();
    }
  }

  async function submitChangeSuggestion() {
    if (!changeMessage.trim()) return;
    setSuggestingChange(true);
    const { error } = await supabase.from('change_suggestions').insert({
      suggestion_id: id,
      user_id: user.id,
      submitter_email: user.email,
      message: changeMessage.trim(),
    });
    setSuggestingChange(false);
    if (!error) {
      setChangeMessage('');
      setChangeSent(true);
    }
  }

  const canModerate = profile && (profile.role === 'moderator' || profile.role === 'admin');

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
          {report.image_url && <img src={report.image_url} alt="" className="card-image" />}
          <span className="badge cat">{report.category}</span>
          <h3>{report.title}</h3>
          <p>{report.description}</p>
          <div className="meta">Reported {new Date(report.submitted_at).toLocaleDateString()}</div>
          {report.lat && report.lng && <div ref={mapRef} id="map" />}
          <InterestButton suggestionId={report.id} count={report.subscribers?.[0]?.count ?? 0} />
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

        {canModerate && (
          <div className="card">
            <label>Post an update</label>
            <textarea
              value={newUpdate}
              onChange={(e) => setNewUpdate(e.target.value)}
              placeholder="e.g. City confirmed this is scheduled for next quarter"
            />
            <div style={{ marginTop: 10 }}>
              <button className="btn" onClick={postUpdate} disabled={posting || !newUpdate.trim()}>
                {posting ? 'Posting…' : 'Post update'}
              </button>
            </div>
          </div>
        )}

        {user && report.status === 'approved' && (
          <div className="card">
            <label>Suggest a change</label>
            {changeSent ? (
              <p className="hint">Thanks — a moderator will review your suggestion.</p>
            ) : (
              <>
                <textarea
                  value={changeMessage}
                  onChange={(e) => setChangeMessage(e.target.value)}
                  placeholder="e.g. This has actually been fixed, or the category should be different"
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
