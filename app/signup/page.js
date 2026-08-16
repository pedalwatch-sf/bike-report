'use client';

import { useRef, useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { supabase } from '../../lib/supabaseClient';
import { TURNSTILE_SITE_KEY } from '../../lib/constants';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nameStatus, setNameStatus] = useState('idle'); // idle | checking | available | taken
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captcha = useRef();

  const [signupDone, setSignupDone] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendCaptchaToken, setResendCaptchaToken] = useState('');
  const resendCaptcha = useRef();

  async function checkNameAvailability() {
    const name = displayName.trim();
    if (!name) {
      setNameStatus('idle');
      return;
    }
    setNameStatus('checking');
    const { data: taken, error } = await supabase.rpc('is_display_name_taken', { p_name: name });
    if (error) {
      setNameStatus('idle');
      return;
    }
    setNameStatus(taken ? 'taken' : 'available');
  }

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
      setNameStatus('taken');
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
      setSignupDone(true);
    }
  }

  async function handleResendConfirmation() {
    setResendBusy(true);
    setResendMessage('');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { captchaToken: resendCaptchaToken },
    });
    resendCaptcha.current?.reset();
    setResendCaptchaToken('');
    setResendBusy(false);
    if (error) {
      setResendMessage(error.message);
      return;
    }
    setResendMessage('Confirmation email sent — check your inbox.');
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
          <input
            type="text"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); setNameStatus('idle'); }}
            onBlur={checkNameAvailability}
            maxLength={60}
          />
          {nameStatus === 'checking' && <p className="hint">Checking availability…</p>}
          {nameStatus === 'taken' && <p className="hint" style={{ color: 'var(--coral)' }}>That name is already taken.</p>}
          {nameStatus === 'available' && <p className="hint" style={{ color: 'var(--teal)' }}>Available.</p>}
          {nameStatus === 'idle' && <p className="hint">Shown publicly on your reports. Must be unique.</p>}
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
          {signupDone && (
            <div style={{ marginTop: 14 }}>
              <p className="hint">Didn&apos;t get the email?</p>
              <Turnstile
                ref={resendCaptcha}
                siteKey={TURNSTILE_SITE_KEY}
                options={{ theme: 'dark' }}
                onSuccess={(token) => setResendCaptchaToken(token)}
                onExpire={() => setResendCaptchaToken('')}
              />
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn outline"
                  onClick={handleResendConfirmation}
                  disabled={resendBusy || !resendCaptchaToken}
                >
                  {resendBusy ? 'Sending…' : 'Resend confirmation email'}
                </button>
              </div>
              {resendMessage && <p className="hint" style={{ marginTop: 8 }}>{resendMessage}</p>}
            </div>
          )}
          <p className="hint" style={{ marginTop: 14 }}>
            Already have an account? <a href="/login" style={{ color: 'var(--teal)' }}>Sign in</a>
          </p>
        </div>
      </div>
    </main>
  );
}
