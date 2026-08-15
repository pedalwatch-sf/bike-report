'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useUser } from '../../lib/useUser';

export default function AccountPage() {
  const user = useUser();
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [factors, setFactors] = useState([]);
  const [mfaStage, setMfaStage] = useState('idle'); // idle | enrolling
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState('');

  useEffect(() => {
    if (user) {
      loadProfile();
      loadFactors();
    }
  }, [user]);

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp || []).filter((f) => f.status === 'verified'));
  }

  async function startEnroll() {
    setMfaMessage('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      setMfaMessage(error.message);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setMfaStage('enrolling');
  }

  async function verifyEnroll() {
    setMfaBusy(true);
    setMfaMessage('');
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError) {
      setMfaBusy(false);
      setMfaMessage(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: verifyCode.trim(),
    });
    setMfaBusy(false);
    if (verifyError) {
      setMfaMessage(verifyError.message);
      return;
    }
    setMfaStage('idle');
    setVerifyCode('');
    loadFactors();
  }

  async function cancelEnroll() {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setMfaStage('idle');
    setVerifyCode('');
    setQrCode('');
    setSecret('');
    setFactorId('');
    setMfaMessage('');
  }

  async function disableFactor(id) {
    if (!window.confirm('Turn off two-factor authentication?')) return;
    setMfaMessage('');
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      setMfaMessage(error.message);
      return;
    }
    loadFactors();
  }

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
        <div className="content"><p className="hint">Loading…</p></div>
      </main>
    );
  }

  if (!user) {
    return (
      <main>
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

        <div className="card">
          <h3>Two-factor authentication</h3>
          {factors.length > 0 ? (
            <>
              <p className="hint">Enabled — {factors[0].friendly_name || 'Authenticator app'}</p>
              <button className="btn coral" onClick={() => disableFactor(factors[0].id)}>Turn off</button>
            </>
          ) : mfaStage === 'enrolling' ? (
            <>
              <p className="hint">
                Scan this QR code with an authenticator app (Apple Passwords, Google
                Authenticator, 1Password, etc.), then enter the code it shows.
              </p>
              {qrCode && (
                <img
                  src={qrCode}
                  alt="Scan to set up two-factor authentication"
                  style={{ background: '#fff', padding: 8, borderRadius: 'var(--radius-sm)' }}
                />
              )}
              <p className="coords">Can&apos;t scan? Enter this key manually: {secret}</p>
              <label>Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.trim())}
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={verifyEnroll} disabled={mfaBusy || !verifyCode}>
                  {mfaBusy ? 'Verifying…' : 'Enable'}
                </button>
                <button className="btn outline" onClick={cancelEnroll}>Cancel</button>
              </div>
            </>
          ) : (
            <>
              <p className="hint">Not enabled. Add an authenticator app for an extra step at sign-in.</p>
              <button className="btn outline" onClick={startEnroll}>Enable 2FA</button>
            </>
          )}
          {mfaMessage && <p className="hint" style={{ color: 'var(--coral)', marginTop: 10 }}>{mfaMessage}</p>}
        </div>
      </div>
    </main>
  );
}
