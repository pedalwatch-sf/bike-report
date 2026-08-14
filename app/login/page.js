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
  const router = useRouter();

  async function handleLogin() {
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push('/account');
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
