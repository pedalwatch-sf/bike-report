'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useUser } from './useUser';

// profile is undefined while loading, null if signed out, otherwise the row.
export function useProfile() {
  const user = useUser();
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
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
        if (active) setProfile(data || null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  return { user, profile };
}
