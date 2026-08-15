'use client';

import { useEffect, useRef, useState } from 'react';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import ImageGallery from '../../components/ImageGallery';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';
import { uploadImage } from '../../lib/uploadImage';
import { matchesSearch } from '../../lib/searchReports';
import { roleLevel } from '../../lib/roles';
import { SF_CENTER } from '../../lib/constants';
import { DUPLICATE_RADIUS_METERS, haversineMeters } from '../../lib/geo';
import { dotIcon } from '../../lib/leafletDotIcon';
import { CATEGORIES } from '../../lib/categories';
import { attachReporterNames } from '../../lib/reporterNames';

const STATUSES = ['pending', 'approved', 'rejected', 'resolved', 'withdrawn'];
const ROLES = ['user', 'moderator', 'admin'];
const STALE_DAYS = 7;

const ACCOUNT_STATUS_FILTERS = ['all', 'unconfirmed', 'banned', 'requested moderator'];
function matchesAccountStatus(u, filter) {
  if (filter === 'unconfirmed') return !u.email_confirmed_at;
  if (filter === 'banned') return u.banned;
  if (filter === 'requested moderator') return u.moderator_status === 'pending';
  return true;
}
const ELEVATION_FILTERS = ['all', 'user', 'moderator', 'admin', 'owner'];

const ACTIVITY_LABELS = {
  report_submitted: 'submitted a report',
  report_status_changed: "changed a report's status",
  report_edited: 'edited a report',
  report_deleted: 'deleted a report',
  report_image_added: 'added a photo to a report',
  report_image_removed: 'removed a photo from a report',
  change_suggestion_submitted: 'suggested a change',
  change_suggestion_reviewed: 'reviewed a suggested change',
  timeline_event_posted: 'posted a progress update',
  timeline_event_edited: 'edited a progress update',
  timeline_event_deleted: 'deleted a progress update',
  user_banned: 'banned an account',
  user_unbanned: 'unbanned an account',
  role_changed: "changed an account's role",
  display_name_changed_by_moderator: "changed an account's display name",
  moderator_request_approved: 'approved a moderator request',
  moderator_request_denied: 'denied a moderator request',
  moderator_access_requested: 'requested moderator access',
};

function daysPending(submittedAt) {
  return Math.floor((Date.now() - new Date(submittedAt).getTime()) / 86400000);
}

const CSV_COLUMNS = ['id', 'title', 'category', 'status', 'description', 'lat', 'lng', 'submitted_at'];

function toCsvValue(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function reportsToCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  rows.forEach((r) => lines.push(CSV_COLUMNS.map((c) => toCsvValue(r[c])).join(',')));
  return lines.join('\n');
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ModeratePage() {
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [section, setSection] = useState('reports');

  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [reportSearch, setReportSearch] = useState('');
  const [editing, setEditing] = useState({});

  const [users, setUsers] = useState([]);
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [elevationFilter, setElevationFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [nameDrafts, setNameDrafts] = useState({});
  const [changeSuggestions, setChangeSuggestions] = useState([]);

  const [timelineEvents, setTimelineEvents] = useState([]);
  const [eventDrafts, setEventDrafts] = useState({});
  const [newEventText, setNewEventText] = useState({});
  const [subscriberLists, setSubscriberLists] = useState({});

  const [activityLog, setActivityLog] = useState([]);

  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
    if (data && roleLevel(data.role) >= 2) {
      loadReports();
      loadChangeSuggestions();
      loadTimelineEvents();
      loadUsers();
      loadActivityLog();
    }
    if (data && roleLevel(data.role) >= 3) {
      loadRequests();
    }
  }

  async function loadActivityLog() {
    const { data } = await supabase.rpc('get_activity_log');
    setActivityLog(data || []);
  }

  async function loadReports() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, report_images(id, url), subscribers(count)')
      .order('submitted_at', { ascending: false });
    setReports(await attachReporterNames(data || []));
  }

  async function toggleSubscribers(id) {
    if (subscriberLists[id] !== undefined) {
      setSubscriberLists((prev) => { const n = { ...prev }; delete n[id]; return n; });
      return;
    }
    setSubscriberLists((prev) => ({ ...prev, [id]: null })); // null = loading
    const { data, error } = await supabase.rpc('get_report_subscribers', { target_suggestion_id: id });
    setSubscriberLists((prev) => ({ ...prev, [id]: error ? [] : data || [] }));
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
    loadActivityLog();
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
    loadActivityLog();
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
    loadActivityLog();
  }
  async function deleteTimelineEvent(id) {
    if (!window.confirm('Delete this timeline event?')) return;
    setMessage('');
    const { error } = await supabase.from('updates').delete().eq('id', id);
    if (error) setMessage(error.message);
    loadTimelineEvents();
    loadActivityLog();
  }

  async function loadUsers() {
    const { data } = await supabase.rpc('get_users_for_moderation');
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
    loadActivityLog();
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
    loadActivityLog();
  }

  async function toggleBan(id, banned) {
    if (banned && !window.confirm('Ban this account? They will no longer be able to submit reports or suggestions.')) return;
    setMessage('');
    const { error } = await supabase.rpc('moderator_set_banned', { target_id: id, new_banned: banned });
    if (error) setMessage(error.message);
    loadUsers();
    loadActivityLog();
  }

  function startNameEdit(u) {
    setNameDrafts((prev) => ({ ...prev, [u.id]: u.display_name || '' }));
  }
  function cancelNameEdit(id) {
    setNameDrafts((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }
  async function saveNameEdit(id) {
    setMessage('');
    const { error } = await supabase.rpc('moderator_set_display_name', {
      target_id: id,
      new_name: nameDrafts[id] || '',
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    cancelNameEdit(id);
    loadUsers();
    loadActivityLog();
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
    loadActivityLog();
  }

  async function deleteReport(id) {
    if (!window.confirm('Delete this report permanently? This cannot be undone.')) return;
    setMessage('');
    const { error } = await supabase.from('suggestions').delete().eq('id', id);
    if (error) setMessage(error.message);
    loadReports();
    loadActivityLog();
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
    loadActivityLog();
  }

  async function removeImage(imageId) {
    if (!window.confirm('Remove this image?')) return;
    setMessage('');
    const { error } = await supabase.from('report_images').delete().eq('id', imageId);
    if (error) setMessage(error.message);
    loadReports();
    loadActivityLog();
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
    loadActivityLog();
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

  const isModOrAdmin = profile && roleLevel(profile.role) >= 2;
  const isAdmin = profile && roleLevel(profile.role) >= 3;
  const visibleReports = reports
    .filter((r) => statusFilter === 'all' || r.status === statusFilter)
    .filter((r) => matchesSearch(r, reportSearch));
  const visibleUsers = users
    .filter((u) => matchesAccountStatus(u, userStatusFilter))
    .filter((u) => elevationFilter === 'all' || u.role === elevationFilter);
  const pendingClusters = {};
  const pendingReports = reports.filter((r) => r.status === 'pending' && r.lat != null && r.lng != null);
  const approvedReports = reports.filter((r) => r.status === 'approved' && r.lat != null && r.lng != null);
  const nearbyCandidates = [...pendingReports, ...approvedReports];
  pendingReports.forEach((a) => {
    const others = nearbyCandidates.filter(
      (b) =>
        b.id !== a.id &&
        haversineMeters(a.lat, a.lng, b.lat, b.lng) <= DUPLICATE_RADIUS_METERS
    );
    if (others.length > 0) pendingClusters[a.id] = others;
  });
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
            <button
              className={`filter-btn ${section === 'users' ? 'active' : ''}`}
              onClick={() => setSection('users')}
            >
              User accounts
            </button>
            <button
              className={`filter-btn ${section === 'activity' ? 'active' : ''}`}
              onClick={() => setSection('activity')}
            >
              Activity
            </button>
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

        {isModOrAdmin && section === 'users' && (
          <>
            {isAdmin && requests.length > 0 && (
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
              {isAdmin ? "All accounts — manage anyone below your level." : 'Accounts you can moderate.'}
            </p>

            <div className="filter-row">
              {ACCOUNT_STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${userStatusFilter === f ? 'active' : ''}`}
                  onClick={() => setUserStatusFilter(f)}
                >
                  {f} {f !== 'all' && `(${users.filter((u) => matchesAccountStatus(u, f)).length})`}
                </button>
              ))}
            </div>
            <div className="filter-row">
              {ELEVATION_FILTERS.map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${elevationFilter === f ? 'active' : ''}`}
                  onClick={() => setElevationFilter(f)}
                >
                  {f} {f !== 'all' && `(${users.filter((u) => u.role === f).length})`}
                </button>
              ))}
            </div>

            {visibleUsers.length === 0 && (
              <div className="empty">
                {users.length === 0 ? 'No accounts yet.' : 'No accounts match these filters.'}
              </div>
            )}
            {visibleUsers.map((u) => {
              const canManage = roleLevel(u.role) < roleLevel(profile.role);
              const nameDraft = nameDrafts[u.id];
              return (
                <div className="card" key={u.id}>
                  <h3>{u.email}</h3>
                  {nameDraft !== undefined ? (
                    <div style={{ marginBottom: 8 }}>
                      <input
                        type="text"
                        value={nameDraft}
                        onChange={(e) => setNameDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        maxLength={60}
                      />
                      <div className="row" style={{ marginTop: 6 }}>
                        <button className="btn outline" onClick={() => saveNameEdit(u.id)}>Save</button>
                        <button className="btn outline" onClick={() => cancelNameEdit(u.id)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    u.display_name && <div className="meta" style={{ marginBottom: 8 }}>{u.display_name}</div>
                  )}
                  <span className={`badge role-${u.role}`}>{u.role}</span>
                  {u.banned && <span className="badge banned">Banned</span>}
                  {!u.email_confirmed_at && <span className="badge pending">Unconfirmed</span>}
                  {u.moderator_status && u.moderator_status !== 'none' && (
                    <span className="badge cat">Moderator request: {u.moderator_status}</span>
                  )}
                  <div className="meta">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                  <div className="row" style={{ marginTop: 8 }}>
                    <a className="btn outline" href={`/profile/${u.id}`}>View public profile</a>
                    {canManage && nameDraft === undefined && (
                      <button className="btn outline" onClick={() => startNameEdit(u)}>Edit name</button>
                    )}
                    {canManage && (
                      <button
                        className={u.banned ? 'btn teal' : 'btn coral'}
                        style={{ marginLeft: 'auto' }}
                        onClick={() => toggleBan(u.id, !u.banned)}
                      >
                        {u.banned ? 'Unban' : 'Ban'}
                      </button>
                    )}
                  </div>
                  {isAdmin && canManage && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ margin: '0 0 6px' }}>Role</label>
                      <select value={u.role} onChange={(e) => setUserRole(u.id, e.target.value)}>
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!canManage && (
                    <p className="hint" style={{ marginTop: 6 }}>
                      {u.id === user.id ? "You can't manage your own account." : "You can't manage this account."}
                    </p>
                  )}
                </div>
              );
            })}
          </>
        )}

        {isModOrAdmin && section === 'activity' && (
          <>
            <p className="hint" style={{ margin: '4px 0 10px' }}>
              Every suggestion and moderation action, most recent first.
            </p>
            {activityLog.length === 0 && <div className="empty">No activity yet.</div>}
            {activityLog.map((entry) => (
              <div className="card" key={entry.id}>
                <div className="meta">{new Date(entry.created_at).toLocaleString()}</div>
                <p style={{ margin: 0 }}>
                  <strong>{entry.actor_display_name || entry.actor_email || 'Someone'}</strong>{' '}
                  {ACTIVITY_LABELS[entry.action] || entry.action}
                  {entry.detail?.title && <> — &quot;{entry.detail.title}&quot;</>}
                  {entry.detail?.from && entry.detail?.to && (
                    <> ({entry.detail.from} → {entry.detail.to})</>
                  )}
                </p>
                {entry.target_type === 'suggestion' && entry.target_id && (
                  <a className="btn outline" style={{ marginTop: 8 }} href={`/report/${entry.target_id}`}>
                    View report
                  </a>
                )}
              </div>
            ))}
          </>
        )}

        {isModOrAdmin && section === 'reports' && (
          <>
            <input
              type="text"
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Search reports by title, description, or category…"
              style={{ marginTop: 14 }}
            />
            <div className="filter-row">
              {['all', ...STATUSES].map((f) => (
                <button
                  key={f}
                  className={`filter-btn ${statusFilter === f ? 'active' : ''}`}
                  onClick={() => {
                    if (statusFilter === f) setEditing({});
                    else setStatusFilter(f);
                  }}
                >
                  {f} {f !== 'all' && `(${reports.filter((r) => r.status === f).length})`}
                </button>
              ))}
            </div>

            <button
              className="btn outline"
              style={{ margin: '10px 0' }}
              disabled={visibleReports.length === 0}
              onClick={() => downloadCsv(`reports-${statusFilter}.csv`, reportsToCsv(visibleReports))}
            >
              Export {visibleReports.length} report{visibleReports.length === 1 ? '' : 's'} to CSV
            </button>

            {visibleReports.length === 0 && (
              <div className="empty">{reportSearch.trim() ? 'No reports match your search.' : 'No reports in this view.'}</div>
            )}
            {visibleReports.map((s) => {
              const edit = editing[s.id];
              return (
                <div className="card" key={s.id}>
                  {!edit && <ImageGallery images={s.report_images} />}
                  <span className={`badge ${s.status}`}>{s.status}</span>
                  <span className="badge cat">{s.category}</span>

                  {!edit && pendingClusters[s.id] && (
                    <p className="hint" style={{ color: 'var(--coral)', margin: '8px 0 0' }}>
                      ⚠ {pendingClusters[s.id].length} other report
                      {pendingClusters[s.id].length > 1 ? 's' : ''} nearby, possible duplicate:{' '}
                      {pendingClusters[s.id]
                        .map((r) => `${r.title} (${r.status})`)
                        .join(', ')}
                    </p>
                  )}

                  {edit ? (
                    <>
                      <label>Title</label>
                      <input type="text" value={edit.title} onChange={(e) => updateField(s.id, 'title', e.target.value)} />
                      <label>Details</label>
                      <textarea value={edit.description} onChange={(e) => updateField(s.id, 'description', e.target.value)} />
                      <label>Category</label>
                      <select value={edit.category} onChange={(e) => updateField(s.id, 'category', e.target.value)}>
                        {!CATEGORIES.includes(edit.category) && edit.category && (
                          <option value={edit.category}>{edit.category}</option>
                        )}
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
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
                    {s.user_id && (
                      <>
                        {' · reported by '}
                        <a href={`/profile/${s.user_id}`} style={{ color: 'var(--teal)' }}>
                          {s.reporter_display_name || 'Community member'}
                        </a>
                      </>
                    )}
                  </div>

                  {!edit && s.status === 'pending' && (
                    <p
                      className="hint"
                      style={{ margin: '4px 0 0', color: daysPending(s.submitted_at) >= STALE_DAYS ? 'var(--coral)' : 'var(--chalk-dim)' }}
                    >
                      {daysPending(s.submitted_at) === 0
                        ? 'Submitted today'
                        : `Pending ${daysPending(s.submitted_at)} day${daysPending(s.submitted_at) === 1 ? '' : 's'}`}
                    </p>
                  )}

                  {!edit && (s.subscribers?.[0]?.count ?? 0) > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <button className="btn outline" onClick={() => toggleSubscribers(s.id)}>
                        Interested ({s.subscribers[0].count})
                      </button>
                      {subscriberLists[s.id] === null && <p className="hint" style={{ marginTop: 6 }}>Loading…</p>}
                      {Array.isArray(subscriberLists[s.id]) && (
                        <div className="hint" style={{ marginTop: 6 }}>
                          {subscriberLists[s.id].length === 0 ? (
                            'No one yet.'
                          ) : (
                            subscriberLists[s.id].map((sub, i) => (
                              <div key={i}>{sub.email}</div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
      const marker = L.marker(start, { icon: dotIcon(L, 'var(--yellow)') }).addTo(map);
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
