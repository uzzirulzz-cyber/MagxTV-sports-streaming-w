/* Provider router — decides which source feeds the live catalogue, and reports
   the whole chain so the UI can explain a fallback instead of failing silently.

   Order:  admin Xtream API  ->  admin M3U playlist (bucket-backed)
           ->  env Xtream     ->  demo catalogue (labelled) */
import { config } from './config';
import { getConfigSync, getPlaylistUrl, maskedPlaylistUrl } from './providerConfig';
import { sharedBucket, PLAYLISTS } from './storage';
import { playerApi } from './live';
import { parsePlaylist, type M3uChannel, type M3uGroup, type M3uStats } from './m3u';
import type { SportId } from './providers/catalog';

export type SourceId = 'xtream' | 'm3u' | 'env-xtream' | 'demo';

export interface ChannelView {
  id: string; name: string; icon: string; group: string; categoryId: string;
  epgChannelId: string | null; kind: string; access: 'free' | 'subscription'; sport: SportId;
}
export interface Attempt { source: SourceId; ok: boolean; detail: string; count?: number }
export interface CatalogResult {
  source: SourceId; demo: boolean;
  label: string;                 /* safe to show: never includes credentials */
  channels: ChannelView[]; total: number; shown: number;
  categories: { id: string; name: string; count: number }[];
  stats: Partial<M3uStats>;      /* present for M3U imports */
  attempts: Attempt[]; warnings: string[];
  importedAt: string | null;
}
export interface PlaybackRef { kind: 'xtream' | 'm3u'; id: string }

/* Channels are addressed as "<source>:<id>" so the player can be handed one
   opaque reference instead of a URL. */
const ref = (source: SourceId, id: string) => `${source}:${id}`;
export function parseRef(raw: string): PlaybackRef | null {
  const i = String(raw).indexOf(':');
  if (i <= 0) return null;
  const source = raw.slice(0, i);
  const id = raw.slice(i + 1);
  if (!id) return null;
  if (source === 'xtream' || source === 'env-xtream') return { kind: 'xtream', id };
  if (source === 'm3u') return { kind: 'm3u', id };
  return null;
}

export interface StoredPlaylist {
  importedAt: string; stats: M3uStats; warnings: string[];
  source: { host: string | null; username: string | null; urlTvg: string | null; isGetPhp: boolean; outputExt: string | null };
  groups: M3uGroup[];
  channels: M3uChannel[];
}
export const readStoredPlaylist = async (): Promise<StoredPlaylist | null> => {
  const raw = await sharedBucket(PLAYLISTS).get('latest.json').catch(() => null);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredPlaylist; } catch { return null; }
};
export const storedPlaylistObjects = () => sharedBucket(PLAYLISTS).list('').catch(() => []);

export async function resolveCatalog(opts: { categoryId?: string; limit?: number; freeOnly?: boolean } = {}): Promise<CatalogResult> {
  const limit = opts.limit ?? 1000;
  const attempts: Attempt[] = [];
  const provider = getConfigSync();

  /* ---- 1. admin-configured Xtream API ---- */
  if (provider && provider.kind === 'xtream' && provider.host) {
    try {
      const params: Record<string, string> = { action: 'get_live_streams' };
      if (opts.categoryId) params.category_id = opts.categoryId;
      const [catsRaw, streamsRaw] = await Promise.all([
        opts.categoryId ? Promise.resolve([]) : playerApi(provider, { action: 'get_live_categories' }, 20_000).catch(() => []),
        playerApi(provider, params, 30_000)
      ]);
      const all = Array.isArray(streamsRaw) ? streamsRaw : [];
      const channels: ChannelView[] = all.slice(0, limit).map((s: any) => ({
        id: ref('xtream', String(s.stream_id ?? '')),
        name: String(s.name ?? 'Live channel'),
        icon: String(s.stream_icon ?? ''),
        group: '',
        categoryId: String(s.category_id ?? ''),
        epgChannelId: s.epg_channel_id ? String(s.epg_channel_id) : null,
        kind: 'xtream',
        access: 'subscription' as const,
        sport: 'football' as SportId
      })).filter((c) => c.id !== 'xtream:');
      const categories = (Array.isArray(catsRaw) ? catsRaw : []).map((x: any) => ({
        id: String(x.category_id), name: String(x.category_name ?? 'Live'), count: 0
      }));
      const counts = new Map<string, number>();
      channels.forEach((c) => counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1));
      categories.forEach((c) => { c.count = counts.get(c.id) ?? 0; });
      attempts.push({ source: 'xtream', ok: true, detail: `Xtream API at ${provider.host}`, count: all.length });
      return {
        source: 'xtream', demo: false, label: `Xtream API — ${provider.username}@${provider.host.replace(/^https?:\/\//, '')}`,
        channels, total: all.length, shown: channels.length, categories, stats: {},
        attempts, warnings: [], importedAt: provider.updatedAt
      };
    } catch (e) {
      attempts.push({ source: 'xtream', ok: false, detail: e instanceof Error ? e.message : 'Xtream API failed' });
    }
  }

  /* ---- 2. admin M3U playlist, served from the bucket ---- */
  if (getPlaylistUrl() || (await readStoredPlaylist())) {
    const stored = await readStoredPlaylist();
    if (stored) {
      let channels: ChannelView[] = stored.channels.map((c) => ({
        id: ref('m3u', c.id), name: c.name, icon: c.logo, group: c.group, categoryId: c.group,
        epgChannelId: c.epgChannelId, kind: c.kind,
        access: (c.access === 'free' ? 'free' : 'subscription') as ChannelView['access'], sport: c.sport as SportId
      }));
      if (opts.categoryId) channels = channels.filter((c) => c.categoryId === opts.categoryId);
      if (opts.freeOnly) channels = channels.filter((c) => c.access === 'free');
      const total = channels.length;
      channels = channels.slice(0, limit);
      attempts.push({ source: 'm3u', ok: true, detail: `M3U playlist ${maskedPlaylistUrl() ?? '(imported earlier)'}`, count: total });
      return {
        source: 'm3u', demo: false,
        label: `M3U playlist — ${maskedPlaylistUrl() ?? stored.source.host ?? 'imported'}`,
        channels, total, shown: channels.length,
        categories: stored.groups.map((g) => ({ id: g.name, name: g.name, count: g.count })),
        stats: stored.stats, attempts, warnings: stored.warnings, importedAt: stored.importedAt
      };
    }
    attempts.push({ source: 'm3u', ok: false, detail: 'A playlist URL is saved but no import has completed yet.' });
  }

  /* ---- 3. environment Xtream credentials ---- */
  if (config.providerBaseUrl && config.providerUser && config.providerPass) {
    attempts.push({ source: 'env-xtream', ok: false, detail: 'Environment Xtream credentials exist but the live channel pipeline is not configured for them.' });
  }

  /* ---- 4. labelled demo catalogue ---- */
  attempts.push({ source: 'demo', ok: true, detail: 'Serving the clearly-labelled demo catalogue.' });
  return {
    source: 'demo', demo: true, label: 'Demo catalogue (no provider configured)',
    channels: [], total: 0, shown: 0, categories: [], stats: {},
    attempts, warnings: ['No live provider is configured. Connect an Xtream API panel or import an M3U playlist in Admin → Broadcast.'],
    importedAt: null
  };
}

/** The URL a channel should be relayed from, resolved server-side only. */
export async function playbackUrlsFor(channelRef: string): Promise<{ id: string; host: string; hls: string; ts: string } | null> {
  const parsed = parseRef(channelRef);
  if (!parsed) return null;
  const provider = getConfigSync();
  if (parsed.kind === 'xtream') {
    if (!provider || provider.kind !== 'xtream') return null;
    const base = `${provider.host}/live/${encodeURIComponent(provider.username)}/${encodeURIComponent(provider.password)}/${encodeURIComponent(parsed.id)}`;
    return { id: parsed.id, host: provider.host, hls: `${base}.m3u8`, ts: `${base}.ts` };
  }
  const stored = await readStoredPlaylist();
  const ch = stored?.channels.find((c) => c.id === parsed.id);
  if (!ch) return null;
  const u = new URL(ch.url);
  return { id: ch.id, host: `${u.protocol}//${u.host}`, hls: ch.url, ts: ch.url };
}
