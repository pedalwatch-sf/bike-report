import { createClient } from '@supabase/supabase-js';

// This is your project's public URL and "anon" key. They are safe to ship
// in client-side code by design -- Supabase's Row Level Security rules
// (set up on your tables) control what this key is actually allowed to do,
// not secrecy of the key itself.
const SUPABASE_URL = 'https://wtlgeaxxgewhuwjhlemv.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0bGdlYXh4Z2V3aHV3amhsZW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTU2NDIsImV4cCI6MjEwMjIzMTY0Mn0.RZlCK85W_3cDywCONYN73UHuedgjnhSHG0cjHsWQuAA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
