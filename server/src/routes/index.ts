import { Router } from 'express';
import { config, isAllowedStreamHost } from '../config';
import { requireAuth, requireRole, signToken, type AuthedRequest } from '../auth';
import { loadCatalog } from '../providers';
import { PROVIDER_STATUS } from '../providers/state';
import * as repo from '../repo';
import liveRouter from './live';
import { adminProvider, broadcast } from './broadcast';
import { dbHealth } from '../db';
import type { Plan, Role } from '../types';
import { DEMO_STREAMS } from '../../../src/data/streams';

const router = Router();

/* Real live-provider integration (runtime credentials, never persisted). */
router.use('/live', liveRouter);

/* Administrator control of the broadcast provider, and the viewer catalogue. */
router.use('/admin/provider', adminProvider);
router.use('/broadcast', broadcast);
const wrap = (fn: (req: AuthedRequest, res: import('express').Response) => Promise<unknown>) =>
  (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) =>
    fn(req as AuthedRequest, res).catch(next);

/* ------------------------------- health ------------------------------- */
router.get('/health', wrap(async (_req, res) => {
  const db = await dbHealth();
  res.json({ ok: true, service: 'magxtv-api', uptime: process.uptime(), database: db, provider: PROVIDER_STATUS });
}));

/* ------------------------------ provider ------------------------------ */
router.get('/provider/status', wrap(async (_req, res) => { res.json(PROVIDER_STATUS); }));

/* ------------------------------ catalogue ----------------------------- */
router.get('/catalog', wrap(async (_req, res) => {
  const { catalog, status } = await loadCatalog();
  PROVIDER_STATUS.provider = status.provider;
  PROVIDER_STATUS.demo = status.demo;
  PROVIDER_STATUS.baseUrl = status.baseUrl;
  PROVIDER_STATUS.message = status.message;
  res.json({ demo: catalog.demo, provider: catalog.provider, status, catalog });
}));

/* Playback resolution. The stream is only ever handed out when its host is on
   STREAM_ALLOWLIST — this is the single gate that keeps unlicensed sources out.
   The demo ships with openly licensed test streams (Mux / Blender / Google). */
router.get('/player/source/:matchId', wrap(async (req, res) => {
  const { catalog } = await loadCatalog();
  const match = catalog.matches.find((m: { id: string }) => m.id === req.params.matchId);
  if (!match) { res.status(404).json({ error: 'That match is not in the catalogue.' }); return; }
  if (!match.streamPath) {
    res.status(409).json({ error: 'No authorised source is attached to this fixture yet. Add one under Admin → Streams.', sources: [] });
    return;
  }
  if (!isAllowedStreamHost(match.streamPath)) {
    res.status(403).json({ error: `Playback refused: ${new URL(match.streamPath).hostname} is not on STREAM_ALLOWLIST.`, sources: [] });
    return;
  }
  res.json({ matchId: match.id, sources: DEMO_STREAMS.filter((s: { path: string }) => isAllowedStreamHost(s.path)), primary: match.streamPath });
}));

/* -------------------------------- auth -------------------------------- */
router.post('/auth/register', wrap(async (req, res) => {
  const { name = '', email = '', password = '' } = (req.body ?? {}) as Record<string, string>;
  if (!name.trim() || !email.trim() || !password) { res.status(400).json({ error: 'Name, email and password are all required.' }); return; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.status(400).json({ error: 'Enter a valid email address.' }); return; }
  if (password.length < 8) { res.status(400).json({ error: 'Password must be at least 8 characters' }); return; }
  if (await repo.findUserByEmail(email)) { res.status(409).json({ error: 'An account with that email already exists' }); return; }
  const row = await repo.createUser(name, email, password, 'user', 'standard');
  const user = repo.toApiUser(row);
  await repo.addNotification(user.id, 'system', 'Welcome to MagxTV', 'Your account is ready. Favourite a competition and we will alert you before kick-off.');
  res.status(201).json({ user, token: signToken(user) });
}));

router.post('/auth/login', wrap(async (req, res) => {
  const { email = '', password = '' } = (req.body ?? {}) as Record<string, string>;
  const row = await repo.findUserByEmail(email);
  if (!row || !(await repo.verifyPassword(row, password))) { res.status(401).json({ error: 'Email or password is incorrect' }); return; }
  const user = repo.toApiUser(row);
  res.json({ user, token: signToken(user) });
}));

router.get('/auth/me', requireAuth, wrap(async (req, res) => { res.json({ user: req.user }); }));

/* ----------------------------- favourites ----------------------------- */
router.get('/favorites', requireAuth, wrap(async (req, res) => { res.json({ favorites: await repo.listFavorites(req.user!.id) }); }));
router.post('/favorites/:matchId', requireAuth, wrap(async (req, res) => { res.status(201).json({ favorites: await repo.addFavorite(req.user!.id, req.params.matchId) }); }));
router.delete('/favorites/:matchId', requireAuth, wrap(async (req, res) => { res.json({ favorites: await repo.removeFavorite(req.user!.id, req.params.matchId) }); }));

/* --------------------------- notifications ---------------------------- */
router.get('/notifications', requireAuth, wrap(async (req, res) => {
  const rows = await repo.listNotifications(req.user!.id);
  res.json({
    notifications: rows.map((n) => ({ id: String(n.id), kind: n.kind, title: n.title, body: n.body, read: Boolean(n.is_read), createdAt: new Date(n.created_at).toISOString() }))
  });
}));
router.post('/notifications/read', requireAuth, wrap(async (req, res) => {
  const id = (req.body ?? {}).id;
  await repo.markNotificationsRead(req.user!.id, id);
  res.json({ ok: true });
}));

/* ------------------------------ admin --------------------------------- */
router.get('/admin/users', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  res.json({ users: await repo.listUsers(), storage: repo.usingDatabase() ? 'postgresql' : 'memory', database: await dbHealth() });
}));
router.patch('/admin/users/:id', requireAuth, requireRole('admin'), wrap(async (req, res) => {
  const { role, plan } = (req.body ?? {}) as { role?: Role; plan?: Plan };
  if (role && !['user', 'admin'].includes(role)) { res.status(400).json({ error: 'Unknown role.' }); return; }
  const updated = await repo.updateUserRole(req.params.id, role ?? 'user', plan);
  if (!updated) { res.status(404).json({ error: 'No such user.' }); return; }
  res.json({ user: updated });
}));

router.get('/admin/overview', requireAuth, requireRole('admin'), wrap(async (_req, res) => {
  const { catalog, status } = await loadCatalog();
  const bySport = catalog.matches.reduce<Record<string, number>>((acc: Record<string, number>, m: { sport: string }) => { acc[m.sport] = (acc[m.sport] ?? 0) + 1; return acc; }, {});
  res.json({
    status, matches: catalog.matches.length, live: catalog.matches.filter((m: { status: string }) => m.status === 'live').length,
    leagues: catalog.leagues.length, highlights: catalog.highlights.length, bySport,
    users: (await repo.listUsers()).length,
    streamAllowlist: config.streamAllowlist, storage: repo.usingDatabase() ? 'postgresql' : 'memory'
  });
}));

export default router;
