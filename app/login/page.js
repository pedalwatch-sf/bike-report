'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('form'); // form | mfa
  const [mfaCode, setMfaCode] = useState('');
  const router = useRouter();

  async function handleLogin() {
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    const { data, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setBusy(false);
    if (!aalError && data.nextLevel === 'aal2' && data.nextLevel !== data.currentLevel) {
      setStage('mfa');
      return;
    }
    router.push('/account');
  }

  async function handleVerifyMfa() {
    setBusy(true);
    setMessage('');
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setBusy(false);
      setMessage(factorsError.message);
      return;
    }
    const totpFactor = factors.totp[0];
    if (!totpFactor) {
      setBusy(false);
      setMessage('No authenticator app is set up on this account.');
      return;
    }
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id,
    });
    if (challengeError) {
      setBusy(false);
      setMessage(challengeError.message);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: mfaCode.trim(),
    });
    setBusy(false);
    if (verifyError) {
      setMessage(verifyError.message);
      return;
    }
    router.push('/account');
  }

  if (stage === 'mfa') {
    return (
      <main>
        <Header />
        <Nav />
        <div className="content">
          <div className="lock" style={{ maxWidth: 360 }}>
            <h3>Enter your code</h3>
            <p className="hint">Open your authenticator app and enter the 6-digit code.</p>
            <label>Verification code</label>
            <input
              type="text"
              inputMode="numeric"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.trim())}
              autoFocus
            />
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={handleVerifyMfa} disabled={busy || !mfaCode}>
                {busy ? 'Verifying…' : 'Verify'}
              </button>
            </div>
            {message && <p className="hint" style={{ color: 'var(--coral)' }}>{message}</p>}
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
        <div className="lock" style={{ maxWidth: 360 }}>
          <h3>Sign in</h3>
          <label>Email</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={handleLogin} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
          {message && <p className="hint" style={{ color: 'var(--coral)' }}>{message}</p>}
          <p className="hint" style={{ marginTop: 14 }}>
            No account yet? <a href="/signup" style={{ color: 'var(--teal)' }}>Create one</a>
          </p>
        </div>
      </div>
    </main>
  );
}
