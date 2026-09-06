import Link from 'next/link';
import InterestButton from './InterestButton';
import { statusLabel } from '../lib/statusLabel';

export default function ReportCard({ report: s, following, onFollowingChange, updated }) {
  return (
    <article className={`card report-card ${s.report_images?.[0]?.url ? 'has-photo' : ''}`}>
      <Link href={`/report/${s.id}`} className="report-card-link">
        {s.report_images?.[0]?.url && <img src={s.report_images[0].url} alt="" className="card-image" loading="lazy" />}
        <div className="report-card-body">
        {updated && <span className="badge" style={{ background: 'rgba(232, 93, 76, 0.18)', color: 'var(--coral)' }}>● Updated</span>}
        <span className={`badge ${s.status}`}>{statusLabel(s.status)}</span>
        <span className="badge cat">{s.category}</span>
        <h3>{s.title}</h3>
        <p className="report-excerpt">{s.description}</p>
        <span className="report-open">View report <span aria-hidden="true">↗</span></span>
        </div>
      </Link>
      <div className="report-card-footer"><div className="meta">
        Reported {new Date(s.submitted_at).toLocaleDateString()}
        {s.reporter_display_name !== undefined && s.user_id && (
          <>
            {' · by '}
            <Link href={`/profile/${s.user_id}`} style={{ color: 'var(--teal)' }}>
              {s.reporter_display_name || 'Community member'}
            </Link>
          </>
        )}
      </div>
      <InterestButton
        suggestionId={s.id}
        count={s.subscribers?.[0]?.count ?? 0}
        following={following}
        onChange={onFollowingChange}
      />
      </div>
    </article>
  );
}
