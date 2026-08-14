'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Returns undefined while loading, null when signed out, or the user object.
export function useUser() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return user;
}
