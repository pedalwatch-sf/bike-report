'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function ImpactPage() {
  const [stats, setStats] = useState(undefined);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const { data } = await supabase.rpc('get_public_stats');
    setStats(data?.[0] || null);
  }

  return (
    <main>
      <div className="content">
        <p className="eyebrow">Community impact</p>
        <h1>From report to resolution</h1>
        <p className="hint">
          PedalWatch helps people document damaged or unsafe bike infrastructure
          across San Francisco and follow each issue through review and resolution.
          These totals show what the community has reported and where those reports
          currently stand.
        </p>

        {stats === undefined && <p className="hint">Loading…</p>}
        {stats === null && <p className="hint">Stats aren&apos;t available right now.</p>}

        {stats && (
          <div className="stats-grid">
            <div className="stat-tile">
              <p className="stat-label"><span className="stat-dot" style={{ background: 'var(--chalk-dim)' }} />Reports submitted</p>
              <p className="stat-value">{stats.total_submitted}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label"><span className="stat-dot" style={{ background: 'var(--coral)' }} />In review</p>
              <p className="stat-value">{stats.in_review}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label"><span className="stat-dot" style={{ background: 'var(--teal)' }} />Active</p>
              <p className="stat-value">{stats.active}</p>
            </div>
            <div className="stat-tile">
              <p className="stat-label"><span className="stat-dot" style={{ background: 'var(--yellow)' }} />Resolved</p>
              <p className="stat-value">{stats.resolved}</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
