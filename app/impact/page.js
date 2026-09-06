'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';

const METRICS = [
  ['total_submitted', 'Reports submitted', 'All submissions, including reports outside the public map.'],
  ['in_review', 'In review', 'Waiting for community moderation.'],
  ['active', 'Needs attention', 'Approved reports that remain open.'],
  ['resolved', 'Marked resolved', 'Closed by a moderator. See each report for the evidence.'],
];

export default function ImpactPage() {
  const [stats, setStats] = useState(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data, error } = await supabase.rpc('get_public_stats');
        if (!cancelled) setStats(error ? null : data?.[0] || null);
      } catch {
        if (!cancelled) setStats(null);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [attempt]);

  return (
    <main>
      <div className="content impact-content">
        <p className="eyebrow">Community impact</p>
        <h1>A report is the beginning.<br />A better street is the goal.</h1>
        <p className="impact-intro">Local knowledge makes problems visible. Shared evidence and persistent follow-up can help turn those problems into improvements across San Francisco.</p>

        <section aria-label="Community reporting totals" aria-busy={stats === undefined}>
          {stats === undefined && <p className="hint" role="status">Loading community totals…</p>}
          {stats === null && <div className="card" role="alert"><p>Community totals are unavailable right now.</p><button className="btn outline" onClick={() => { setStats(undefined); setAttempt((value) => value + 1); }}>Try again</button></div>}
          {stats && <div className="stats-grid">{METRICS.map(([key, label, description]) => <div className="stat-tile" key={key}><p className="stat-label">{label}</p><p className="stat-value">{Number(stats[key] || 0).toLocaleString()}</p><p className="stat-description">{description}</p></div>)}</div>}
          <p className="hint">These are PedalWatch report statuses, not a count of verified city repairs. Active, in-review, and resolved totals may not add up to all submissions because other statuses are excluded.</p>
        </section>

        <section className="impact-section" aria-labelledby="process-title">
          <p className="eyebrow">The path to change</p>
          <h2 id="process-title">Evidence → review → action → verification</h2>
          <p>PedalWatch supports reporting, moderation, following, and public progress updates today. Contacting the responsible organization and verifying work require people to follow through.</p>
          <ol className="process-grid">
            <li><h3>Document the issue</h3><p>Pin the exact location. Describe the obstacle and who it affects. Add a clear photo, taken from a safe place.</p></li>
            <li><h3>Build a reliable record</h3><p>Moderators review the report. Neighbors can follow it and suggest corrections or new evidence instead of creating duplicates.</p></li>
            <li><h3>Get it to the right people</h3><p>A community organizer or moderator would contact the responsible agency or property owner, then record the reference number, response, and next step in the timeline.</p></li>
            <li><h3>Check what changed</h3><p>After work is reported complete, someone would revisit the location, add dated evidence, and ask a moderator to update the report.</p></li>
          </ol>
        </section>

        <div className="impact-callout"><h2>Visibility helps. Follow-through makes the difference.</h2><p>Submitting here does not automatically file an official service request or notify a city agency. PedalWatch is a community tracker; an active report does not mean work has been scheduled.</p><div className="row"><Link className="btn" href="/">Find an issue to follow</Link><Link className="btn outline" href="/submit">Document an issue</Link></div></div>

        <section className="impact-section" aria-labelledby="official-title"><h2 id="official-title">Ready to make an official request?</h2><p>Choose the route that matches the issue. After you submit through the official service, keep the case number and share the response with PedalWatch through a suggested update.</p><div className="row"><a className="btn outline" href="https://www.sf.gov/report-damaged-public-property" target="_blank" rel="noopener noreferrer">Damaged public property ↗</a><a className="btn outline" href="https://www.sfmta.com/getting-around/walk/general-safety-requests" target="_blank" rel="noopener noreferrer">Street safety requests ↗</a><a className="btn outline" href="https://www.sfmta.com/getting-around/bike/bike-parking" target="_blank" rel="noopener noreferrer">Request bike parking ↗</a></div></section>

        <section className="impact-section" aria-labelledby="evidence-title"><h2 id="evidence-title">What would meaningful impact look like?</h2><p>A stronger record would show when an issue was acknowledged, who took responsibility, what work happened, and whether a resident confirmed the result. Response time, verified fixes, and repeat problems would tell us more than report volume alone.</p><Link className="btn outline" href="/">Explore the community reports →</Link></section>
      </div>
    </main>
  );
}
