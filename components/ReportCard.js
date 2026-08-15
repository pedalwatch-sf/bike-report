import Link from 'next/link';
import InterestButton from './InterestButton';

export default function ReportCard({ report: s, following, onFollowingChange }) {
  return (
    <div className="card">
      <Link href={`/report/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        {s.report_images?.[0]?.url && <img src={s.report_images[0].url} alt="" className="card-image" />}
        {s.status === 'resolved' && <span className="badge resolved">Resolved</span>}
        <span className="badge cat">{s.category}</span>
        <h3>{s.title}</h3>
        <p>{s.description}</p>
        <div className="meta">Reported {new Date(s.submitted_at).toLocaleDateString()}</div>
      </Link>
      <InterestButton
        suggestionId={s.id}
        count={s.subscribers?.[0]?.count ?? 0}
        following={following}
        onChange={onFollowingChange}
      />
    </div>
  );
}
