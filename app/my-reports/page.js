'use client';

import { useEffect, useState } from 'react';
import ImageGallery from '../../components/ImageGallery';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';

export default function MyReportsPage() {
  const user = useUser();
  const [reports, setReports] = useState(undefined);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) loadReports();
  }, [user]);

  async function loadReports() {
    const { data } = await supabase
      .from('suggestions')
      .select('*, report_images(id, url)')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });
    setReports(data || []);
  }

  async function withdraw(id) {
    if (!window.confirm('Withdraw this submission? A moderator will still be able to see it.')) return;
    setMessage('');
    const { error } = await supabase.rpc('withdraw_own_report', { target_id: id });
    if (error) {
      setMessage(error.message);
      return;
    }
    loadReports();
  }

  if (user === undefined || (user && reports === undefined)) {
    return (
      <main>
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <div className="content">
          <div className="lock">
            <h3>Not signed in</h3>
            <p className="hint">Sign in to see your submitted reports.</p>
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
      <div className="content">
        <p className="eyebrow">My submissions</p>
        {message && <p className="hint">{message}</p>}
        {reports.length === 0 && <div className="empty">You haven&apos;t submitted any reports yet.</div>}
        {reports.map((r) => (
          <div className="card" key={r.id}>
            <ImageGallery images={r.report_images} />
            <span className={`badge ${r.status}`}>{r.status}</span>
            <span className="badge cat">{r.category}</span>
            <h3>{r.title}</h3>
            <p>{r.description}</p>
            <div className="meta">Submitted {new Date(r.submitted_at).toLocaleDateString()}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <a className="btn outline" href={`/report/${r.id}`}>View report</a>
              {r.status !== 'withdrawn' && (
                <button className="btn coral" style={{ marginLeft: 'auto' }} onClick={() => withdraw(r.id)}>
                  Withdraw
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
