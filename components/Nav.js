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
  const [hasUpdates, setHasUpdates] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasUpdates(false);
      return;
    }
    checkForUpdates();
  }, [user, pathname]);

  async function checkForUpdates() {
    const { data: subs } = await supabase.rpc('get_my_subscriptions');
    const ids = (subs || []).map((s) => s.suggestion_id);
    if (ids.length === 0) {
      setHasUpdates(false);
      return;
    }
    const { data: current } = await supabase.from('suggestions').select('id, status').in('id', ids);
    setHasUpdates(
      (subs || []).some((s) => {
        const r = current?.find((x) => x.id === s.suggestion_id);
        return r && s.last_seen_status && r.status !== s.last_seen_status;
      })
    );
  }

  const tab = (href, label) => (
    <Link href={href} className={`tab ${pathname === href ? 'active' : ''}`}>
      {label}
    </Link>
  );

  return (
    <nav className="tabs">
      {tab('/', 'Browse')}
      {tab('/submit', 'Submit')}
      {tab('/impact', 'Impact')}
      {canModerate && tab('/moderate', 'Moderate')}
      {tab(
        '/account',
        <>
          {user ? 'Account' : 'Sign in'}
          {hasUpdates && <span className="stat-dot" style={{ background: 'var(--coral)', marginLeft: 5 }} />}
        </>
      )}
    </nav>
  );
}
