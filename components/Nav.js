'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '../lib/useUser';

export default function Nav() {
  const pathname = usePathname();
  const user = useUser();

  const tab = (href, label) => (
    <Link href={href} className={`tab ${pathname === href ? 'active' : ''}`}>
      {label}
    </Link>
  );

  return (
    <nav className="tabs">
      {tab('/', 'Browse')}
      {tab('/submit', 'Submit')}
      {tab('/moderate', 'Moderate')}
      {tab('/account', user ? 'Account' : 'Sign in')}
    </nav>
  );
}
