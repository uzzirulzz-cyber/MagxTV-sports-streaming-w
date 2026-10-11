/* Client for the administrator-configured broadcast provider.
   Every call here hits our own API — the browser never talks to the panel. */
const SESSION_KEY = 'magx.session';

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
    throw new Error('The API server is not reachable. The broadcast panel needs the MagxTV API running (npm start).');
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
export interface BroadcastChannel { id: string; name: string; icon: string; categoryId: string; epgChannelId: string | null }
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
