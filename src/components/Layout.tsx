import { useEffect, useMemo, useRef, useState } from 'react';
import { BRAND } from '../lib/brand';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { isLiveNow, relTime } from '../lib/format';
import { IMG, CREDITS } from '../lib/images';
import LiveProviderStrip from './LiveProviderStrip';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/live', label: 'Live Sports' },
  { to: '/football', label: 'Football' },
  { to: '/cricket', label: 'Cricket' },
  { to: '/basketball', label: 'Basketball' },
  { to: '/tennis', label: 'Tennis' },
  { to: '/motorsports', label: 'Motorsports' },
  { to: '/highlights', label: 'Highlights' },
  { to: '/channels', label: 'Channels' },
  { to: '/connect', label: 'Live TV' },
  { to: '/schedule', label: 'Schedule' }
];

export function BrandMark() {
  return (
    <span className="brand">
      <img className="brand-img" src={BRAND.mark} alt={BRAND.company} width={34} height={34} />
      <span className="brand-text">
        <b>{BRAND.product}</b>
        <i>{BRAND.company}</i>
      </span>
    </span>
  );
}

function Notifications() {
  const { notifications, unread, markAllRead, markRead } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div className="rel" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications (${unread} unread)`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M12 22a2.6 2.6 0 0 0 2.6-2.6H9.4A2.6 2.6 0 0 0 12 22Zm7.2-6.2v-5a7.2 7.2 0 1 0-14.4 0v5L3 18.4v1.2h18v-1.2Z" /></svg>
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      {open && (
        <div className="menu" style={{ minWidth: 320, maxHeight: 420, overflowY: 'auto' }}>
          <div className="row-between" style={{ padding: '12px 14px' }}>
            <b>Notifications</b>
            <button className="btn btn-sm btn-ghost" onClick={markAllRead} disabled={!unread}>Mark all read</button>
          </div>
          <div className="sep" />
          {notifications.length === 0 && <div style={{ padding: 16 }} className="muted small">Nothing yet. Favourite a competition to get kick-off reminders.</div>}
          {notifications.map((n) => (
            <button key={n.id} onClick={() => markRead(n.id)} style={{ display: 'block', opacity: n.read ? 0.62 : 1 }}>
              <span style={{ display: 'block' }}>
                <b style={{ fontSize: 13.5 }}>{n.title}</b>
                <div className="muted tiny">{n.body}</div>
                <div className="muted tiny">{relTime(n.at)}</div>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Account() {
  const { user, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  if (!user) {
    return (
      <div className="row" style={{ gap: 8 }}>
        <Link className="btn btn-sm btn-ghost" to="/login">Sign in</Link>
        <Link className="btn btn-sm btn-lime" to="/login?mode=register">Join</Link>
      </div>
    );
  }
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="rel" ref={ref}>
      <button className="icon-btn" style={{ border: 0, background: 'none', width: 'auto', padding: 0 }} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" title={`${user.name} · ${user.role}`}>{initials}</span>
      </button>
      {open && (
        <div className="menu">
          <div style={{ padding: '12px 14px' }}>
            <b>{user.name}</b>
            <div className="muted tiny">{user.email}</div>
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <span className="pill pill-lime">{user.plan.toUpperCase()}</span>
              <span className="pill">{user.role.toUpperCase()}</span>
            </div>
          </div>
          <div className="sep" />
          <Link to="/profile" onClick={() => setOpen(false)}>My profile</Link>
          <Link to="/favorites" onClick={() => setOpen(false)}>My favourites</Link>
          {user.role === 'admin' && <Link to="/admin" onClick={() => setOpen(false)}>Admin dashboard</Link>}
          <div className="sep" />
          <button onClick={() => { setOpen(false); signOut(); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { catalog, loading, toasts, dismiss, unread } = useApp();
  const [drawer, setDrawer] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState('');
  const liveCount = useMemo(() => catalog.matches.filter(isLiveNow).length, [catalog]);
  useEffect(() => { setDrawer(false); window.scrollTo({ top: 0 }); }, [loc.pathname]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <>
      <div className="topbar">
        <div className="wrap wrap-wide">
          <span className="row" style={{ gap: 9 }}>
            <span className="dot" />
            <b>{loading ? 'Connecting to the sports feed…' : `${liveCount} matches live now`}</b>
            <span className="mute hide-xs">· Multi-device streaming · Up to 4K</span>
          </span>
          <span className="row hide-xs" style={{ gap: 16 }}>
            <span>Support 24/7</span>
            <span>Only licensed streams</span>
          </span>
        </div>
      </div>

      <header className="nav">
        <div className="wrap wrap-wide">
          <Link to="/" className="brand" aria-label="MagxTV home">
            <BrandMark /><span>Magx<b>TV</b></span>
          </Link>
          <nav className="nav-links" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{n.label}</NavLink>
            ))}
          </nav>
          <form className="searchbox" role="search" onSubmit={submit}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5 5 1.4-1.4-5-5A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" /></svg>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams, leagues, matches" aria-label="Search" />
          </form>
          <div className="row" style={{ gap: 8 }}>
            <Notifications />
            <Link className="icon-btn burger-hide-pill" to="/favorites" aria-label="Favourites" style={{ color: 'inherit' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 21s-7.5-4.8-9.4-9A5.6 5.6 0 0 1 12 5.6 5.6 5.6 0 0 1 21.4 12c-1.9 4.2-9.4 9-9.4 9Z" /></svg>
            </Link>
            <Account />
            <button className="icon-btn burger" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer((d) => !d)}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M3 5h18v2.4H3Zm0 5.8h18v2.4H3Zm0 5.8h18V19H3Z" /></svg>
            </button>
          </div>
        </div>
      </header>

      <div className={`mobile-drawer${drawer ? ' open' : ''}`}>
        <div className="wrap wrap-wide">
          <form className="searchbox" role="search" onSubmit={submit} style={{ display: 'flex', marginBottom: 8 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams, leagues, matches" aria-label="Search" />
          </form>
          {NAV.concat([{ to: '/favorites', label: `Favourites${unread ? '' : ''}` }, { to: '/profile', label: 'Profile' }, { to: '/admin', label: 'Admin Dashboard' }]).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{n.label}</NavLink>
          ))}
        </div>
      </div>

      <main id="main">
        <LiveProviderStrip />
      <Outlet />
      </main>

      <footer className="mx-footer">
        <div className="wrap wrap-wide">
          <div className="footer-grid">
            <div>
              <Link to="/" className="brand" style={{ marginBottom: 12 }}><BrandMark /><span>Magx<b>TV</b></span></Link>
              <p className="small">MagxTV is a demonstration sports streaming front-end. Playback is limited to openly licensed test streams, and every catalogue payload is labelled when it comes from the bundled demo provider.</p>
              <div className="row" style={{ gap: 10 }}><span className="age">18+</span><span className="small">Licensed content only</span></div>
            </div>
            <div>
              <h4>Watch</h4>
              <Link to="/live">Live Sports</Link><Link to="/schedule">Schedule</Link>
              <Link to="/highlights">Highlights</Link><Link to="/search">Search</Link>
            </div>
            <div>
              <h4>Sports</h4>
              <Link to="/football">Football</Link><Link to="/cricket">Cricket</Link>
              <Link to="/basketball">Basketball</Link><Link to="/tennis">Tennis</Link><Link to="/motorsports">Motorsports</Link>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/profile">Profile</Link><Link to="/favorites">Favourites</Link>
              <Link to="/login">Sign in</Link><Link to="/admin">Admin dashboard</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} MagxTV. Demo build for evaluation. No league, club or broadcaster marks are used.</span>
            <span>Photography: {CREDITS.slice(0, 4).map((c, i) => (
              <span key={c.link}>{i > 0 ? ', ' : ''}<a href={c.link} target="_blank" rel="noreferrer noopener">{c.source}</a></span>
            ))} · <Link to="/credits">all credits</Link></span>
          </div>
        </div>
        <img src={IMG.footballLights} alt="" aria-hidden="true" style={{ width: '100%', height: 2, objectFit: 'cover', opacity: .5 }} />
      </footer>

      <div className="toast-host" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'good' ? 'good' : t.tone === 'bad' ? 'bad' : ''}`} role="status">
            <span>{t.tone === 'good' ? '✅' : t.tone === 'bad' ? '⛔' : 'ℹ️'}</span>
            <span style={{ flex: 1 }}>{t.text}</span>
            <button className="btn btn-sm btn-ghost" aria-label="Dismiss" onClick={() => dismiss(t.id)}>✕</button>
          </div>
        ))}
      </div>
    </>
  );
}
