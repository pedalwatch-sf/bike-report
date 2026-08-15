'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

// Landed on from the password reset link Supabase emails after
// auth.resetPasswordForEmail (see /login's "Forgot password?" flow).
// Clicking that link makes supabase-js establish a short-lived recovery
// session client-side before this page ever runs, so there's nothing to
// wait for here -- submitting just calls updateUser with that session.
// If the link was invalid or has expired, updateUser fails and we show
// that as an error rather than gating the form on an auth event.
export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleReset() {
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setMessage('Passwords don’t match.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage(
        error.message.toLowerCase().includes('session')
          ? 'This reset link is invalid or has expired. Request a new one from the sign-in page.'
          : error.message
      );
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main>
        <div className="content">
          <div className="lock" style={{ maxWidth: 360 }}>
            <h3>Password updated</h3>
            <p className="hint">Your password has been changed.</p>
            <div style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => router.push('/account')}>Continue</button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="content">
        <div className="lock" style={{ maxWidth: 360 }}>
          <h3>Set a new password</h3>
          <label>New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          <label>Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <p className="hint">At least 6 characters.</p>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={handleReset} disabled={busy || !password || !confirm}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </div>
          {message && <p className="hint" style={{ marginTop: 10, color: 'var(--coral)' }}>{message}</p>}
        </div>
      </div>
    </main>
  );
}
