'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';
import { useProfile } from '../lib/useProfile';
import { isModOrAdmin } from '../lib/roles';

export default function Nav() {
  const pathname = usePathname();
  const { user, profile } = useProfile();
  const canModerate = profile && isModOrAdmin(profile.role);
  const [pendingCount, setPendingCount] = useState(0);

  // Refetched on every navigation (not just once) so resolving something
  // on Moderate clears the dot as soon as you leave the page, and a new
  // pending item elsewhere gets picked up without a full reload.
  useEffect(() => {
    if (canModerate) loadPendingCount();
    else setPendingCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canModerate, pathname]);

  async function loadPendingCount() {
    const { data, error } = await supabase.rpc('get_moderation_pending_count');
    setPendingCount(error ? 0 : data || 0);
  }

  const tab = (href, label, showDot) => (
    <Link href={href} className={`tab ${pathname === href ? 'active' : ''}`}>
      {label}
      {showDot && <span className="stat-dot" style={{ background: 'var(--coral)', marginLeft: 5 }} />}
    </Link>
  );

  return (
    <nav className="tabs">
      {tab('/', 'Browse')}
      {tab('/submit', 'Submit')}
      {tab('/impact', 'Impact')}
      {canModerate && tab('/moderate', 'Moderate', pendingCount > 0)}
      {tab('/account', user ? 'Account' : 'Sign in')}
    </nav>
  );
}
