/* Admin → Broadcast: obtain, fetch and load an Xtream (player_api.php) provider.
   Host/username/password are POSTed to our own API, verified against the panel,
   then stored server-side. The password is never returned in cleartext. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminChannels, connectProvider, disconnectProvider, getProvider, probeChannel, testProvider,
  type BroadcastCategory, type BroadcastChannel, type ProbeResult, type ProviderAccount, type ProviderPublic
} from '../lib/broadcast';

export default function AdminBroadcast() {
  const [provider, setProvider] = useState<ProviderPublic | null>(null);
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [account, setAccount] = useState<ProviderAccount | null>(null);

  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [categories, setCategories] = useState<BroadcastCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loadLimit, setLoadLimit] = useState(0);
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadProvider = useCallback(async () => {
    try {
      const p = await getProvider();
      setProvider(p);
      if (p.configured) { setHost(p.host ?? ''); setUsername(p.username ?? ''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not read the provider configuration.'); }
  }, []);
  useEffect(() => { void loadProvider(); }, [loadProvider]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(''); setOk('');
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'That action failed.'); }
    finally { setBusy(''); }
  };

  const onTest = () => run('test', async () => {
    const r = await testProvider(host.trim(), username.trim(), password);
    setAccount(r.account);
    setOk(`Credentials accepted by ${r.host}.`);
  });

  const onConnect = () => run('connect', async () => {
    const r = await connectProvider(host.trim(), username.trim(), password);
    setProvider(r.provider); setAccount(r.account); setPassword('');
    setOk('Broadcast provider saved. Viewers can now load these channels under Channels.');
  });

  const onDisconnect = () => run('disconnect', async () => {
    const r = await disconnectProvider();
    setProvider(r.provider); setAccount(null); setChannels([]); setCategories([]); setProbe(null); setLoaded(false);
    setPassword(''); setOk('Broadcast provider removed.');
  });

  const onLoad = (categoryId = cat) => run('load', async () => {
    const r = await adminChannels(categoryId);
    setChannels(r.channels); setCategories(r.categories); setTotal(r.total); setLoadLimit(r.loadLimit); setLoaded(true);
    setOk(`Fetched ${r.shown} of ${r.total} channels${r.total > r.loadLimit ? ` (first ${r.loadLimit} loaded)` : ''}.`);
  });

  const onProbe = (id: string) => run('probe:' + id, async () => {
    setProbe(await probeChannel(id));
  });

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? channels.filter((c) => c.name.toLowerCase().includes(n)) : channels;
  }, [channels, q]);

  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="panel pad">
        <b>Broadcast provider — Xtream API (player_api.php)</b>
        <p className="small muted" style={{ marginTop: 6 }}>
          Enter the host, username and password of the provider you are licensed to broadcast. The credentials are
          verified against the panel, then stored <b>server-side only</b> and never sent back to a browser.
        </p>

        <div className="row-between" style={{ gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
          <span>
            {provider?.configured
              ? <><span className="pill pill-live"><i className="live-dot" /> BROADCASTING</span>
                <b style={{ marginLeft: 8 }}>{provider.username}@{String(provider.host).replace(/^https?:\/\//, '')}</b>
                <span className="muted small"> · password {provider.password} ({provider.passwordLength} chars) · saved {String(provider.updatedAt).slice(0, 16).replace('T', ' ')}</span></>
              : <span className="pill pill-warn">NO PROVIDER CONFIGURED</span>}
          </span>
          {provider?.configured && (
            <button className="btn btn-ghost btn-sm" onClick={onDisconnect} disabled={busy !== ''}>
              {busy === 'disconnect' ? 'Removing…' : 'Disconnect provider'}
            </button>
          )}
        </div>

        <div className="stack" style={{ gap: 12, marginTop: 16, maxWidth: 660 }}>
          <label className="lp-field">
            <span>Host</span>
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="http://provider.example:8080" autoComplete="off" spellCheck={false} />
          </label>
          <label className="lp-field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
          <label className="lp-field">
            <span>Password</span>
            <div className="row" style={{ gap: 8 }}>
              <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder={provider?.configured ? 'leave blank to keep the saved password' : ''} autoComplete="off" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPw((s) => !s)}>{showPw ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={onTest} disabled={busy !== '' || !host.trim() || !username.trim()}>
              {busy === 'test' ? 'Testing…' : 'Test connection'}
            </button>
            <button className="btn btn-lime" onClick={onConnect} disabled={busy !== '' || !host.trim() || !username.trim()}>
              {busy === 'connect' ? 'Verifying…' : 'Obtain & save broadcast'}
            </button>
            <button className="btn btn-ghost" onClick={() => onLoad()} disabled={busy !== '' || !provider?.configured}>
              {busy === 'load' ? 'Fetching…' : 'Fetch & load channels'}
            </button>
          </div>
        </div>

        {error && <div className="alert bad" style={{ marginTop: 14 }}>{error}</div>}
        {ok && <div className="alert" style={{ marginTop: 14 }}>{ok}</div>}

        {account && (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', marginTop: 16 }}>
            <div className="kpi"><b>{account.status}</b><small>Subscription status</small></div>
            <div className="kpi"><b>{account.daysLeft}</b><small>Days remaining</small></div>
            <div className="kpi"><b>{String(account.expiresAt ?? '—').slice(0, 10)}</b><small>Expires</small></div>
            <div className="kpi"><b>{account.activeConnections ?? '—'}/{account.maxConnections ?? '—'}</b><small>Active / max connections</small></div>
          </div>
        )}

        <div className="notice" style={{ marginTop: 16, marginBottom: 0 }}>
          <b>Stored in plain text.</b> The password is saved so the panel can reconnect without an operator retyping it, which means
          any database or server snapshot contains it. Before real use, encrypt it at rest (or move it to a secrets manager) and restrict
          database access. This demo build runs without PostgreSQL, so the value lives in the API process's memory until restart.
        </div>
      </div>

      {provider?.configured && (
        <div className="panel pad">
          <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
            <b>Loaded channels</b>
            {loaded && <span className="small muted">{total} reported by the panel · {channels.length} loaded</span>}
          </div>
          <div className="row" style={{ gap: 10, margin: '12px 0', flexWrap: 'wrap' }}>
            <input className="lp-search" placeholder="Search loaded channels…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="psel" value={cat} onChange={(e) => { setCat(e.target.value); onLoad(e.target.value); }} disabled={busy !== ''}>
              <option value="">All categories{categories.length ? ` (${categories.reduce((n, c) => n + (c.count ?? 0), 0)})` : ''}</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.count != null ? ` — ${c.count}` : ''}</option>)}
            </select>
          </div>

          {!loaded && <p className="small muted">Press <b>Fetch &amp; load channels</b> to pull the channel list and categories from the panel.</p>}
          {loaded && filtered.length === 0 && <p className="small muted">No channels matched.</p>}

          {loaded && (
            <div className="ch-grid">
              {filtered.slice(0, 300).map((c) => (
                <div key={c.id} className={`ch-card${probe?.channelId === c.id ? ' on' : ''}`}>
                  <span className="ch-logo">
                    {c.icon ? <img src={c.icon} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
                  </span>
                  <span className="ch-name">{c.name}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => onProbe(c.id)} disabled={busy !== ''}>
                    {busy === 'probe:' + c.id ? '…' : 'Probe'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {loaded && filtered.length > 300 && (
            <p className="small muted">Showing the first 300 of {filtered.length} — narrow the search or pick a category.</p>
          )}

          {probe && (
            <div className="alert" style={{ marginTop: 14 }}>
              <b>{probe.channelId}</b> · HTTP {probe.status} · format <b>{probe.format}</b>
              {probe.format === 'hls' ? ` · ${probe.variants} variant(s), ${probe.segments} segment refs` : ''}
              <div className="small muted" style={{ marginTop: 4 }}>{probe.hint}</div>
            </div>
          )}

          <p className="small muted" style={{ marginTop: 12 }}>
            Probe opens the channel's playlist through the relay and reports what the panel actually serves, so you can confirm a
            channel works before viewers see it. Category naming above comes straight from the panel's group names.
          </p>
        </div>
      )}
    </div>
  );
}
