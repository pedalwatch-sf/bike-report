'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Module-level cache so that when the Nav (and its hooks) remounts on every
// page navigation, it starts from the last known answer instead of "loading"
// again -- this is what was causing the Moderate tab to flash on and off.
let cachedUser;

// Returns undefined while loading, null when signed out, or the user object.
export function useUser() {
  const [user, setUser] = useState(cachedUser !== undefined ? cachedUser : undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user || null;
      cachedUser = u;
      setUser(u);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      cachedUser = u;
      setUser(u);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return user;
}
