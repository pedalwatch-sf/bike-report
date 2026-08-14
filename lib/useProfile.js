'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useUser } from './useUser';

// Same idea as the user cache: remember the last known profile so the
// Moderate tab doesn't have to "re-learn" your role every time you
// navigate to a new page.
let cachedProfile; // { userId, profile }

// profile is undefined while loading, null if signed out, otherwise the row.
export function useProfile() {
  const user = useUser();

  const initial =
    user === undefined
      ? undefined
      : !user
      ? null
      : cachedProfile && cachedProfile.userId === user.id
      ? cachedProfile.profile
      : undefined;

  const [profile, setProfile] = useState(initial);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      cachedProfile = undefined;
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        cachedProfile = { userId: user.id, profile: data || null };
        if (active) setProfile(data || null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { user, profile };
}
