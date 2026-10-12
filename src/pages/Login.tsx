/* MagxTV sign-in — premium auth card matching the supplied PlayBeat Digital reference:
   emblem, centred heading, labelled fields, a full-width blue accent button and a
   recessed note box. Both roles authenticate here; the dashboard stays role-guarded. */
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { BRAND } from '../lib/brand';

const ADMIN_HINT = 'admin@magxtv.example';
const USER_HINT = 'demo@magxtv.example';

export default function Login() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { signIn, signUp } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const next = useMemo(
    () => params.get('next') ?? params.get('redirect') ?? '',
    [params]
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Enter your email address and password.'); return; }
    setBusy(true); setError('');
    try {
      const u = mode === 'in'
        ? await signIn(email.trim(), password)
        : await signUp(name.trim() || email.split('@')[0], email.trim(), password);
      nav(next || (u.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Check your details and try again.');
    } finally { setBusy(false); }
  };

  const useHint = (which: 'admin' | 'user') => {
    setMode('in');
    setEmail(which === 'admin' ? ADMIN_HINT : USER_HINT);
    setPassword(which === 'admin' ? 'MagxAdmin#2026' : 'MagxDemo#2026');
    setError('');
  };

  return (
    <div className="wrap sec auth-wrap">
      <div className="auth-card">
        <span className="auth-sheen" aria-hidden="true" />

        <div className="auth-mark" aria-hidden="true">
          <span className="auth-ring" />
          <img src={BRAND.mark} alt={BRAND.company} width={64} height={64} />
        </div>

        <h1 className="auth-title">{mode === 'in' ? `Sign in to ${BRAND.product}` : `Join ${BRAND.product}`}</h1>
        <p className="auth-sub">Restricted — authorised viewers only · {BRAND.company}</p>

        <div className="auth-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'in'}
                  className={`auth-tab${mode === 'in' ? ' is-active' : ''}`} onClick={() => { setMode('in'); setError(''); }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'up'}
                  className={`auth-tab${mode === 'up' ? ' is-active' : ''}`} onClick={() => { setMode('up'); setError(''); }}>Create account</button>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === 'up' && (
            <div className="auth-field">
              <label htmlFor="auth-name">Display name</label>
              <input id="auth-name" name="name" type="text" autoComplete="name" value={name}
                     onChange={(e) => setName(e.target.value)} placeholder="How you appear to others" />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" name="email" type="email" autoComplete="email" required value={email}
                   onChange={(e) => setEmail(e.target.value)} placeholder={ADMIN_HINT} />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <input id="auth-password" name="password" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                   required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button className="auth-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : mode === 'in' ? 'Sign in' : 'Create my account'}
          </button>
        </form>

        <div className="auth-note">
          <b>Sessions and access</b>
          <p>
            Sessions use a signed token issued by the MagxTV API (7-day expiry); the dashboard is
            additionally role-guarded, so a standard account can never reach administration.
          </p>
          <p>
            Provider credentials never reach this browser — it only ever receives short-lived,
            opaque playback grants.
          </p>
        </div>

        <div className="auth-demo">
          <span className="muted small">Demo accounts</span>
          <div className="auth-demo-row">
            <button type="button" className="auth-chip" onClick={() => useHint('admin')}>Administrator</button>
            <button type="button" className="auth-chip" onClick={() => useHint('user')}>Standard viewer</button>
          </div>
        </div>

        <p className="auth-foot small muted">
          <Link to="/">Back to the platform</Link> · <Link to="/credits">Content credits</Link>
        </p>
      </div>
    </div>
  );
}
