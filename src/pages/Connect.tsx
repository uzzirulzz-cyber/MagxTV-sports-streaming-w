/* Live TV — connect YOUR OWN provider at runtime and play its channels through
   the server relay. No provider credentials ship with this app. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionHead as Head } from '../components/common';
import LiveTVPlayer from '../components/LiveTVPlayer';
import {
  connectProvider, disconnectProvider, fetchCategories, fetchChannels,
  useProviderSession, writeSession, type LiveCategory, type LiveChannel
} from '../lib/liveProvider';

export default function Connect() {
  const session = useProviderSession();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [total, setTotal] = useState(0);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [listBusy, setListBusy] = useState(false);
  const [listErr, setListErr] = useState('');
  const [current, setCurrent] = useState<LiveChannel | null>(null);

  const load = useCallback(async (categoryId: string) => {
    if (!session) return;
    setListBusy(true); setListErr('');
    try {
      const [c, s] = await Promise.all([
        fetchCategories(session).catch(() => ({ categories: [] as LiveCategory[] })),
        fetchChannels(session, categoryId)
      ]);
      setCategories(c.categories);
      setChannels(s.streams);
      setTotal(s.total);
      setCurrent((cur) => cur ?? s.streams[0] ?? null);
    } catch (e) {
      setListErr(e instanceof Error ? e.message : 'Could not load channels.');
    } finally { setListBusy(false); }
  }, [session]);

  useEffect(() => { if (session) void load(''); }, [session, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? channels.filter((c) => c.name.toLowerCase().includes(needle)) : channels;
  }, [channels, q]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await connectProvider(host.trim(), username.trim(), password); setPassword(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Connection failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="wrap wrap-wide section">
      <Head
        eyebrow="LIVE TV"
        title="Connect your live provider"
        sub="Enter the host and credentials of the streaming provider you are licensed to use. They are sent once to your own API server, kept in memory for a 6-hour session, and never committed to the codebase or bundled into the app."
      />

      <div className="notice">
        <b>You must supply a provider you are authorised to use.</b> This platform ships no channels, no credentials and no
        scraped sources of its own — the demo catalogue is invented data. Connecting an unlicensed service is against the
        terms of this app and of the provider. Credentials are stored in this browser's local storage so the session survives
        a refresh; use a device you trust, and disconnect when finished.
      </div>

      {!session && (
        <form className="card lp-form" onSubmit={submit} style={{ maxWidth: 620 }}>
          <label>Provider host
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="http://your-provider.example:8080" autoComplete="off" required />
            <small className="muted">Include the port if the panel uses one. http:// works because the relay runs on your server.</small>
          </label>
          <label>Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" required />
          </label>
          <label>Password
            <div className="row" style={{ gap: 8 }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" required />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          {error && <div className="alert bad">{error}</div>}
          <button className="btn btn-lime btn-lg" disabled={busy}>{busy ? 'Testing the provider…' : 'Connect & test'}</button>
        </form>
      )}

      {session && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="pill pill-live"><i className="live-dot" /> CONNECTED</span>
                <h3 style={{ margin: '10px 0 4px' }}>{session.username}@{session.host.replace(/^https?:\/\//, '')}</h3>
                <p className="small muted" style={{ margin: 0 }}>
                  Subscription <b>{session.account.status}</b>
                  {session.account.expiresAt && <> · expires {String(session.account.expiresAt).slice(0, 10)} ({session.account.daysLeft} days left)</>}
                  {session.account.maxConnections != null && <> · max {session.account.maxConnections} simultaneous connections</>}
                </p>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => void load(cat)} disabled={listBusy}>{listBusy ? 'Refreshing…' : 'Refresh channels'}</button>
                <button className="btn btn-ghost" onClick={async () => { await disconnectProvider(session); writeSession(null); setChannels([]); setCategories([]); setCurrent(null); }}>Disconnect</button>
              </div>
            </div>
          </div>

          {current && <LiveTVPlayer session={session} channel={current} />}

          <div className="row" style={{ gap: 10, margin: '18px 0 10px', flexWrap: 'wrap' }}>
            <input className="lp-search" placeholder="Search channels…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="psel" value={cat} onChange={(e) => { setCat(e.target.value); void load(e.target.value); }}>
              <option value="">All categories ({total} channels)</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {listErr && <div className="alert bad">{listErr}</div>}
          {listBusy && <div className="skeleton" style={{ height: 120 }} />}
          {!listBusy && filtered.length === 0 && <div className="alert">{listErr ? '' : 'No channels matched.'}</div>}

          <div className="ch-grid">
            {filtered.slice(0, 240).map((c) => (
              <button key={c.id} className={`ch-card${current?.id === c.id ? ' on' : ''}`} onClick={() => setCurrent(c)}>
                <span className="ch-logo">
                  {c.icon ? <img src={c.icon} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
                </span>
                <span className="ch-name">{c.name}</span>
              </button>
            ))}
          </div>
          {filtered.length > 240 && <p className="small muted">Showing the first 240 of {filtered.length} matches — narrow the search or pick a category.</p>}
        </>
      )}
    </div>
  );
}
