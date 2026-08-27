'use client';

import { useEffect, useState, use } from 'react';
import ReportCard from '../../../components/ReportCard';
import LoadMoreButton from '../../../components/LoadMoreButton';
import { supabase } from '../../../lib/supabaseClient';
import { useUser } from '../../../lib/useUser';
import { isModOrAdmin } from '../../../lib/roles';
import { ACTIVITY_LABELS } from '../../../lib/activityLabels';
import { usePagination } from '../../../lib/usePagination';
import { useReportFeed } from '../../../lib/useReportFeed';

export default function ProfilePage(props) {
  const params = use(props.params);
  const { id } = params;
  const viewer = useUser();

  const [profile, setProfile] = useState(undefined);
  const [myInterests, setMyInterests] = useState(new Set());
  const [viewerIsModOrAdmin, setViewerIsModOrAdmin] = useState(false);
  const [activityLog, setActivityLog] = useState([]);

  const reportsFeed = useReportFeed(
    {
      statuses: ['approved', 'resolved'],
      userId: id,
    },
    `profile-reports|${id}`
  );

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (viewer) {
      loadMyInterests();
      loadViewerRole();
    } else {
      setMyInterests(new Set());
      setViewerIsModOrAdmin(false);
      setActivityLog([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer]);

  async function loadMyInterests() {
    const { data } = await supabase.rpc('get_my_subscriptions');
    setMyInterests(new Set((data || []).map((row) => row.suggestion_id)));
  }

  async function loadViewerRole() {
    const { data } = await supabase.from('profiles').select('role').eq('id', viewer.id).single();
    setViewerIsModOrAdmin(isModOrAdmin(data?.role));
  }

  useEffect(() => {
    if (viewerIsModOrAdmin) loadActivityLog();
    else setActivityLog([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerIsModOrAdmin, id]);

  async function loadActivityLog() {
    const { data } = await supabase.rpc('get_user_activity_log', { p_target_id: id });
    setActivityLog(data || []);
  }

  async function loadProfile() {
    const { data } = await supabase.rpc('get_public_profile', { p_user_id: id });
    setProfile(data?.[0] || null);
  }

  const activityPage = usePagination(activityLog, `activity|${id}`);

  if (profile === undefined) {
    return (
      <main>
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (profile === null) {
    return (
      <main>
        <div className="content">
          <div className="empty">Profile not found.</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="content">
        <div className="card">
          <h3>{profile.display_name || 'Community member'}</h3>
          <div className="meta">Member since {new Date(profile.created_at).toLocaleDateString()}</div>
        </div>

        <p className="hint" style={{ margin: '18px 0 10px' }}>
          Contributions {reportsFeed.total > 0 && `(${reportsFeed.total})`}
        </p>
        {reportsFeed.error && (
          <div className="card" role="alert">
            <h3>Couldn&apos;t load contributions</h3>
            <p>The request failed. Check your connection and try again.</p>
            <button type="button" className="btn outline" onClick={reportsFeed.reload}>Try again</button>
          </div>
        )}
        {reportsFeed.loading && reportsFeed.items.length === 0 && <p className="hint">Loading…</p>}
        {!reportsFeed.loading && !reportsFeed.error && reportsFeed.total === 0 && (
          <div className="empty">No public reports yet.</div>
        )}
        {reportsFeed.items.map((report) => (
          <ReportCard key={report.id} report={report} following={myInterests.has(report.id)} />
        ))}
        <LoadMoreButton
          hasMore={reportsFeed.hasMore}
          remaining={reportsFeed.total - reportsFeed.items.length}
          onClick={reportsFeed.loadMore}
          loading={reportsFeed.loading}
        />

        {viewerIsModOrAdmin && (
          <>
            <p className="hint" style={{ margin: '18px 0 10px' }}>
              Activity {activityLog.length > 0 && `(${activityLog.length})`} — visible to moderators and above only
            </p>
            {activityLog.length === 0 && <div className="empty">No suggestion or moderation activity yet.</div>}
            {activityPage.visible.map((entry) => (
              <div className="card" key={entry.id}>
                <div className="meta">{new Date(entry.created_at).toLocaleString()}</div>
                <p style={{ margin: 0 }}>
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
            <LoadMoreButton
              hasMore={activityPage.hasMore}
              remaining={activityPage.total - activityPage.visible.length}
              onClick={activityPage.loadMore}
            />
          </>
        )}
      </div>
    </main>
  );
}
