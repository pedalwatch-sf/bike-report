'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function InterestButton({ suggestionId, count }) {
  const [stage, setStage] = useState('idle'); // idle | collecting | done
  const [email, setEmail] = useState('');
  const [localCount, setLocalCount] = useState(count);

  async function confirm(withEmail) {
    await supabase.from('subscribers').insert({
      suggestion_id: suggestionId,
      email: withEmail && email.trim() ? email.trim() : null,
    });
    setLocalCount((c) => c + 1);
    setStage('done');
  }

  if (stage === 'done') {
    return (
      <div className="row">
        <div className="interest-count">{localCount}</div>
        <span className="hint">You&apos;re on the list.</span>
      </div>
    );
  }

  if (stage === 'collecting') {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <div className="interest-count">{localCount}</div>
          <input
            type="email"
            placeholder="Email for updates (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ flex: 1, minWidth: 140 }}
          />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn teal" onClick={() => confirm(true)}>Save</button>
          <button className="btn outline" onClick={() => confirm(false)}>Skip email</button>
        </div>
      </div>
    );
  }

  return (
    <div className="row" onClick={(e) => e.stopPropagation()}>
      <div className="interest-count">{localCount}</div>
      <button className="btn outline" onClick={() => setStage('collecting')}>
        I&apos;m interested
      </button>
    </div>
  );
}
