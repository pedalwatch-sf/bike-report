'use client';

import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';

export default function ModeratePage() {
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [pending, setPending] = useState([]);
  const [requests, setRequests] = useState([]);
  const [editing, setEditing] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
    if (data && (data.role === 'moderator' || data.role === 'admin')) loadPending();
    if (data && data.role === 'admin') loadRequests();
  }

  async function loadPending() {
    const { data } = await supabase
      .from('suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });
    setPending(data || []);
  }

  async function loadRequests() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('moderator_status', 'pending')
      .order('created_at', { ascending: false });
    setRequests(data || []);
  }

  async function reviewRequest(id, approve) {
    const { error } = await supabase.rpc('admin_review_moderator_request', { target_id: id, approve });
    if (error) setMessage(error.message);
    loadRequests();
  }

  function startEdit(s) {
    setEditing((prev) => ({ ...prev, [s.id]: { title: s.title, description: s.description, category: s.category } }));
  }
  function cancelEdit(id) {
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }
  function updateField(id, field, value) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function act(id, action) {
    let update = {};
    if (action === 'approve') update = { status: 'approved' };
    else if (action === 'reject') update = { status: 'rejected' };
    else if (action === 'edit') update = editing[id];
    const { error } = await supabase.from('suggestions').update(update).eq('id', id);
    if (error) setMessage(error.message);
    cancelEdit(id);
    loadPending();
  }

  async function requestModerator() {
    const { error } = await supabase.rpc('request_moderator_access');
    if (!error) loadProfile();
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
            <h3>Moderator access</h3>
            <p className="hint">Sign in to request or use moderator access.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <a className="btn" href="/login">Sign in</a>
              <a className="btn outline" href="/signup">Create account</a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isModOrAdmin = profile && (profile.role === 'moderator' || profile.role === 'admin');

  return (
    <main>
      <Header />
      <Nav />
      <div className="content">
        {!isModOrAdmin && (
          <div className="lock">
            <h3>Not a moderator yet</h3>
            {profile?.moderator_status === 'pending' ? (
              <p className="hint">Your request is waiting on approval.</p>
            ) : (
              <>
                <p className="hint">Request access to review and approve submissions.</p>
                <button className="btn" onClick={requestModerator} style={{ marginTop: 12 }}>
                  Request moderator access
                </button>
              </>
            )}
          </div>
        )}

        {profile?.role === 'admin' && requests.length > 0 && (
          <>
            <p className="hint" style={{ margin: '4px 0 10px' }}>Pending moderator requests</p>
            {requests.map((r) => (
              <div className="card" key={r.id}>
                <h3>{r.email}</h3>
                <div className="row">
                  <button className="btn teal" onClick={() => reviewRequest(r.id, true)}>Approve</button>
                  <button className="btn coral" onClick={() => reviewRequest(r.id, false)}>Deny</button>
                </div>
              </div>
            ))}
          </>
        )}

        {isModOrAdmin && (
          <>
            <p className="hint" style={{ margin: '14px 0' }}>
              Pending submissions — edit if needed, then approve or reject.
            </p>
            {pending.length === 0 && <div className="empty">Nothing waiting for review.</div>}
            {pending.map((s) => {
              const edit = editing[s.id];
              return (
                <div className="card" key={s.id}>
                  {s.image_url && <img src={s.image_url} alt="" className="card-image" />}
                  <span className="badge pending">Pending</span>
                  <span className="badge cat">{s.category}</span>

                  {edit ? (
                    <>
                      <label>Title</label>
                      <input type="text" value={edit.title} onChange={(e) => updateField(s.id, 'title', e.target.value)} />
                      <label>Description</label>
                      <textarea value={edit.description} onChange={(e) => updateField(s.id, 'description', e.target.value)} />
                      <label>Category</label>
                      <input type="text" value={edit.category} onChange={(e) => updateField(s.id, 'category', e.target.value)} />
                    </>
                  ) : (
                    <>
                      <h3>{s.title}</h3>
                      <p>{s.description}</p>
                    </>
                  )}

                  <div className="meta">
                    {s.lat?.toFixed(4)}, {s.lng?.toFixed(4)} · {new Date(s.submitted_at).toLocaleString()}
                  </div>

                  <div className="row">
                    {!edit && <button className="btn outline" onClick={() => startEdit(s)}>Edit</button>}
                    {edit && (
                      <>
                        <button className="btn outline" onClick={() => act(s.id, 'edit')}>Save edit</button>
                        <button className="btn outline" onClick={() => cancelEdit(s.id)}>Cancel</button>
                      </>
                    )}
                    <button className="btn teal" onClick={() => act(s.id, 'approve')}>Approve</button>
                    <button className="btn coral" onClick={() => act(s.id, 'reject')}>Reject</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {message && <p className="hint" style={{ color: 'var(--coral)' }}>{message}</p>}
      </div>
    </main>
  );
}
