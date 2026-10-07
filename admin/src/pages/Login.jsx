import React, { useState } from 'react';
import { useStore } from '../store/index.jsx';

export default function Login() {
  const { store } = useStore();
  const [email, setEmail] = useState(store.mode === 'demo' ? 'demo@carevest.com' : '');
  const [password, setPassword] = useState(store.mode === 'demo' ? 'demo' : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [reset, setReset] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (reset) { await store.resetPassword(email); setSent(true); }
      else await store.signIn(email.trim(), password);
    } catch (ex) { setErr(ex.message === 'Invalid login credentials' ? 'That email and password do not match. Please try again.' : ex.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login__art">
        <h2>Keep the CareVest website current, without touching code.</h2>
        <p>Edit headlines and text, update the fund figures, upload the latest documents, then press Publish. Changes go live in about a minute.</p>
      </div>
      <div className="login__form">
        <form className="login__box" onSubmit={submit}>
          <img src="/logo.png" alt="CareVest" />
          <div>
            <h1>{reset ? 'Reset your password' : 'Sign in'}</h1>
            <p className="muted small" style={{ marginTop: 4 }}>{reset ? 'We will email you a link to choose a new password.' : 'Use the email address and password you were given.'}</p>
          </div>
          {store.mode === 'demo' && <div className="banner banner--info small">Demo mode: any email and password will sign you in. Nothing you change here is saved or published.</div>}
          <div className="field"><label>Email</label><input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {!reset && <div className="field"><label>Password</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>}
          {err && <div className="banner banner--bad">{err}</div>}
          {sent && <div className="banner banner--info">Check your inbox for the reset link.</div>}
          <button className="btn btn--primary" type="submit" disabled={busy} style={{ justifyContent: 'center', padding: '11px' }}>{busy && <span className="spin" />}{reset ? 'Send reset link' : 'Sign in'}</button>
          {store.mode !== 'demo' && <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setReset(!reset); setErr(null); setSent(false); }} style={{ justifySelf: 'center' }}>{reset ? 'Back to sign in' : 'Forgot your password?'}</button>}
        </form>
      </div>
    </div>
  );
}

export function SetPassword() {
  const { store } = useStore();
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(null); const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 10) return setErr('Please choose at least 10 characters.');
    if (pw !== pw2) return setErr('The two passwords do not match.');
    setBusy(true); setErr(null);
    try { await store.updatePassword(pw); setDone(true); } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };
  return (
    <div className="login"><div className="login__art"><h2>Choose a new password.</h2></div>
      <div className="login__form"><form className="login__box" onSubmit={submit}>
        <img src="/logo.png" alt="CareVest" /><h1>New password</h1>
        {done ? <div className="banner banner--info">Your password is set. <a href="/">Continue to the dashboard</a>.</div> : <>
          <div className="field"><label>New password</label><input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
          <div className="field"><label>Repeat it</label><input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
          {err && <div className="banner banner--bad">{err}</div>}
          <button className="btn btn--primary" type="submit" disabled={busy}>{busy && <span className="spin" />}Save password</button>
        </>}
      </form></div>
    </div>
  );
}
