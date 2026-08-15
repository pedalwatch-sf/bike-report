'use client';

import { useEffect, useState } from 'react';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';

export default function AccountPage() {
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setProfile(data);
    setDisplayName(data?.display_name || '');
  }

  async function saveDisplayName() {
    setSavingName(true);
    setMessage('');
    const { error } = await supabase.rpc('set_display_name', { new_name: displayName });
    setSavingName(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    loadProfile();
  }

  async function requestModerator() {
    setMessage('');
    const { error } = await supabase.rpc('request_moderator_access');
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Request sent — you'll be able to moderate once approved.");
    loadProfile();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (user === undefined) {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content">
          <div className="lock">
            <h3>Not signed in</h3>
            <p className="hint">Sign in or create an account to submit reports.</p>
            <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
              <a className="btn" href="/login">Sign in</a>
              <a className="btn outline" href="/signup">Create account</a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <Header />
      <Nav />
      <div className="content">
        <div className="card">
          <h3>{user.email}</h3>
          <div className="meta">
            {profile?.role === 'owner' && 'Owner account'}
            {profile?.role === 'admin' && 'Admin account'}
            {profile?.role === 'moderator' && 'Moderator'}
            {profile?.role === 'user' && profile?.moderator_status === 'pending' && 'Moderator request pending'}
            {profile?.role === 'user' && profile?.moderator_status === 'denied' && 'Moderator request declined'}
            {profile?.role === 'user' && (!profile?.moderator_status || profile?.moderator_status === 'none') && 'Community member'}
          </div>

          {profile?.role === 'user' &&
            (profile?.moderator_status === 'none' || !profile?.moderator_status || profile?.moderator_status === 'denied') && (
              <button className="btn outline" onClick={requestModerator}>Request moderator access</button>
            )}

          <label>Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Shown publicly on your reports instead of your email"
            maxLength={60}
          />
          <div style={{ marginTop: 10 }}>
            <button className="btn outline" onClick={saveDisplayName} disabled={savingName}>
              {savingName ? 'Saving…' : 'Save name'}
            </button>
          </div>

          {message && <p className="hint" style={{ marginTop: 10 }}>{message}</p>}

          <div style={{ marginTop: 16 }} className="row">
            <a className="btn outline" href={`/profile/${user.id}`}>View public profile</a>
            <a className="btn outline" href="/my-reports">My submissions</a>
            <button className="btn outline" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </div>
    </main>
  );
}
