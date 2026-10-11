/* Channels — what the operator is broadcasting. Viewer-facing.
   Needs a signed-in account; the playback grant is short-lived and carries no credentials. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Empty, SectionHead } from '../components/common';
import LiveTVPlayer from '../components/LiveTVPlayer';
import { useApp } from '../context/AppContext';
import {
  broadcastCatalog, requestPlaybackToken, type BroadcastCategory, type BroadcastChannel
} from '../lib/broadcast';

export default function Channels() {
  const { user } = useApp();
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [categories, setCategories] = useState<BroadcastCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [provider, setProvider] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState<BroadcastChannel | null>(null);
  const [grant, setGrant] = useState<{ token: string } | null>(null);
  const [grantErr, setGrantErr] = useState('');

  const load = useCallback(async (categoryId = '') => {
    setBusy(true); setError('');
    try {
      const r = await broadcastCatalog(categoryId);
      setChannels(r.channels); setCategories(r.categories); setTotal(r.total); setProvider(r.provider ?? '');
      setCurrent((c) => c ?? r.channels[0] ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the broadcast.'); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);

  /* A fresh grant is requested whenever the viewer picks a channel; grants last 30 minutes. */
  useEffect(() => {
    if (!user || !current) return;
    let dead = false;
    requestPlaybackToken()
      .then((r) => { if (!dead) { setGrant({ token: r.token }); setGrantErr(''); } })
      .catch((e) => { if (!dead) setGrantErr(e instanceof Error ? e.message : 'Could not obtain a playback grant.'); });
    return () => { dead = true; };
  }, [user, current]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? channels.filter((c) => c.name.toLowerCase().includes(n)) : channels;
  }, [channels, q]);

  if (!user) {
    return (
      <div className="wrap sec">
        <Empty
          title="Sign in to watch the live broadcast"
          body="Channels are only served to signed-in viewers, so streams stay rate-limited and licensed content stays accountable."
          action={<Link className="btn btn-lime" to="/login">Sign in</Link>}
        />
      </div>
    );
  }

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead
        eyebrow="Channels"
        title={provider ? `Broadcasting from ${provider.replace(/^https?:\/\//, '')}` : 'Live channels'}
        sub="The operator's live roster. Playback is relayed by this platform, so the provider's credentials never reach your browser."
      />

      {error && (
        <div className="notice">
          <b>{error}</b>
          <div className="small muted" style={{ marginTop: 6 }}>
            If you are the operator, open <Link to="/admin">Admin → Broadcast</Link> and connect your provider first.
          </div>
        </div>
      )}

      {busy && !error && <div className="panel pad"><div className="skeleton" style={{ height: 180 }} /></div>}

      {!busy && !error && (
        <>
          {current && grant && <LiveTVPlayer session={grant} channel={current} />}
          {current && !grant && (
            <div className="panel pad small muted">{grantErr || 'Requesting a playback grant…'}</div>
          )}

          <div className="row" style={{ gap: 10, margin: '18px 0 12px', flexWrap: 'wrap' }}>
            <input className="lp-search" placeholder="Search channels…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="psel" value={cat} onChange={(e) => { setCat(e.target.value); void load(e.target.value); }}>
              <option value="">All categories ({total} channels)</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {filtered.length === 0 && <p className="small muted">No channels matched.</p>}

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
          {filtered.length > 240 && <p className="small muted">Showing the first 240 of {filtered.length} — narrow the search or pick a category.</p>}

          <p className="small muted" style={{ marginTop: 16 }}>
            Only the operator can add channels. If a channel will not start it is usually the provider's simultaneous-connection
            limit or a channel that is offline at source — not the app.
          </p>
        </>
      )}
    </div>
  );
}
