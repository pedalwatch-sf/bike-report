'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useUser } from '../lib/useUser';

export default function InterestButton({ suggestionId, count, following: initiallyFollowing, onChange }) {
  const user = useUser();
  const [following, setFollowing] = useState(!!initiallyFollowing);
  const [localCount, setLocalCount] = useState(count);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Props seed this state, but only until the viewer acts on it themselves.
  // Browse and the report page both resolve follow state asynchronously, so
  // the first render can carry a stale following={false} that corrects a
  // moment later -- that correction has to land. After the viewer toggles,
  // though, the parent re-renders with its own updated `following` while
  // `count` stays at whatever it loaded with (no caller refetches the
  // subscriber count), so re-seeding then would revert the optimistic count
  // the toggle just applied. Tracked per suggestion: reusing this component
  // for a different report starts over from that report's props.
  const syncedIdRef = useRef(suggestionId);
  const viewerToggledRef = useRef(false);

  useEffect(() => {
    if (syncedIdRef.current !== suggestionId) {
      syncedIdRef.current = suggestionId;
      viewerToggledRef.current = false;
    }
    if (viewerToggledRef.current) return;
    setFollowing(!!initiallyFollowing);
    setLocalCount(count);
  }, [suggestionId, initiallyFollowing, count]);

  async function toggle() {
    if (following && !window.confirm('Stop following this report? You will no longer get updates about it.')) return;
    setSaving(true);
    setError('');
    const rpc = following ? 'unregister_interest' : 'register_interest';
    const { error: rpcError } = await supabase.rpc(rpc, { target_suggestion_id: suggestionId });
    setSaving(false);
    if (rpcError) {
      setError('Something went wrong — try again.');
      return;
    }
    const nowFollowing = !following;
    viewerToggledRef.current = true;
    setFollowing(nowFollowing);
    setLocalCount((c) => c + (nowFollowing ? 1 : -1));
    onChange?.(nowFollowing);
  }

  if (!user) {
    return (
      <div className="row" onClick={(e) => e.stopPropagation()}>
        <div className="interest-count">{localCount}</div>
        <a className="btn outline" href="/login">Sign in to follow</a>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div className="row">
        <div className="interest-count">{localCount}</div>
        <button className={following ? 'btn teal' : 'btn outline'} onClick={toggle} disabled={saving}>
          {following ? "You're following" : "I'm interested"}
        </button>
      </div>
      {error && <p className="hint" style={{ color: 'var(--coral)' }}>{error}</p>}
    </div>
  );
}
