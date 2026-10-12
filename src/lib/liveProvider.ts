/* Live-TV provider session (Xtream Codes compatible player_api.php).
   Host / username / password are entered by YOU at runtime and are kept only
   in this browser's localStorage plus the server's in-memory token map for the
   life of the session. They are never written into the source tree, this file,
   or the built bundle, and the app ships no provider credentials of its own. */
import { useEffect, useState } from 'react';

const KEY = 'pbd.live.provider';

export interface LiveAccount {
  status: string; username: string; isTrial: boolean; expiresAt: string | null;
  daysLeft: number; maxConnections: number | null; activeConnections: number | null;
  createdAt: string | null; serverProtocol: string | null; timezone: string | null; url: string | null;
}
export interface LiveSession { host: string; username: string; password: string; token: string; account: LiveAccount; at: string }
/** Anything that can be played back: a viewer's own session, or the short-lived
    grant handed to a viewer of the operator's broadcast. Only a token is needed. */
export interface PlaybackSession { token: string; host?: string }

export interface LiveCategory { id: string; name: string }
export interface LiveChannel { id: string; name: string; icon: string; categoryId: string; epgChannelId: string | null }

export const readSession = (): LiveSession | null => {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as LiveSession) : null; } catch { return null; }
};
export const writeSession = (s: LiveSession | null): void => {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* storage off */ }
  window.dispatchEvent(new Event('pbd:live'));
};

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`/api/live${path}`, init);
  const text = await r.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text.slice(0, 200) }; }
  if (!r.ok) throw new Error((data as { error?: string })?.error || `Request failed (HTTP ${r.status}).`);
  return data as T;
}
const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', 'x-live-token': token });

/** Verifies host + credentials against the panel and opens a 6-hour server session. */
export async function connectProvider(host: string, username: string, password: string): Promise<LiveSession> {
  const res = await api<{ token: string; host: string; account: LiveAccount }>('/connect', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ host, username, password })
  });
  const session: LiveSession = { host: res.host, username, password, token: res.token, account: res.account, at: new Date().toISOString() };
  writeSession(session);
  return session;
}
export const fetchCategories = (s: LiveSession) => api<{ categories: LiveCategory[] }>('/categories', { headers: authHeaders(s.token) });
export const fetchChannels = (s: LiveSession, categoryId = '') =>
  api<{ streams: LiveChannel[]; total: number; shown: number }>(`/streams${categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''}`, { headers: authHeaders(s.token) });
export async function disconnectProvider(s: LiveSession | null): Promise<void> {
  if (s) { try { await api('/disconnect', { method: 'POST', headers: authHeaders(s.token) }); } catch { /* already gone */ } }
  writeSession(null);
}

/* Same-origin relay URLs — the browser never contacts the provider directly,
   which is what avoids CORS and http-on-https mixed content. */
export const hlsUrl = (s: PlaybackSession, id: string) => `/api/live/hls/${encodeURIComponent(id)}.m3u8?t=${encodeURIComponent(s.token)}`;
export const tsUrl = (s: PlaybackSession, id: string) => `/api/live/ts/${encodeURIComponent(id)}.ts?t=${encodeURIComponent(s.token)}`;
export const channelCount = (s: LiveSession | null) => Boolean(s);

export function useProviderSession() {
  const [session, setSession] = useState<LiveSession | null>(() => readSession());
  useEffect(() => {
    const sync = () => setSession(readSession());
    window.addEventListener('pbd:live', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('pbd:live', sync); window.removeEventListener('storage', sync); };
  }, []);
  return session;
}
