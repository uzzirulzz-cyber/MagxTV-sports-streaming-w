import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BrandMark } from '../components/Layout';

export default function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { signIn, signUp, user, toast } = useApp();
  const [mode, setMode] = useState<'signin' | 'register'>(params.get('mode') === 'register' ? 'register' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav('/profile', { replace: true }); }, [user, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    if (mode === 'register' && password !== confirm) { setErr('Passwords do not match'); return; }
    if (password.length < 8) { setErr('Password must be at least 8 characters'); return; }
    setBusy(true);
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(name, email, password);
      nav('/profile');
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Something went wrong'); }
    finally { setBusy(false); }
  };

  const quick = async (mail: string, pw: string) => {
    setBusy(true); setErr('');
    try { await signIn(mail, pw); nav('/profile'); }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Sign-in failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="wrap sec">
      <div className="auth-card panel pad">
        <div className="row" style={{ gap: 10, marginBottom: 14 }}>
          <BrandMark /><span className="brand" style={{ fontSize: 20 }}>Magx<span style={{ color: 'var(--cyan)' }}>TV</span></span>
        </div>
        <h1 style={{ fontSize: 26 }}>{mode === 'signin' ? 'Sign in to watch' : 'Create your account'}</h1>
        <p className="muted small">{mode === 'signin' ? 'Streams are limited to signed-in viewers so licence limits are respected.' : 'Favourites, reminders and multi-device playback in one account.'}</p>

        <form className="stack" style={{ gap: 14, marginTop: 18 }} onSubmit={submit}>
          {mode === 'register' && (
            <div className="field"><label htmlFor="name">Full name</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></div>
          )}
          <div className="field"><label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
          <div className="field"><label htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /></div>
          {mode === 'register' && (
            <div className="field"><label htmlFor="cf">Confirm password</label>
              <input id="cf" type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></div>
          )}
          {err && <div className="notice err" role="alert">{err}</div>}
          <button className="btn btn-lime btn-block btn-lg" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>

        <div className="switch-line" style={{ marginTop: 14 }}>
          <span>{mode === 'signin' ? 'New to MagxTV?' : 'Already have an account?'}</span>
          <button className="btn btn-sm btn-ghost" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setErr(''); }}>
            {mode === 'signin' ? 'Create account' : 'Sign in'}
          </button>
        </div>

        <div className="notice" style={{ marginTop: 18, display: 'block' }}>
          <b>Demo accounts</b>
          <div className="small" style={{ marginTop: 6 }}>These exist only in this demo build (stored locally in your browser). With PostgreSQL configured they live in the database instead.</div>
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm" disabled={busy} onClick={() => void quick('demo@magxtv.example', 'MagxDemo#2026')}>Use viewer account · demo@magxtv.example</button>
            <button className="btn btn-sm" disabled={busy} onClick={() => void quick('admin@magxtv.example', 'MagxAdmin#2026')}>Use admin account · admin@magxtv.example</button>
          </div>
        </div>

        <p className="muted tiny" style={{ marginTop: 16 }}>By continuing you confirm you will only watch content you are licensed to stream. <Link to="/credits" style={{ color: 'var(--cyan)' }}>Licensing notes</Link></p>
      </div>
    </div>
  );
}
