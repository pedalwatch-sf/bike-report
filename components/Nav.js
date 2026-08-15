'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '../lib/useProfile';
import { isModOrAdmin } from '../lib/roles';

export default function Nav() {
  const pathname = usePathname();
  const { user, profile } = useProfile();
  const canModerate = profile && isModOrAdmin(profile.role);

  const tab = (href, label) => (
    <Link href={href} className={`tab ${pathname === href ? 'active' : ''}`}>
      {label}
    </Link>
  );

  return (
    <nav className="tabs">
      {tab('/', 'Browse')}
      {tab('/submit', 'Submit')}
      {canModerate && tab('/moderate', 'Moderate')}
      {tab('/account', user ? 'Account' : 'Sign in')}
    </nav>
  );
}
