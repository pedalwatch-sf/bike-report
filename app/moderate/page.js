'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ModeratePage() {
  const [passcode, setPasscode] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState({});

  async function fetchPending(code) {
    const res = await fetch('/api/moderate/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: code }),
    });
    if (res.status === 401) return null;
    const data = await res.json();
    return data.suggestions || [];
  }

  async function unlock() {
    setError('');
    const list = await fetchPending(passcode);
    if (list === null) {
      setError('Wrong passcode');
      return;
    }
    setPending(list);
    setUnlocked(true);
  }

  async function refresh() {
    const list = await fetchPending(passcode);
    if (list !== null) setPending(list);
  }

  function startEdit(s) {
    setEditing((prev) => ({
      ...prev,
      [s.id]: { title: s.title, description: s.description, category: s.category },
    }));
  }

  function cancelEdit(id) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function updateField(id, field, value) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function act(id, action) {
    const edit = editing[id];
    await fetch('/api/moderate/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, id, action, ...(edit || {}) }),
    });
    cancelEdit(id);
    refresh();
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
        <Link href="/submit" className="tab">Submit</Link>
        <Link href="/moderate" className="tab active">Moderate</Link>
      </nav>
      <div className="content">
        {!unlocked ? (
          <div className="lock">
            <h3>Moderator access</h3>
            <p className="hint">Enter the review passcode to see pending submissions.</p>
            <input
              type="text"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Passcode"
              style={{ margin: '14px 0' }}
            />
            <button className="btn" onClick={unlock}>Unlock</button>
            {error && <p className="hint" style={{ color: 'var(--coral)' }}>{error}</p>}
          </div>
        ) : (
          <div>
            <p className="hint" style={{ marginBottom: 14 }}>
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
                      <input
                        type="text"
                        value={edit.title}
                        onChange={(e) => updateField(s.id, 'title', e.target.value)}
                      />
                      <label>Description</label>
                      <textarea
                        value={edit.description}
                        onChange={(e) => updateField(s.id, 'description', e.target.value)}
                      />
                      <label>Category</label>
                      <input
                        type="text"
                        value={edit.category}
                        onChange={(e) => updateField(s.id, 'category', e.target.value)}
                      />
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
                    {!edit && (
                      <button className="btn outline" onClick={() => startEdit(s)}>Edit</button>
                    )}
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
          </div>
        )}
      </div>
    </main>
  );
}
