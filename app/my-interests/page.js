'use client';

import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import ReportCard from '../../components/ReportCard';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';

export default function MyInterestsPage() {
  const user = useUser();
  const [reports, setReports] = useState(undefined);

  useEffect(() => {
    if (user) loadReports();
  }, [user]);

  async function loadReports() {
    const { data: subs } = await supabase.rpc('get_my_subscriptions');
    const ids = (subs || []).map((r) => r.suggestion_id);
    if (ids.length === 0) {
      setReports([]);
      return;
    }
    const { data } = await supabase
      .from('suggestions')
      .select('*, subscribers(count), report_images(url)')
      .in('id', ids);
    const bySubscribedOrder = ids
      .map((id) => (data || []).find((r) => r.id === id))
      .filter(Boolean);
    setReports(bySubscribedOrder);
  }

  if (user === undefined || (user && reports === undefined)) {
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
            <h3>Not signed in</h3>
            <p className="hint">Sign in to see the reports you're following.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <a className="btn" href="/login">Sign in</a>
              <a className="btn outline" href="/signup">Create account</a>
            </div>
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
        <p className="eyebrow">Reports I&apos;m following</p>
        {reports.length === 0 && (
          <div className="empty">
            You&apos;re not following any reports yet.<br />
            Tap &quot;I&apos;m interested&quot; on a report to get updates here.
          </div>
        )}
        {reports.map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            following
            onFollowingChange={(nowFollowing) => {
              if (!nowFollowing) setReports((prev) => prev.filter((x) => x.id !== r.id));
            }}
          />
        ))}
      </div>
    </main>
  );
}
