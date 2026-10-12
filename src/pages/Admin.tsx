import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Empty, SectionHead } from '../components/common';
import * as api from '../lib/api';
import type { AdminUser } from '../lib/api';
import { CATEGORY_DEFS, SPORTS } from '../lib/catalog';
import AdminBroadcast from '../components/AdminBroadcast';
import { isLiveNow } from '../lib/format';
import type { SportId } from '../lib/types';

export default function Admin() {
  const { user, catalog, status, favorites, notifications, toast } = useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'catalogue' | 'broadcast' | 'streams'>('overview');
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [sport, setSport] = useState<SportId | 'all'>('all');

  const load = useMemo(() => async () => {
    try { setUsers(await api.adminUsers()); } catch { setUsers([]); }
  }, []);

  useEffect(() => { if (user?.role === 'admin') void load(); }, [user, load]);

  if (!user) {
    return <div className="wrap sec"><Empty title="Administrator sign-in required" body="The dashboard is role-protected. Sign in with an administrator account."
      action={<Link className="btn btn-lime" to="/login">Sign in</Link>} /></div>;
  }
  if (user.role !== 'admin') {
    return <div className="wrap sec"><Empty title="Not authorised" body={`Signed in as ${user.name} (${user.role}). Administrator rights are required to view this dashboard.`}
      action={<Link className="btn btn-lime" to="/login">Use an admin account</Link>} /></div>;
  }

  const live = catalog.matches.filter(isLiveNow);
  const premium = catalog.matches.filter((m) => m.premium);
  const filtered = catalog.matches
    .filter((m) => sport === 'all' || m.sport === sport)
    .filter((m) => q.trim() === '' || (m.home.name + m.away.name + m.leagueName).toLowerCase().includes(q.trim().toLowerCase()));

  const setRole = async (id: string, role: 'user' | 'admin') => {
    setBusy(id);
    try {
      const next = await api.adminUpdateUser(id, { role });
      setUsers(next);
      toast(`Role updated to ${role}`, 'good');
    } catch { toast('Could not update that account', 'bad'); }
    finally { setBusy(''); }
  };

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead eyebrow="Operations" title="Admin dashboard"
        sub="Live catalogue health, role management and stream-source governance for this PlayBeat Digital deployment."
        action={<span className={`pill ${status.demo ? 'pill-lime' : 'pill-cyan'}`}>{status.demo ? 'DEMO PROVIDER' : `PROVIDER: ${status.provider.toUpperCase()}`}</span>} />

      <div className="tabs" style={{ marginBottom: 22 }}>
        {(['overview', 'users', 'catalogue', 'broadcast', 'streams'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 22 }}>
            <div className="kpi"><b>{catalog.matches.length}</b><small>Matches in catalogue</small></div>
            <div className="kpi"><b>{live.length}</b><small>Currently live</small></div>
            <div className="kpi"><b>{users.length}</b><small>Registered accounts</small></div>
            <div className="kpi"><b>{premium.length}</b><small>Premium-mapped matches</small></div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))' }}>
            <div className="panel pad">
              <b>Sport distribution</b>
              <div className="stack" style={{ gap: 12, marginTop: 12 }}>
                {SPORTS.map((s) => {
                  const n = catalog.matches.filter((m) => m.sport === s.id).length;
                  const pctv = catalog.matches.length ? Math.round((n / catalog.matches.length) * 100) : 0;
                  return (
                    <div key={s.id} className="bar-row">
                      <span>{s.icon} {s.label}</span>
                      <span className="bar"><i style={{ width: `${pctv}%` }} /></span>
                      <span className="mono">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel pad">
              <b>Provider &amp; integration status</b>
              <div className="stack" style={{ gap: 10, marginTop: 12 }}>
                <div className="row-between"><span className="muted">Sports data provider</span><b>{status.provider}</b></div>
                <div className="row-between"><span className="muted">Mode</span><b>{status.demo ? 'Demo data (flagged)' : 'Live integration'}</b></div>
                <div className="row-between"><span className="muted">API base URL</span><b>{status.baseUrl || 'not set'}</b></div>
                <div className="row-between"><span className="muted">Auth backend</span><b>{api.API_CONFIGURED ? 'PostgreSQL via API' : 'Local demo store'}</b></div>
                <div className="row-between"><span className="muted">Favourites recorded</span><b>{favorites.length}</b></div>
                <div className="row-between"><span className="muted">Notifications queued</span><b>{notifications.length}</b></div>
              </div>
              <div className={`notice ${status.demo ? 'warn' : ''}`} style={{ marginTop: 14 }}>{status.message}</div>
            </div>
          </div>
        </>
      )}

      {tab === 'users' && (
        <>
          <div className="row-between" style={{ marginBottom: 14 }}>
            <p className="muted small" style={{ margin: 0 }}>Role changes apply immediately and are checked again server-side on every privileged request.</p>
            <button className="btn btn-sm" onClick={() => void load()}>Refresh</button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th><th>Joined</th><th className="num">Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td><td className="muted">{u.email}</td>
                    <td><span className={`pill ${u.role === 'admin' ? 'pill-lime' : ''}`}>{u.role}</span></td>
                    <td>{u.plan}</td><td className="muted">{new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
                    <td className="num">
                      <button className="btn btn-sm" disabled={busy === u.id} onClick={() => void setRole(u.id, u.role === 'admin' ? 'user' : 'admin')}>
                        {u.role === 'admin' ? 'Demote to viewer' : 'Promote to admin'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={6} className="muted">No accounts returned. Configure DATABASE_URL to load users from PostgreSQL.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'catalogue' && (
        <>
          <div className="panel pad" style={{ marginBottom: 16 }}>
            <div className="row-between">
              <div className="chips-scroll">
                <button className={`chip${sport === 'all' ? ' on' : ''}`} onClick={() => setSport('all')}>All</button>
                {SPORTS.map((s) => <button key={s.id} className={`chip${sport === s.id ? ' on' : ''}`} onClick={() => setSport(s.id)}>{s.icon} {s.label}</button>)}
              </div>
              <div className="searchbox" style={{ minWidth: 240 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter fixtures" aria-label="Filter fixtures" />
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Match</th><th>Competition</th><th>Status</th><th className="num">Score</th><th>Channel</th><th className="num">Stream</th></tr></thead>
              <tbody>
                {filtered.slice(0, 40).map((m) => (
                  <tr key={m.id}>
                    <td>{m.home.name} <span className="muted">vs</span> {m.away.name}</td>
                    <td className="muted">{m.leagueName}</td>
                    <td><span className={`pill ${m.status === 'live' ? 'pill-live' : ''}`}>{m.status}</span></td>
                    <td className="num mono">{m.status === 'upcoming' ? '—' : `${m.homeScore}-${m.awayScore}`}</td>
                    <td className="muted">{m.channel}</td>
                    <td className="num">{m.streamPath ? <span className="pill pill-cyan">authorised</span> : <span className="pill">none</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted tiny" style={{ marginTop: 10 }}>Showing {Math.min(40, filtered.length)} of {filtered.length} filtered fixtures ({catalog.matches.length} total).</p>
        </>
      )}

      {tab === 'streams' && (
        <>
          <div className="notice warn" style={{ marginBottom: 18, display: 'block' }}>
            <b>Stream governance</b>
            <div className="small" style={{ marginTop: 6 }}>
              Only hosts listed in <code>STREAM_ALLOWLIST</code> may be played. The player refuses any other origin, and
              the API re-checks the allow-list before issuing a source. Never add scraped or unlicensed providers.
            </div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
            <div className="panel pad">
              <b>Allow-listed hosts</b>
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table><thead><tr><th>Host</th><th>Licence</th></tr></thead>
                  <tbody>
                    <tr><td className="mono">test-streams.mux.dev</td><td className="muted">Mux public HLS test / Blender CC-BY</td></tr>
                    <tr><td className="mono">commondatastorage.googleapis.com</td><td className="muted">Big Buck Bunny MP4 (CC-BY 3.0)</td></tr>
                  </tbody></table>
              </div>
            </div>
            <div className="panel pad">
              <b>Categories in catalogue</b>
              <div className="stack" style={{ gap: 8, marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
                {CATEGORY_DEFS.map((c) => (
                  <div key={c.id} className="row-between small">
                    <span>{c.icon} {c.label}</span>
                    <span className="mono muted">{catalog.categories.find((x) => x.id === c.id)?.count ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {tab === 'broadcast' && <AdminBroadcast />}
    </div>
  );
}
