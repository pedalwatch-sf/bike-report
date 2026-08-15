'use client';

import { useEffect, useState } from 'react';
import Header from '../../../components/Header';
import Nav from '../../../components/Nav';
import ReportCard from '../../../components/ReportCard';
import { supabase } from '../../../lib/supabaseClient';
import { useUser } from '../../../lib/useUser';

export default function ProfilePage({ params }) {
  const { id } = params;
  const viewer = useUser();

  const [profile, setProfile] = useState(undefined); // undefined = loading, null = not found
  const [reports, setReports] = useState([]);
  const [myInterests, setMyInterests] = useState(new Set());

  useEffect(() => {
    loadProfile();
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (viewer) loadMyInterests();
    else setMyInterests(new Set());
  }, [viewer]);

  async function loadMyInterests() {
    const { data } = await supabase.rpc('get_my_subscriptions');
    setMyInterests(new Set((data || []).map((r) => r.suggestion_id)));
  }

  async function loadProfile() {
    const { data } = await supabase.rpc('get_public_profile', { p_user_id: id });
    setProfile(data?.[0] || null);
  }

  async function loadReports() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, subscribers(count), report_images(url)')
      .eq('user_id', id)
      .in('status', ['approved', 'resolved'])
      .order('submitted_at', { ascending: false });
    setReports(data || []);
  }

  if (profile === undefined) {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (profile === null) {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content">
          <div className="empty">Profile not found.</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <Nav />
      <div className="content">
        <div className="card">
          <h3>{profile.display_name || 'Community member'}</h3>
          <div className="meta">Member since {new Date(profile.created_at).toLocaleDateString()}</div>
        </div>

        <p className="hint" style={{ margin: '18px 0 10px' }}>
          Contributions {reports.length > 0 && `(${reports.length})`}
        </p>
        {reports.length === 0 && <div className="empty">No public reports yet.</div>}
        {reports.map((s) => (
          <ReportCard key={s.id} report={s} following={myInterests.has(s.id)} />
        ))}
      </div>
    </main>
  );
}
