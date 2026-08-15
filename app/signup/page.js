'use client';

import { useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { supabase } from '../../lib/supabaseClient';
import { TURNSTILE_SITE_KEY } from '../../lib/constants';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captcha = useRef();

  async function handleSignup() {
    const name = displayName.trim();
    if (!email.trim() || password.length < 6) {
      setMessage('Enter an email and a password with at least 6 characters.');
      return;
    }
    if (!name) {
      setMessage('Choose a display name.');
      return;
    }
    if (name.length > 60) {
      setMessage('Display name must be 60 characters or fewer.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { data: taken, error: takenError } = await supabase.rpc('is_display_name_taken', { p_name: name });
    if (takenError) {
      setBusy(false);
      setMessage(takenError.message);
      return;
    }
    if (taken) {
      setBusy(false);
      setMessage('That display name is already taken.');
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { captchaToken, data: { display_name: name } },
    });
    captcha.current?.reset();
    setCaptchaToken('');
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      setMessage("Account created — you're signed in.");
    } else {
      setMessage('Check your email to confirm your account, then sign in.');
    }
  }

  return (
    <main>
      <div className="content">
        <div className="lock" style={{ maxWidth: 360 }}>
          <h3>Create account</h3>
          <label>Email</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="hint">At least 6 characters.</p>
          <label>Display name</label>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
          <p className="hint">Shown publicly on your reports. Must be unique.</p>
          <div style={{ marginTop: 16 }}>
            <Turnstile
              ref={captcha}
              siteKey={TURNSTILE_SITE_KEY}
              options={{ theme: 'dark' }}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken('')}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={handleSignup} disabled={busy || !captchaToken || !displayName.trim()}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
          {message && <p className="hint" style={{ marginTop: 10 }}>{message}</p>}
          <p className="hint" style={{ marginTop: 14 }}>
            Already have an account? <a href="/login" style={{ color: 'var(--teal)' }}>Sign in</a>
          </p>
        </div>
      </div>
    </main>
  );
}
