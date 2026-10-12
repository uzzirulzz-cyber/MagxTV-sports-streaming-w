/* Admin → Broadcast → M3U fallback importer.
   The URL is handed to the server, which runs the fetch/parse as a queued worker
   job and writes the result to the playlists bucket. Progress is polled here. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  m3uChannels, m3uImport, m3uJob, m3uRefresh, m3uRemove, m3uStatus,
  type ImportedChannel, type M3uGroups, type M3uStats, type M3uStatus, type QueueJob
} from '../lib/broadcast';

const nf = new Intl.NumberFormat('en-US');
const mb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

export default function AdminM3u() {
  const [status, setStatus] = useState<M3uStatus | null>(null);
  const [url, setUrl] = useState('');
  const [job, setJob] = useState<QueueJob | null>(null);
  const [channels, setChannels] = useState<ImportedChannel[]>([]);
  const [groups, setGroups] = useState<M3uGroups[]>([]);
  const [stats, setStats] = useState<M3uStats | null>(null);
  const [total, setTotal] = useState(0);
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [freeOnly, setFreeOnly] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const poll = useRef<number | null>(null);

  const loadStatus = useCallback(async () => {
    try { setStatus(await m3uStatus()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not read the importer status.'); }
  }, []);

  const loadChannels = useCallback(async (opts: { group?: string; q?: string; free?: boolean } = {}) => {
    try {
      const r = await m3uChannels(opts);
      setChannels(r.channels); setGroups(r.groups); setStats(r.stats); setTotal(r.total);
    } catch { /* nothing imported yet */ }
  }, []);

  useEffect(() => { void loadStatus(); void loadChannels(); }, [loadStatus, loadChannels]);
  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current); }, []);

  const track = useCallback((id: string) => {
    if (poll.current) window.clearInterval(poll.current);
    poll.current = window.setInterval(async () => {
      try {
        const r = await m3uJob(id);
        setJob(r.job);
        if (r.job.state === 'done' || r.job.state === 'error') {
          if (poll.current) window.clearInterval(poll.current);
          poll.current = null;
          if (r.job.state === 'done') { setOk(r.job.message); void loadStatus(); void loadChannels(); }
          else setError(r.job.error ?? 'The import failed.');
        }
      } catch { if (poll.current) window.clearInterval(poll.current); poll.current = null; }
    }, 700);
  }, [loadStatus, loadChannels]);

  const onImport = async () => {
    if (!url.trim()) { setError('Paste the playlist URL first.'); return; }
    setBusy('import'); setError(''); setOk('');
    try {
      const r = await m3uImport(url.trim());
      setJob(r.job); track(r.job.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start the import.'); }
    finally { setBusy(''); }
  };

  const onRefresh = async () => {
    setBusy('refresh'); setError(''); setOk('');
    try { const r = await m3uRefresh(); setJob(r.job); track(r.job.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start the refresh.'); }
    finally { setBusy(''); }
  };

  const onRemove = async () => {
    setBusy('remove'); setError(''); setOk('');
    try {
      await m3uRemove();
      setStatus(null); setChannels([]); setGroups([]); setStats(null); setTotal(0); setJob(null);
      setOk('The imported playlist has been removed from the bucket.');
      void loadStatus();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove the playlist.'); }
    finally { setBusy(''); }
  };

  const applyFilter = (patch: { group?: string; q?: string; free?: boolean }) => {
    const next = { group: patch.group ?? group, q: patch.q ?? q, free: patch.free ?? freeOnly };
    if (patch.group !== undefined) setGroup(patch.group);
    if (patch.q !== undefined) setQ(patch.q);
    if (patch.free !== undefined) setFreeOnly(patch.free);
    void loadChannels(next);
  };

  const freeShare = useMemo(() => (stats && stats.total ? Math.round((stats.free / stats.total) * 100) : 0), [stats]);
  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? channels.filter((c) => c.name.toLowerCase().includes(n)) : channels;
  }, [channels, q]);

  const tile = (label: string, value: string, hint?: string) => (
    <div className="panel pad" style={{ flex: '1 1 118px', minWidth: 118 }}>
      <div className="small muted">{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{value}</div>
      {hint && <div className="small muted">{hint}</div>}
    </div>
  );

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ marginBottom: 4 }}>M3U playlist importer <span className="badge-sub">FALLBACK</span></h3>
      <p className="small muted" style={{ marginBottom: 12 }}>
        Used when the Xtream API is not configured or cannot be reached. Fetch and parse run as a queued worker job;
        the parsed playlist is written to the <b>playlists</b> bucket and only then does the router start serving it.
        Import only playlists you are authorised to use.
      </p>

      {error && <div className="alert">{error}</div>}
      {ok && <div className="alert" style={{ borderColor: 'rgba(39,209,127,.5)' }}>{ok}</div>}

      <div className="panel pad">
        <div className="lp-field" style={{ flex: 1 }}>
          <label htmlFor="m3u-url">Playlist URL (.m3u / .m3u8 / get.php)</label>
          <input
            id="m3u-url" className="lp-search" style={{ width: '100%' }} value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://provider.example/get.php?username=…&password=…&type=m3u_plus&output=hls"
          />
        </div>
        <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-lime" onClick={onImport} disabled={busy !== ''}>
            {busy === 'import' ? 'Starting…' : 'Import playlist'}
          </button>
          <button className="btn btn-ghost" onClick={onRefresh} disabled={busy !== '' || !status?.playlistUrl}>
            {busy === 'refresh' ? 'Refreshing…' : 'Refresh saved playlist'}
          </button>
          <button className="btn btn-ghost" onClick={onRemove} disabled={busy !== '' || !(status?.configured)}>Remove import</button>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>
          The full URL — including any credentials inside it — stays server-side and is stored masked. Import limit{' '}
          {status ? mb(status.limits.maxBytes) : '25.0 MB'} / {status ? nf.format(status.limits.maxChannels) : '20,000'} channels.
        </p>
      </div>

      {job && (
        <div className="panel pad" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <b>{job.label}</b>
            <span className={`badge-sub${job.state === 'done' ? ' badge-free' : ''}`}>{job.state.toUpperCase()} · {job.progress}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.08)', borderRadius: 99, margin: '10px 0 8px' }}>
            <div style={{ width: `${job.progress}%`, height: '100%', borderRadius: 99, background: 'var(--grad)' }} />
          </div>
          <div className="small muted">{job.error ?? job.message}</div>
          {job.result?.bucket && (
            <div className="small muted" style={{ marginTop: 6 }}>
              Written to bucket <b>{job.result.bucket.driver}</b> → <code>{job.result.bucket.key}</code> ({mb(job.result.bucket.size)})
            </div>
          )}
        </div>
      )}

      {status && (
        <>
          <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {tile('Router picked', status.router.picked.toUpperCase(), status.router.demo ? 'demo fallback' : status.router.label.slice(0, 40))}
            {tile('Bucket objects', nf.format(status.bucket.count), `${status.bucket.driver} · ${status.bucket.name}`)}
            {tile('Queue', nf.format(status.queue.depth), 'waiting')}
          </div>

          <div className="panel pad" style={{ marginTop: 10 }}>
            <b className="small">Provider chain</b>
            <div className="small muted" style={{ marginTop: 6 }}>
              {status.router.attempts.map((a) => (
                <div key={a.source}>
                  {a.ok ? '✔' : '·'} <b>{a.source}</b> — {a.detail}{a.count !== undefined ? ` (${nf.format(a.count)} channels)` : ''}
                </div>
              ))}
            </div>
            {status.stored && (
              <div className="small muted" style={{ marginTop: 8 }}>
                Last import <b>{new Date(status.stored.importedAt).toLocaleString()}</b> · {status.stored.groups} groups
                {status.stored.source.host ? ` · ${status.stored.source.host}` : ''}
                {status.stored.source.urlTvg ? ` · EPG: ${status.stored.source.urlTvg}` : ''}
              </div>
            )}
            {status.bucket.objects.length > 0 && (
              <div className="small muted" style={{ marginTop: 6 }}>
                {status.bucket.objects.map((o) => <div key={o.key}><code>{o.key}</code> · {mb(o.size)}</div>)}
              </div>
            )}
            {status.stored?.warnings?.length ? (
              <div className="small muted" style={{ marginTop: 6 }}>{status.stored.warnings.slice(0, 4).map((w) => <div key={w}>· {w}</div>)}</div>
            ) : null}
          </div>
        </>
      )}

      {stats && (
        <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {tile('Channels', nf.format(stats.total))}
          {tile('Free to watch', nf.format(stats.free), `${freeShare}% of the list`)}
          {tile('Subscription', nf.format(stats.subscription))}
          {tile('HLS', nf.format(stats.hls))}
          {tile('MPEG-TS', nf.format(stats.mpegts))}
          {tile('With logo', nf.format(stats.withLogo))}
          {tile('With EPG', nf.format(stats.withEpg))}
          {tile('Skipped lines', nf.format(stats.skipped))}
        </div>
      )}

      {groups.length > 0 && (
        <div className="panel pad" style={{ marginTop: 12 }}>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="psel" value={group} onChange={(e) => applyFilter({ group: e.target.value })}>
              <option value="">All groups ({nf.format(total)} channels)</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>{g.name} — {g.count}{g.free ? ` (${g.free} free)` : ''}</option>
              ))}
            </select>
            <input className="lp-search" placeholder="Search channels…" value={q}
                   onChange={(e) => { setQ(e.target.value); applyFilter({ q: e.target.value }); }} />
            <label className="small" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={freeOnly} onChange={(e) => applyFilter({ free: e.target.checked })} />
              Free content only
            </label>
          </div>

          <div className="ch-grid" style={{ marginTop: 12 }}>
            {visible.slice(0, 120).map((c) => (
              <div key={c.id} className="ch-card">
                <span className="ch-logo">
                  {c.logo ? <img src={c.logo} alt="" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}
                </span>
                <span className="ch-name">{c.name}</span>
                <span className={c.access === 'free' ? 'badge-free' : 'badge-sub'}>{c.access === 'free' ? 'FREE' : 'SUB'}</span>
              </div>
            ))}
          </div>
          {visible.length > 120 && <p className="small muted">Showing the first 120 of {nf.format(visible.length)} — narrow the search or pick a group.</p>}
          {visible.length === 0 && <p className="small muted">No channels matched that filter.</p>}
        </div>
      )}

      {!status?.configured && !stats && (
        <p className="small muted" style={{ marginTop: 12 }}>
          Nothing imported yet. Paste an authorised playlist URL above, or keep using the Xtream API panel.
        </p>
      )}
    </div>
  );
}
