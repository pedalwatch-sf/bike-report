'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';
import { uploadImage } from '../../lib/uploadImage';

const STATUSES = ['pending', 'approved', 'rejected', 'resolved'];
const ROLES = ['user', 'moderator', 'admin'];
const SF_CENTER = [37.7749, -122.4194];

export default function ModeratePage() {
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [section, setSection] = useState('reports');

  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [editing, setEditing] = useState({});

  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [changeSuggestions, setChangeSuggestions] = useState([]);

  const [timelineEvents, setTimelineEvents] = useState([]);
  const [eventDrafts, setEventDrafts] = useState({});
  const [newEventText, setNewEventText] = useState({});

  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
    if (data && (data.role === 'moderator' || data.role === 'admin')) {
      loadReports();
      loadChangeSuggestions();
      loadTimelineEvents();
    }
    if (data && data.role === 'admin') {
      loadUsers();
      loadRequests();
    }
  }

  async function loadReports() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, report_images(id, url)')
      .order('submitted_at', { ascending: false });
    setReports(data || []);
  }

  async function loadChangeSuggestions() {
    const { data } = await supabase
      .from('change_suggestions')
      .select('*, suggestions(title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setChangeSuggestions(data || []);
  }

  async function markChangeReviewed(id) {
    setMessage('');
    const { error } = await supabase.from('change_suggestions').update({ status: 'reviewed' }).eq('id', id);
    if (error) setMessage(error.message);
    loadChangeSuggestions();
  }

  async function loadTimelineEvents() {
    const { data } = await supabase.rpc('get_all_timeline_updates_for_moderation');
    setTimelineEvents(data || []);
  }

  async function postTimelineEvent(suggestionId) {
    const text = (newEventText[suggestionId] || '').trim();
    if (!text) return;
    setMessage('');
    const { error } = await supabase.from('updates').insert({
      suggestion_id: suggestionId,
      message: text,
      created_by_email: profile?.email || null,
    });
    if (error) setMessage(error.message);
    setNewEventText((prev) => ({ ...prev, [suggestionId]: '' }));
    loadTimelineEvents();
  }

  function startEventEdit(ev) {
    setEventDrafts((prev) => ({ ...prev, [ev.id]: ev.message }));
  }
  function cancelEventEdit(id) {
    setEventDrafts((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }
  async function saveEventEdit(id) {
    const text = (eventDrafts[id] || '').trim();
    if (!text) return;
    setMessage('');
    const { error } = await supabase.from('updates').update({ message: text }).eq('id', id);
    if (error) setMessage(error.message);
    cancelEventEdit(id);
    loadTimelineEvents();
  }
  async function deleteTimelineEvent(id) {
    if (!window.confirm('Delete this timeline event?')) return;
    setMessage('');
    const { error } = await supabase.from('updates').delete().eq('id', id);
    if (error) setMessage(error.message);
    loadTimelineEvents();
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
    else if (action === 'resolve') update = { status: 'resolved' };
    else if (action === 'edit') {
      const edit = editing[id];
      update = {
        ...edit,
        lat: edit.lat === '' ? null : Number(edit.lat),
        lng: edit.lng === '' ? null : Number(edit.lng),
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

  async function addImage(suggestionId, file) {
    setMessage('');
    try {
      const url = await uploadImage(file);
      const { error } = await supabase.from('report_images').insert({ suggestion_id: suggestionId, url });
      if (error) setMessage(error.message);
    } catch (uploadError) {
      setMessage(uploadError.message);
    }
    loadReports();
  }

  async function removeImage(imageId) {
    if (!window.confirm('Remove this image?')) return;
    setMessage('');
    const { error } = await supabase.from('report_images').delete().eq('id', imageId);
    if (error) setMessage(error.message);
    loadReports();
  }

  async function addSuggestedImageToReport(cs, url) {
    setMessage('');
    const { error: insertError } = await supabase
      .from('report_images')
      .insert({ suggestion_id: cs.suggestion_id, url });
    if (insertError) {
      setMessage(insertError.message);
      return;
    }
    const remaining = (cs.image_urls || []).filter((u) => u !== url);
    const { error: updateError } = await supabase
      .from('change_suggestions')
      .update({ image_urls: remaining.length > 0 ? remaining : null })
      .eq('id', cs.id);
    if (updateError) setMessage(updateError.message);
    loadReports();
    loadChangeSuggestions();
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
  const changesByReport = {};
  changeSuggestions.forEach((cs) => {
    (changesByReport[cs.suggestion_id] ||= []).push(cs);
  });
  const timelineByReport = {};
  timelineEvents.forEach((ev) => {
    (timelineByReport[ev.suggestion_id] ||= []).push(ev);
  });

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

        {isModOrAdmin && (
          <div className="filter-row">
            <button
              className={`filter-btn ${section === 'reports' ? 'active' : ''}`}
              onClick={() => setSection('reports')}
            >
              Reports
            </button>
            <button
              className={`filter-btn ${section === 'changes' ? 'active' : ''}`}
              onClick={() => setSection('changes')}
            >
              Suggested changes {changeSuggestions.length > 0 && `(${changeSuggestions.length})`}
            </button>
            {isAdmin && (
              <button
                className={`filter-btn ${section === 'users' ? 'active' : ''}`}
                onClick={() => setSection('users')}
              >
                User accounts
              </button>
            )}
          </div>
        )}

        {isModOrAdmin && section === 'changes' && (
          <>
            <p className="hint" style={{ margin: '4px 0 10px' }}>
              Changes users have suggested for active reports.
            </p>
            {changeSuggestions.length === 0 && <div className="empty">No pending suggestions.</div>}
            {changeSuggestions.map((cs) => (
              <ChangeSuggestionCard
                key={cs.id}
                cs={cs}
                onReview={markChangeReviewed}
                onAddImage={addSuggestedImageToReport}
              />
            ))}
          </>
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

        {isModOrAdmin && section === 'reports' && (
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
                  {!edit && s.report_images?.map((img) => (
                    <img key={img.id} src={img.url} alt="" className="card-image" />
                  ))}
                  <span className={`badge ${s.status}`}>{s.status}</span>
                  <span className="badge cat">{s.category}</span>

                  {edit ? (
                    <>
                      <label>Title</label>
                      <input type="text" value={edit.title} onChange={(e) => updateField(s.id, 'title', e.target.value)} />
                      <label>Details</label>
                      <textarea value={edit.description} onChange={(e) => updateField(s.id, 'description', e.target.value)} />
                      <label>Category</label>
                      <input type="text" value={edit.category} onChange={(e) => updateField(s.id, 'category', e.target.value)} />
                      <label>Status</label>
                      <select value={edit.status} onChange={(e) => updateField(s.id, 'status', e.target.value)}>
                        {STATUSES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                      <label>Location</label>
                      <LocationMap
                        lat={edit.lat}
                        lng={edit.lng}
                        onChange={(lat, lng) => {
                          updateField(s.id, 'lat', lat);
                          updateField(s.id, 'lng', lng);
                        }}
                      />
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

                      <label>Images</label>
                      <div className="row" style={{ marginBottom: 8 }}>
                        {s.report_images?.map((img) => (
                          <div className="thumb" key={img.id}>
                            <img src={img.url} alt="" />
                            <button className="thumb-remove" onClick={() => removeImage(img.id)}>×</button>
                          </div>
                        ))}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) addImage(s.id, file);
                          e.target.value = '';
                        }}
                      />

                      <label>Timeline</label>
                      <TimelineManager
                        events={timelineByReport[s.id] || []}
                        drafts={eventDrafts}
                        onStartEdit={startEventEdit}
                        onCancelEdit={cancelEventEdit}
                        onDraftChange={(id, value) => setEventDrafts((prev) => ({ ...prev, [id]: value }))}
                        onSaveEdit={saveEventEdit}
                        onDelete={deleteTimelineEvent}
                        newText={newEventText[s.id] || ''}
                        onNewTextChange={(value) => setNewEventText((prev) => ({ ...prev, [s.id]: value }))}
                        onPost={() => postTimelineEvent(s.id)}
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
                    {!edit && s.status !== 'resolved' && (
                      <button className="btn teal" onClick={() => act(s.id, 'resolve')}>Mark resolved</button>
                    )}
                    {!edit && s.status !== 'pending' && (
                      <button className="btn outline" onClick={() => act(s.id, 'reopen')}>Reopen</button>
                    )}
                    {!edit && (
                      <button className="btn coral" onClick={() => deleteReport(s.id)}>Delete</button>
                    )}
                  </div>

                  {changesByReport[s.id]?.length > 0 && (
                    <div style={{ marginTop: 14, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                      <p className="hint" style={{ margin: '0 0 8px' }}>Suggested changes for this report</p>
                      {changesByReport[s.id].map((cs) => (
                        <ChangeSuggestionCard
                          key={cs.id}
                          cs={cs}
                          onReview={markChangeReviewed}
                          onAddImage={addSuggestedImageToReport}
                          compact
                        />
                      ))}
                    </div>
                  )}
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

function ChangeSuggestionCard({ cs, onReview, onAddImage, compact }) {
  return (
    <div className="card" style={compact ? { background: 'var(--navy-soft)' } : undefined}>
      {!compact && <span className="badge cat">{cs.suggestions?.title || 'Report'}</span>}
      <p style={{ margin: compact ? '0 0 8px' : undefined }}>{cs.message}</p>
      {cs.image_urls?.length > 0 && (
        <>
          <p className="hint" style={{ margin: '0 0 6px' }}>Suggested photos — tap + to add to the report</p>
          <div className="row" style={{ marginBottom: 8 }}>
            {cs.image_urls.map((url) => (
              <div className="thumb" key={url}>
                <img src={url} alt="" />
                <button className="thumb-add" onClick={() => onAddImage(cs, url)} title="Add to report">+</button>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="meta">
        {cs.submitter_email} · {new Date(cs.created_at).toLocaleString()}
      </div>
      <div className="row">
        {!compact && <a className="btn outline" href={`/report/${cs.suggestion_id}`}>View report</a>}
        <button className="btn teal" onClick={() => onReview(cs.id)}>Mark reviewed</button>
      </div>
    </div>
  );
}

function TimelineManager({
  events,
  drafts,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSaveEdit,
  onDelete,
  newText,
  onNewTextChange,
  onPost,
}) {
  return (
    <div>
      {events.length === 0 && <p className="hint">No timeline events yet.</p>}
      {events.map((ev) => {
        const draft = drafts[ev.id];
        return (
          <div key={ev.id} style={{ marginBottom: 10 }}>
            {draft !== undefined ? (
              <>
                <textarea value={draft} onChange={(e) => onDraftChange(ev.id, e.target.value)} />
                <div className="row" style={{ marginTop: 6 }}>
                  <button className="btn outline" onClick={() => onSaveEdit(ev.id)} disabled={!draft.trim()}>Save</button>
                  <button className="btn outline" onClick={() => onCancelEdit(ev.id)}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div className="meta">
                  {new Date(ev.created_at).toLocaleString()}
                  {ev.created_by_email ? ` · ${ev.created_by_email}` : ''}
                </div>
                <p style={{ margin: '0 0 6px' }}>{ev.message}</p>
                <div className="row">
                  <button className="btn outline" onClick={() => onStartEdit(ev)}>Edit</button>
                  <button className="btn coral" onClick={() => onDelete(ev.id)}>Delete</button>
                </div>
              </>
            )}
          </div>
        );
      })}
      <textarea
        value={newText}
        onChange={(e) => onNewTextChange(e.target.value)}
        placeholder="e.g. City confirmed this is scheduled for next quarter"
      />
      <div style={{ marginTop: 8 }}>
        <button className="btn" onClick={onPost} disabled={!newText.trim()}>Post update</button>
      </div>
    </div>
  );
}

function LocationMap({ lat, lng, onChange }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;
      const start = [
        lat !== '' && lat != null ? Number(lat) : SF_CENTER[0],
        lng !== '' && lng != null ? Number(lng) : SF_CENTER[1],
      ];
      const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView(start, 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      const marker = L.marker(start).addTo(map);
      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        onChange(e.latlng.lat, e.latlng.lng);
      });
      mapInstance.current = map;
      markerRef.current = marker;
    })();
    return () => {
      cancelled = true;
      if (mapInstance.current) mapInstance.current.remove();
    };
    // Mount once per edit session; re-syncing on every keystroke happens below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (markerRef.current && lat !== '' && lng !== '' && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      markerRef.current.setLatLng([Number(lat), Number(lng)]);
    }
  }, [lat, lng]);

  return <div ref={mapRef} className="edit-map" />;
}
