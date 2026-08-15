'use client';

import { useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import Header from '../../components/Header';
import Nav from '../../components/Nav';
import { supabase } from '../../lib/supabaseClient';
import { TURNSTILE_SITE_KEY } from '../../lib/constants';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captcha = useRef();

  async function handleSignup() {
    if (!email.trim() || password.length < 6) {
      setMessage('Enter an email and a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { captchaToken },
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
      <Header />
      <Nav />
      <div className="content">
        <div className="lock" style={{ maxWidth: 360 }}>
          <h3>Create account</h3>
          <label>Email</label>
          <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="hint">At least 6 characters.</p>
          <div style={{ marginTop: 16 }}>
            <Turnstile
              ref={captcha}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken('')}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <button className="btn" onClick={handleSignup} disabled={busy || !captchaToken}>
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
