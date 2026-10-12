/* Admin M3U importer — the fallback path alongside the Xtream API loader.
   Import runs as a queued worker job; results land in the playlists bucket. */
import { Router } from 'express';
import { requireAuth, requireRole } from '../auth';
import { queue } from '../queue';
import { allowlistForImport, refreshImport, startImport, MAX_PLAYLIST_BYTES, type ImportResult } from '../importPipeline';
import { resolveCatalog, storedPlaylistObjects, readStoredPlaylist } from '../providerRouter';
import { getPlaylistUrl, maskedPlaylistUrl, clearProvider, getConfigSync } from '../providerConfig';
import { sharedBucket, PLAYLISTS, storageDriver, bucketRoot } from '../storage';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/* ---- status: what is configured, what is stored, what the router would pick ---- */
router.get('/', async (_req, res) => {
  const stored = await readStoredPlaylist();
  const objects = await storedPlaylistObjects();
  const resolved = await resolveCatalog({ limit: 1 });
  res.json({
    configured: Boolean(getPlaylistUrl()) || Boolean(stored),
    playlistUrl: maskedPlaylistUrl(),
    stored: stored ? { importedAt: stored.importedAt, stats: stored.stats, groups: stored.groups.length, source: stored.source, warnings: stored.warnings } : null,
    bucket: { name: PLAYLISTS, driver: storageDriver(), root: bucketRoot(), objects: objects.slice(0, 8), count: objects.length },
    queue: { depth: queue.queueDepth, jobs: queue.list(8) },
    router: { picked: resolved.source, demo: resolved.demo, label: resolved.label, attempts: resolved.attempts },
    limits: { maxBytes: MAX_PLAYLIST_BYTES, maxChannels: 20000 },
    providerKind: getConfigSync()?.kind ?? null
  });
});

/* ---- start an import (returns the job immediately) ---- */
router.post('/import', async (req, res) => {
  const url = String((req.body ?? {}).url ?? '').trim();
  if (!url) { res.status(400).json({ error: 'A playlist URL is required.' }); return; }
  try { new URL(url); } catch { res.status(400).json({ error: 'That does not look like a valid playlist URL.' }); return; }
  const job = startImport(url, allowlistForImport());
  res.status(202).json({ ok: true, job });
});

/* ---- re-import the saved playlist ---- */
router.post('/refresh', async (_req, res) => {
  const job = refreshImport(allowlistForImport());
  if (!job) { res.status(409).json({ error: 'No playlist URL is saved yet — import one first.' }); return; }
  res.status(202).json({ ok: true, job });
});

router.get('/job/:id', (req, res) => {
  const job = queue.get(String(req.params.id));
  if (!job) { res.status(404).json({ error: 'No such job — the queue keeps the last 50.' }); return; }
  res.json({ job });
});

/* ---- the parsed channels, straight from the bucket ---- */
router.get('/channels', async (req, res) => {
  const stored = await readStoredPlaylist();
  if (!stored) { res.status(409).json({ error: 'No playlist has been imported yet.' }); return; }
  const group = String(req.query.group ?? '').trim();
  const freeOnly = String(req.query.free ?? '') === '1';
  const q = String(req.query.q ?? '').trim().toLowerCase();
  let channels = stored.channels;
  if (group) channels = channels.filter((c) => c.group === group);
  if (freeOnly) channels = channels.filter((c) => c.access === 'free');
  if (q) channels = channels.filter((c) => c.name.toLowerCase().includes(q));
  const total = channels.length;
  res.json({
    groups: stored.groups, stats: stored.stats, source: stored.source,
    importedAt: stored.importedAt, warnings: stored.warnings,
    total, shown: Math.min(total, 400),
    channels: channels.slice(0, 400)
  });
});

/* ---- forget the imported playlist ---- */
router.delete('/', async (_req, res) => {
  const b = sharedBucket(PLAYLISTS);
  for (const o of await b.list('')) await b.delete(o.key);
  await clearProvider();
  res.json({ ok: true });
});

/* ---- free content only: the open-licence slice of the catalogue ---- */
router.get('/free', async (_req, res) => {
  const resolved = await resolveCatalog({ freeOnly: true, limit: 200 });
  const stored = await readStoredPlaylist();
  res.json({
    source: resolved.source, total: resolved.total,
    freeGroups: stored ? stored.groups.filter((g) => g.free > 0) : [],
    channels: resolved.channels.map((c) => ({ id: c.id, name: c.name, group: c.group, icon: c.icon, kind: c.kind, access: c.access }))
  });
});

export default router;
