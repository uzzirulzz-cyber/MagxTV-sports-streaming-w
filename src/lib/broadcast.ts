/* Client for the administrator-configured broadcast provider.
   Every call here hits our own API — the browser never talks to the panel. */
const SESSION_KEY = 'pbd.session';

function authToken(): string {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const s = raw ? (JSON.parse(raw) as { token?: string }) : null;
    return s?.token ?? '';
  } catch { return ''; }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(authToken() ? { Authorization: `Bearer ${authToken()}` } : {}), ...(init.headers || {}) }
    });
  } catch {
    throw new Error('The API server is not reachable. The broadcast panel needs the PlayBeat Digital API running (npm start).');
  }
  const text = await r.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text.slice(0, 200) }; }
  if (!r.ok) throw new Error((data as { error?: string })?.error || `Request failed (HTTP ${r.status}).`);
  return data as T;
}

const post = <T,>(p: string, body?: unknown) => call<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });

export interface ProviderPublic {
  configured: boolean; host?: string; username?: string;
  password?: string; passwordLength?: number; updatedAt?: string;
}
export interface ProviderAccount {
  status: string; username: string; isTrial: boolean; expiresAt: string | null; daysLeft: number;
  maxConnections: number | null; activeConnections: number | null; serverProtocol: string | null; timezone: string | null;
}
export interface BroadcastChannel {
  id: string; name: string; icon: string; categoryId: string; epgChannelId: string | null;
  /* Optional: present when the channel came from the provider router. */
  access?: 'free' | 'subscription'; sport?: string; group?: string; kind?: string;
}
export interface BroadcastCategory { id: string; name: string; count?: number }
export interface ProbeResult { channelId: string; ok: boolean; status: number; format: 'hls' | 'mpegts'; variants: number; segments: number | null; hint: string }

/* --- administrator --- */
export const getProvider = () => call<ProviderPublic>('/api/admin/provider');
export const testProvider = (host: string, username: string, password: string) =>
  post<{ ok: boolean; host: string; account: ProviderAccount }>('/api/admin/provider/test', { host, username, password });
export const connectProvider = (host: string, username: string, password: string) =>
  post<{ ok: boolean; provider: ProviderPublic; account: ProviderAccount }>('/api/admin/provider/connect', { host, username, password });
export const disconnectProvider = () => call<{ ok: boolean; provider: ProviderPublic }>('/api/admin/provider', { method: 'DELETE' });
export const adminChannels = (categoryId = '') =>
  call<{ categories: BroadcastCategory[]; channels: BroadcastChannel[]; total: number; shown: number; loadLimit: number }>(
    `/api/admin/provider/channels${categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''}`);
export const probeChannel = (id: string) => call<ProbeResult>(`/api/admin/provider/probe/${encodeURIComponent(id)}`);

/* --- viewers --- */
export const broadcastCatalog = (categoryId = '') =>
  call<{ configured: boolean; provider?: string; categories: BroadcastCategory[]; channels: BroadcastChannel[]; total: number; shown: number }>(
    `/api/broadcast/catalog${categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''}`);

export const requestPlaybackToken = () => post<{ token: string; expiresIn: number }>('/api/broadcast/token');

/* --- M3U fallback importer (admin) --- */
export interface M3uGroups { name: string; count: number; free: number; sport: string }
export interface M3uStats {
  total: number; hls: number; mpegts: number; mp4: number; unknown: number;
  free: number; subscription: number; withLogo: number; withEpg: number; groups: number; skipped: number;  access?: 'free' | 'subscription';
  sport?: string;

}
export interface QueueJob {
  id: string; type: string; label: string; state: 'queued' | 'running' | 'done' | 'error';
  progress: number; message: string; error: string | null; createdAt: string; finishedAt: string | null;
  result: null | { ok: boolean; stats: M3uStats; warnings: string[]; bucket: { driver: string; key: string; size: number }; url: string };
}
export interface BucketObject { key: string; size: number; updatedAt: string }
export interface M3uStatus {
  configured: boolean; playlistUrl: string | null;
  stored: null | { importedAt: string; stats: M3uStats; groups: number; source: { host: string | null; username: string | null; urlTvg: string | null; isGetPhp: boolean; outputExt: string | null }; warnings: string[] };
  bucket: { name: string; driver: string; root: string; objects: BucketObject[]; count: number };
  queue: { depth: number; jobs: QueueJob[] };
  router: { picked: string; demo: boolean; label: string; attempts: { source: string; ok: boolean; detail: string; count?: number }[] };
  limits: { maxBytes: number; maxChannels: number };
  providerKind: 'xtream' | 'm3u' | null;
}
export interface ImportedChannel {
  id: string; name: string; url: string; logo: string; group: string; tvgId: string;
  epgChannelId: string | null; kind: string; host: string; access: 'free' | 'subscription'; sport: string;
}
export const m3uStatus = () => call<M3uStatus>('/api/admin/m3u');
export const m3uImport = (url: string) => post<{ ok: boolean; job: QueueJob }>('/api/admin/m3u/import', { url });
export const m3uRefresh = () => post<{ ok: boolean; job: QueueJob }>('/api/admin/m3u/refresh');
export const m3uJob = (id: string) => call<{ job: QueueJob }>(`/api/admin/m3u/job/${encodeURIComponent(id)}`);
export const m3uChannels = (p: { group?: string; free?: boolean; q?: string } = {}) => {
  const qs = new URLSearchParams();
  if (p.group) qs.set('group', p.group);
  if (p.free) qs.set('free', '1');
  if (p.q) qs.set('q', p.q);
  const s = qs.toString();
  return call<{ groups: M3uGroups[]; stats: M3uStats; importedAt: string; warnings: string[]; total: number; shown: number; channels: ImportedChannel[] }>(
    `/api/admin/m3u/channels${s ? `?${s}` : ''}`);
};
export const m3uRemove = () => call<{ ok: boolean }>('/api/admin/m3u', { method: 'DELETE' });
export const m3uFree = () => call<{ source: string; total: number; freeGroups: { name: string; count: number; free: number }[]; channels: { id: string; name: string; group: string; icon: string; kind: string }[] }>('/api/admin/m3u/free');

