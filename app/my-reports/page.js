'use client';

import { useState } from 'react';
import ImageGallery from '../../components/ImageGallery';
import LoadMoreButton from '../../components/LoadMoreButton';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';
import { useReportFeed } from '../../lib/useReportFeed';

export default function MyReportsPage() {
  const user = useUser();
  const [message, setMessage] = useState('');
  const reportsFeed = useReportFeed(
    {
      userId: user?.id,
      enabled: Boolean(user),
      attachNames: false,
    },
    `my-reports|${user?.id || 'signed-out'}`
  );

  async function withdraw(id) {
    if (!window.confirm('Withdraw this submission? A moderator will still be able to see it.')) return;
    setMessage('');
    const { error } = await supabase.rpc('withdraw_own_report', { target_id: id });
    if (error) {
      setMessage(error.message);
      return;
    }
    reportsFeed.reload();
  }

  if (user === undefined || (user && reportsFeed.loading && reportsFeed.items.length === 0)) {
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
        {reportsFeed.error && (
          <div className="card" role="alert">
            <h3>Couldn&apos;t load your reports</h3>
            <p>The request failed. Check your connection and try again.</p>
            <button type="button" className="btn outline" onClick={reportsFeed.reload}>Try again</button>
          </div>
        )}
        {!reportsFeed.loading && !reportsFeed.error && reportsFeed.total === 0 && (
          <div className="empty">You haven&apos;t submitted any reports yet.</div>
        )}
        {reportsFeed.items.map((report) => (
          <div className="card" key={report.id}>
            <ImageGallery images={report.report_images} />
            <span className={`badge ${report.status}`}>{report.status}</span>
            <span className="badge cat">{report.category}</span>
            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <div className="meta">Submitted {new Date(report.submitted_at).toLocaleDateString()}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <a className="btn outline" href={`/report/${report.id}`}>View report</a>
              {report.status !== 'withdrawn' && (
                <button className="btn coral" style={{ marginLeft: 'auto' }} onClick={() => withdraw(report.id)}>
                  Withdraw
                </button>
              )}
            </div>
          </div>
        ))}
        <LoadMoreButton
          hasMore={reportsFeed.hasMore}
          remaining={reportsFeed.total - reportsFeed.items.length}
          onClick={reportsFeed.loadMore}
          loading={reportsFeed.loading}
        />
      </div>
    </main>
  );
}
