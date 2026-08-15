import Link from 'next/link';
import InterestButton from './InterestButton';
import { statusLabel } from '../lib/statusLabel';

export default function ReportCard({ report: s, following, onFollowingChange, updated }) {
  return (
    <div className="card">
      <Link href={`/report/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        {s.report_images?.[0]?.url && <img src={s.report_images[0].url} alt="" className="card-image" />}
        {updated && <span className="badge" style={{ background: 'rgba(232, 93, 76, 0.18)', color: 'var(--coral)' }}>● Updated</span>}
        <span className={`badge ${s.status}`}>{statusLabel(s.status)}</span>
        <span className="badge cat">{s.category}</span>
        <h3>{s.title}</h3>
        <p>{s.description}</p>
      </Link>
      <div className="meta">
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
  );
}
