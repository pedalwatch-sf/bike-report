import Link from 'next/link';

export default function Header() {
  return (
    <header className="page-header">
      <Link href="/" className="brand" aria-label="PedalWatch home">
        <img src="/logo.png" alt="" className="shield" width="48" height="48" />
        <span><strong>PedalWatch<span className="brand-period">.</span></strong><span className="brand-caption">Community-powered street improvements</span></span>
      </Link>
      <span className="city-label"><span className="stat-dot" />San Francisco, CA</span>
    </header>
  );
}
