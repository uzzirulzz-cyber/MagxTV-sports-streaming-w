/* Real live-TV integration (Xtream Codes compatible panel_api / player_api).
   The operator connects at runtime; this router is the only thing that ever
   touches the panel, which also solves CORS and http-on-https mixed content. */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import {
  assertRelayable, dropToken, issueToken, liveStreamUrl, normaliseHost, playerApi, readToken, activeTokens,
  rewritePlaylist, resolveUpstream, pinnedHosts, isBroadcastToken
} from '../live';
import type { Creds } from '../live';

const router = Router();

const credsFrom = (req: Request, res: Response): Creds | null => {
  const creds = readToken(req.headers['x-live-token'] ?? req.query.t);
  if (!creds) { res.status(401).json({ error: 'Not connected to a live provider, or the session expired. Reconnect (sessions last 6 hours).' }); return null; }
  return creds;
};

const mapAccount = (info: any) => {
  const u = info?.user_info ?? {};
  const s = info?.server_info ?? {};
  return {
    status: u.status ?? 'Unknown',
    username: u.username ?? '',
    isTrial: String(u.is_trial ?? '0') === '1',
    expiresAt: u.exp_date ? new Date(Number(u.exp_date) * 1000).toISOString() : null,
    daysLeft: Number(u.auth ?? 0),
    maxConnections: u.max_connections ?? null,
    activeConnections: u.active_cons ?? null,
    createdAt: u.created_at ? new Date(Number(u.created_at) * 1000).toISOString() : null,
    serverProtocol: s.server_protocol ?? null,
    timezone: s.timezone ?? null,
    url: s.url ?? null
  };
};

/* ------------------------- connect / test ------------------------- */
router.post('/connect', async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as Record<string, string>;
    const host = normaliseHost(body.host);
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    if (!username || !password) { res.status(400).json({ error: 'Host, username and password are all required.' }); return; }
    const info = await playerApi({ host, username, password });
    const account = mapAccount(info);
    if (!info?.user_info) {
      res.status(502).json({ error: 'The panel answered, but not with account information. Check that the host is a player_api.php endpoint.' });
      return;
    }
    if (String(account.status).toLowerCase() !== 'active') {
      res.status(403).json({ error: `The provider reports this subscription as "${account.status}".`, account });
      return;
    }
    const token = issueToken({ host, username, password });
    res.json({ ok: true, token, host, account });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Could not reach the provider.' });
  }
});

router.post('/disconnect', (req: Request, res: Response) => {
  dropToken(req.headers['x-live-token'] ?? req.query.t);
  res.json({ ok: true });
});

router.get('/session', (_req: Request, res: Response) => {
  res.json({ note: 'Sessions live in server memory only, expire after 6 hours, and hold no credentials in the browser beyond this page.', activeSessions: activeTokens() });
});

/* ------------------------- catalogue ------------------------- */
router.get('/categories', async (req: Request, res: Response) => {
  const creds = credsFrom(req, res); if (!creds) return;
  try {
    const raw = await playerApi(creds, { action: 'get_live_categories' });
    const categories = (Array.isArray(raw) ? raw : [])
      .map((c: any) => ({ id: String(c.category_id), name: String(c.category_name ?? 'Live') }))
      .filter((c: any) => c.id);
    res.json({ categories });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Could not load categories.' });
  }
});

router.get('/streams', async (req: Request, res: Response) => {
  const creds = credsFrom(req, res); if (!creds) return;
  try {
    const categoryId = String(req.query.category_id ?? '').trim();
    const params: Record<string, string> = { action: 'get_live_streams' };
    if (categoryId) params.category_id = categoryId;
    const raw = await playerApi(creds, params, 25_000);
    const all = Array.isArray(raw) ? raw : [];
    const streams = all.slice(0, 500).map((s: any) => ({
      id: String(s.stream_id ?? ''),
      name: String(s.name ?? 'Live channel'),
      icon: String(s.stream_icon ?? ''),
      categoryId: String(s.category_id ?? ''),
      epgChannelId: s.epg_channel_id ? String(s.epg_channel_id) : null
    })).filter((s: any) => s.id);
    res.json({ streams, total: all.length, shown: streams.length });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Could not load live channels.' });
  }
});

/* ------------------------- playback relay ------------------------- */
async function relayHls(creds: Creds | null, refOrId: string, token: string, res: Response): Promise<void> {
  const target = await resolveUpstream(refOrId, creds);
  if (!target) { res.status(404).json({ error: 'That channel is not available — it is not in the configured provider or the imported playlist.', fallback: 'ts' }); return; }
  let up: globalThis.Response;
  try { up = await fetch(target, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'PlayBeatDigital/1.0 (+platform)' } }); }
  catch { res.status(502).json({ error: 'The provider did not answer in time.', fallback: 'ts' }); return; }
  if (!up.ok) { res.status(502).json({ error: `The provider returned HTTP ${up.status} for this channel.`, fallback: 'ts' }); return; }
  const text = await up.text();
  if (!/#EXTM3U/.test(text)) { res.status(409).json({ error: 'This channel is not served as HLS — switching to raw MPEG-TS.', fallback: 'ts' }); return; }
  res.set('Content-Type', 'application/vnd.apple.mpegurl');
  res.set('Cache-Control', 'no-store');
  res.send(rewritePlaylist(text, up.url || target.toString(), token));
}

router.get('/hls/:ref', async (req: Request, res: Response) => {
  const creds = credsFrom(req, res);
  if (!creds && !isBroadcastToken(req.headers['x-live-token'] ?? req.query.t)) { res.status(401).json({ error: 'Not connected to a live provider, or the session expired.' }); return; }
  const token = String(req.headers['x-live-token'] ?? req.query.t ?? '');
  const ref = String(req.params.ref).replace(/\.m3u8$/i, '');
  await relayHls(creds, ref, token, res);
});

/* Raw MPEG-TS relay for channels without an HLS playlist (mpegts.js consumes this). */
router.get('/ts/:ref', async (req: Request, res: Response) => {
  const creds = credsFrom(req, res);
  if (!creds && !isBroadcastToken(req.headers['x-live-token'] ?? req.query.t)) { res.status(401).json({ error: 'Not connected to a live provider, or the session expired.' }); return; }
  const ref = String(req.params.ref).replace(/\.ts$/i, '');
  const target = await resolveUpstream(ref, creds);
  if (!target) { res.status(404).json({ error: 'That channel is not available.' }); return; }
  try {
    const up = await fetch(target, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'PlayBeatDigital/1.0 (+platform)' } });
    if (!up.ok || !up.body) { res.status(502).json({ error: `The provider returned HTTP ${up.status} for this channel.` }); return; }
    const ct = up.headers.get('content-type');
    res.set('Content-Type', ct && ct !== 'application/octet-stream' ? ct : 'video/mp2t');
    res.set('Cache-Control', 'no-store');
    Readable.fromWeb(up.body as never).pipe(res);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'The provider stream failed.' });
  }
});

/* Segments / keys / sidecars referenced by a rewitten playlist. */
router.get('/seg', async (req: Request, res: Response) => {
  const token = String(req.headers['x-live-token'] ?? req.query.t ?? '');
  const creds = credsFrom(req, res);
  if (!creds && !isBroadcastToken(token)) { res.status(401).json({ error: 'Not connected to a live provider, or the session expired.' }); return; }
  let target: URL;
  try { target = assertRelayable(Buffer.from(String(req.query.u ?? ''), 'base64url').toString('utf8')); }
  catch (e) { res.status(403).json({ error: e instanceof Error ? e.message : 'Refused.' }); return; }
  /* Hard stop: a relay must never be pointed at a host outside this provider. */
  const allowed = await pinnedHosts();
  if (!allowed.has(target.host)) { res.status(403).json({ error: 'Refused: that media belongs to a different host than the configured provider.' }); return; }
  try {
    const range = req.headers.range;
    const up = await fetch(target, {
      signal: AbortSignal.timeout(20_000),
      headers: range ? { Range: String(range), 'User-Agent': 'PlayBeatDigital/1.0 (+platform)' } : { 'User-Agent': 'PlayBeatDigital/1.0 (+platform)' }
    });
    if (!up.ok || !up.body) { res.status(502).json({ error: `Upstream segment failed (HTTP ${up.status}).` }); return; }
    const ct = up.headers.get('content-type');
    res.set('Content-Type', ct && ct !== 'application/octet-stream' ? ct : (target.pathname.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t'));
    const cr = up.headers.get('content-range'); if (cr) res.set('Content-Range', cr);
    const cl = up.headers.get('content-length'); if (cl) res.set('Content-Length', cl);
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'no-store');
    res.status(up.status);
    Readable.fromWeb(up.body as never).pipe(res);
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Segment relay failed.' });
  }
});

export default router;
