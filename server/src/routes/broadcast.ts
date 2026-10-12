/* Administrator control of the broadcast provider, plus the viewer-facing
   catalogue and playback grants that consume it. */
import { Router } from 'express';
import { requireAuth, requireRole, type AuthedRequest } from '../auth';
import { issueBroadcastToken, liveStreamUrl, normaliseHost, playerApi, readToken } from '../live';
import { clearProvider, getConfigSync, maskSecret, saveProvider } from '../providerConfig';
import { resolveCatalog } from '../providerRouter';

/* ------------------------------ admin ------------------------------ */
export const adminProvider = Router();
adminProvider.use(requireAuth, requireRole('admin'));

const publicView = () => {
  const c = getConfigSync();
  return c
    ? { configured: true, host: c.host, username: c.username, password: maskSecret(c.password), passwordLength: c.password.length, updatedAt: c.updatedAt }
    : { configured: false };
};

/* Leaves the password field blank to keep the saved one, so an operator can
   re-test or re-save without retyping the secret. */
function resolvedPassword(host: string, username: string, submitted: unknown): string {
  const typed = String(submitted ?? '');
  if (typed) return typed;
  const existing = getConfigSync();
  if (existing && existing.host === host && existing.username === username) return existing.password;
  return '';
}

async function accountOf(host: string, username: string, password: string) {
  const info = await playerApi({ host, username, password });
  const u = info?.user_info ?? {};
  const s = info?.server_info ?? {};
  if (!info?.user_info) throw new Error('The panel answered, but without account information. Check that the host is an Xtream player_api.php endpoint.');
  return {
    status: String(u.status ?? 'Unknown'),
    username: String(u.username ?? username),
    isTrial: String(u.is_trial ?? '0') === '1',
    expiresAt: u.exp_date ? new Date(Number(u.exp_date) * 1000).toISOString() : null,
    daysLeft: Number(u.auth ?? 0),
    maxConnections: u.max_connections ?? null,
    activeConnections: u.active_cons ?? null,
    serverProtocol: s.server_protocol ?? null,
    timezone: s.timezone ?? null
  };
}

adminProvider.get('/', (_req, res) => { res.json(publicView()); });

/* Test without saving — lets the administrator check credentials first. */
adminProvider.post('/test', async (req, res) => {
  try {
    const b = (req.body ?? {}) as Record<string, string>;
    const host = normaliseHost(b.host);
    const username = String(b.username ?? '').trim();
    const password = resolvedPassword(host, username, b.password);
    if (!username || !password) { res.status(400).json({ error: 'Host, username and password are all required.' }); return; }
    const account = await accountOf(host, username, password);
    res.json({ ok: true, host, account });
  } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Could not reach the provider.' }); }
});

/* Obtain → verify → save. The password is stored server-side and masked on read. */
adminProvider.post('/connect', async (req, res) => {
  try {
    const b = (req.body ?? {}) as Record<string, string>;
    const host = normaliseHost(b.host);
    const username = String(b.username ?? '').trim();
    const password = resolvedPassword(host, username, b.password);
    if (!username || !password) { res.status(400).json({ error: 'Host, username and password are all required.' }); return; }
    const account = await accountOf(host, username, password);
    if (String(account.status).toLowerCase() !== 'active') {
      res.status(403).json({ error: `The provider reports this subscription as "${account.status}".`, account });
      return;
    }
    await saveProvider({ host, username, password });
    res.json({ ok: true, provider: publicView(), account });
  } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Could not reach the provider.' }); }
});

adminProvider.delete('/', async (_req, res) => { await clearProvider(); res.json({ ok: true, provider: publicView() }); });

/* Fetch and load the channel list for the administrator. */
adminProvider.get('/channels', async (req, res) => {
  const c = getConfigSync();
  if (!c) { res.status(409).json({ error: 'No broadcast provider is configured yet — connect one first.' }); return; }
  try {
    const categoryId = String(req.query.category_id ?? '').trim();
    const params: Record<string, string> = { action: 'get_live_streams' };
    if (categoryId) params.category_id = categoryId;
    const [catsRaw, streamsRaw] = await Promise.all([
      playerApi(c, { action: 'get_live_categories' }, 20_000).catch(() => []),
      playerApi(c, params, 30_000)
    ]);
    const categories = (Array.isArray(catsRaw) ? catsRaw : []).map((x: any) => ({ id: String(x.category_id), name: String(x.category_name ?? 'Live') }));
    const all = Array.isArray(streamsRaw) ? streamsRaw : [];
    const channels = all.slice(0, 2000).map((s: any) => ({
      id: String(s.stream_id ?? ''), name: String(s.name ?? 'Live channel'), icon: String(s.stream_icon ?? ''),
      categoryId: String(s.category_id ?? ''), epgChannelId: s.epg_channel_id ? String(s.epg_channel_id) : null
    })).filter((s: any) => s.id);
    const byCategory: Record<string, number> = {};
    channels.forEach((ch: any) => { byCategory[ch.categoryId] = (byCategory[ch.categoryId] ?? 0) + 1; });
    res.json({ categories: categories.map((x: any) => ({ ...x, count: byCategory[x.id] ?? 0 })), channels, total: all.length, shown: channels.length, loadLimit: 2000 });
  } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Could not load channels.' }); }
});

/* A ready-to-open relay URL, so the administrator can verify one channel. */
adminProvider.get('/probe/:id', async (req, res) => {
  const c = getConfigSync();
  if (!c) { res.status(409).json({ error: 'No broadcast provider is configured.' }); return; }
  const id = String(req.params.id);
  const hls = liveStreamUrl(c, id, 'm3u8');
  try {
    const up = await fetch(hls, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'MagxTV/1.0 (+platform)' } });
    const body = up.ok ? await up.text() : '';
    const isHls = /#EXTM3U/.test(body);
    res.json({
      channelId: id, ok: up.ok, status: up.status, format: isHls ? 'hls' : 'mpegts',
      variants: isHls ? (body.match(/^#EXT-X-STREAM-INF/gm) ?? []).length : 0,
      segments: isHls ? (body.match(/\.ts|\.m4s/g) ?? []).length : null,
      hint: isHls ? 'HLS playlist served — hls.js will play this.' : 'Not HLS — the player will fall back to raw MPEG-TS (mpegts.js).'
    });
  } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Probe failed.' }); }
});

/* ------------------------------ viewers ------------------------------ */
export const broadcast = Router();

/* The catalogue the administrator is broadcasting. Signed-in viewers only. */
broadcast.get('/catalog', requireAuth, async (req, res) => {
  try {
    const categoryId = String(req.query.category_id ?? '').trim();
    const freeOnly = String(req.query.free ?? '') === '1';
    const resolved = await resolveCatalog({ categoryId: categoryId || undefined, freeOnly, limit: 1000 });
    if (resolved.source === 'demo') {
      res.status(409).json({ error: 'No live provider is configured. Ask the operator to connect an Xtream API panel or import an M3U playlist.', configured: false });
      return;
    }
    res.json({
      configured: true, source: resolved.source, label: resolved.label, demo: resolved.demo,
      categories: resolved.categories, channels: resolved.channels,
      total: resolved.total, shown: resolved.shown, stats: resolved.stats,
      importedAt: resolved.importedAt, warnings: resolved.warnings, attempts: resolved.attempts
    });
  } catch (e) { res.status(502).json({ error: e instanceof Error ? e.message : 'Could not load the broadcast catalogue.' }); }
});

/* Short-lived grant so the player's segment URLs need no credentials. */
broadcast.post('/token', requireAuth, (req: AuthedRequest, res) => {
  const c = getConfigSync();
  if (!c) { res.status(409).json({ error: 'The operator has not configured a live broadcast yet.' }); return; }
  const token = issueBroadcastToken(req.user!.id);
  res.json({ token, expiresIn: 1800 });
});

/* Used by the roster of live channels to show the viewer what is available. */
broadcast.get('/status', requireAuth, (_req, res) => {
  const c = getConfigSync();
  res.json({ configured: Boolean(c), provider: c ? c.host : null, readToken: typeof readToken === 'function' });
});
