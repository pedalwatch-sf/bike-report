'use client';

import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';

const STATUSES = ['pending', 'approved', 'rejected'];
const ROLES = ['user', 'moderator', 'admin'];

export default function ModeratePage() {
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [section, setSection] = useState('reports');

  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [editing, setEditing] = useState({});

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);

  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
    if (data && (data.role === 'moderator' || data.role === 'admin')) loadReports();
    if (data && data.role === 'admin') {
      loadUsers();
      loadRequests();
    }
  }

  async function loadReports() {
    const { data } = await supabase
      .from('suggestions')
      .select('*')
      .order('submitted_at', { ascending: false });
    setReports(data || []);
  }

  async function loadUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
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
    loadUsers();
  }

  async function setUserRole(id, role) {
    setMessage('');
    const { error } = await supabase.rpc('admin_set_user_role', { target_id: id, new_role: role });
    if (error) {
      setMessage(error.message);
      return;
    }
    loadUsers();
    loadRequests();
  }

  function startEdit(s) {
    setEditing((prev) => ({
      ...prev,
      [s.id]: {
        title: s.title,
        description: s.description,
        category: s.category,
        status: s.status,
        lat: s.lat ?? '',
        lng: s.lng ?? '',
        image_url: s.image_url || '',
      },
    }));
  }
  function cancelEdit(id) {
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }
  function updateField(id, field, value) {
    setEditing((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function act(id, action) {
    setMessage('');
    let update = null;
    if (action === 'approve') update = { status: 'approved' };
    else if (action === 'reject') update = { status: 'rejected' };
    else if (action === 'reopen') update = { status: 'pending' };
    else if (action === 'edit') {
      const edit = editing[id];
      update = {
        ...edit,
        lat: edit.lat === '' ? null : Number(edit.lat),
        lng: edit.lng === '' ? null : Number(edit.lng),
        image_url: edit.image_url.trim() || null,
      };
    }
    const { error } = await supabase.from('suggestions').update(update).eq('id', id);
    if (error) setMessage(error.message);
    cancelEdit(id);
    loadReports();
  }

  async function deleteReport(id) {
    if (!window.confirm('Delete this report permanently? This cannot be undone.')) return;
    setMessage('');
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (error) setMessage(error.message);
    loadReports();
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
  const isAdmin = profile?.role === 'admin';
  const visibleReports = statusFilter === 'all' ? reports : reports.filter((r) => r.status === statusFilter);

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

        {isAdmin && (
          <div className="filter-row">
            <button
              className={`filter-btn ${section === 'reports' ? 'active' : ''}`}
              onClick={() => setSection('reports')}
            >
              Reports
            </button>
            <button
              className={`filter-btn ${section === 'users' ? 'active' : ''}`}
              onClick={() => setSection('users')}
            >
              User accounts
            </button>
          </div>
        )}

        {isAdmin && section === 'users' && (
          <>
            {requests.length > 0 && (
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

            <p className="hint" style={{ margin: '14px 0' }}>
              All accounts — change a user&apos;s role directly.
            </p>
            {users.length === 0 && <div className="empty">No accounts yet.</div>}
            {users.map((u) => (
              <div className="card" key={u.id}>
                <h3>{u.email}</h3>
                <span className={`badge role-${u.role}`}>{u.role}</span>
                {u.moderator_status && u.moderator_status !== 'none' && (
                  <span className="badge cat">Moderator request: {u.moderator_status}</span>
                )}
                <div className="meta">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                <div className="row" style={{ marginTop: 8 }}>
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      className={`btn ${u.role === role ? 'teal' : 'outline'}`}
                      disabled={u.id === user.id}
                      onClick={() => setUserRole(u.id, role)}
                    >
                      Make {role}
                    </button>
                  ))}
                </div>
                {u.id === user.id && <p className="hint" style={{ marginTop: 6 }}>You can&apos;t change your own role.</p>}
              </div>
            ))}
          </>
        )}

        {isModOrAdmin && (!isAdmin || section === 'reports') && (
          <>
            <div className="filter-row">
              {['all', ...STATUSES].map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${statusFilter === f ? 'active' : ''}`}
                  onClick={() => setStatusFilter(f)}
                >
                  {f} {f !== 'all' && `(${reports.filter((r) => r.status === f).length})`}
                </button>
              ))}
            </div>

            {visibleReports.length === 0 && <div className="empty">No reports in this view.</div>}
            {visibleReports.map((s) => {
              const edit = editing[s.id];
              return (
                <div className="card" key={s.id}>
                  {!edit && s.image_url && <img src={s.image_url} alt="" className="card-image" />}
                  <span className={`badge ${s.status}`}>{s.status}</span>
                  <span className="badge cat">{s.category}</span>

                  {edit ? (
                    <>
                      <label>Title</label>
                      <input type="text" value={edit.title} onChange={(e) => updateField(s.id, 'title', e.target.value)} />
                      <label>Description</label>
                      <textarea value={edit.description} onChange={(e) => updateField(s.id, 'description', e.target.value)} />
                      <label>Category</label>
                      <input type="text" value={edit.category} onChange={(e) => updateField(s.id, 'category', e.target.value)} />
                      <label>Status</label>
                      <select value={edit.status} onChange={(e) => updateField(s.id, 'status', e.target.value)}>
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      <div className="field-grid">
                        <div>
                          <label>Latitude</label>
                          <input type="number" step="any" value={edit.lat} onChange={(e) => updateField(s.id, 'lat', e.target.value)} />
                        </div>
                        <div>
                          <label>Longitude</label>
                          <input type="number" step="any" value={edit.lng} onChange={(e) => updateField(s.id, 'lng', e.target.value)} />
                        </div>
                      </div>
                      <label>Image URL</label>
                      <input type="text" value={edit.image_url} onChange={(e) => updateField(s.id, 'image_url', e.target.value)} placeholder="https://…" />
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
                        <button className="btn outline" onClick={() => act(s.id, 'edit')}>Save changes</button>
                        <button className="btn outline" onClick={() => cancelEdit(s.id)}>Cancel</button>
                      </>
                    )}
                    {!edit && s.status !== 'approved' && (
                      <button className="btn teal" onClick={() => act(s.id, 'approve')}>Approve</button>
                    )}
                    {!edit && s.status !== 'rejected' && (
                      <button className="btn coral" onClick={() => act(s.id, 'reject')}>Reject</button>
                    )}
                    {!edit && s.status !== 'pending' && (
                      <button className="btn outline" onClick={() => act(s.id, 'reopen')}>Reopen</button>
                    )}
                    {!edit && (
                      <button className="btn coral" onClick={() => deleteReport(s.id)}>Delete</button>
                    )}
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
