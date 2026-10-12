/* Live-provider (Xtream Codes compatible) integration helpers.
   Credentials are supplied by the operator at runtime, held only in this
   process's memory behind an opaque token, and never written to disk. */
import crypto from 'node:crypto';
import { getConfigSync } from './providerConfig';

export interface Creds { host: string; username: string; password: string }
type Kind = 'session' | 'broadcast';
interface Entry { kind: Kind; creds?: Creds; userId?: string; expires: number }

const TOKENS = new Map<string, Entry>();
const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_TOKENS = 64;

export function normaliseHost(raw: unknown): string {
  let h = String(raw ?? '').trim();
  if (!h) throw new Error('Host is required.');
  if (!/^https?:\/\//i.test(h)) h = 'http://' + h;
  let u: URL;
  try { u = new URL(h); } catch { throw new Error('That does not look like a valid host.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Host must be http:// or https://.');
  return u.origin;
}

const store = (entry: Entry): string => {
  const t = crypto.randomBytes(24).toString('hex');
  if (TOKENS.size >= MAX_TOKENS) { const oldest = TOKENS.keys().next().value; if (oldest) TOKENS.delete(oldest); }
  TOKENS.set(t, entry);
  return t;
};

/** A viewer's own provider session (credentials the viewer typed in). */
export function issueToken(creds: Creds): string {
  return store({ kind: 'session', creds, expires: Date.now() + TTL_MS });
}

/* A short-lived playback grant for the administrator-configured broadcast.
   It stores no credentials: the provider is looked up when the grant is used,
   so rotating the provider immediately invalidates old grants' usefulness. */
const PLAYBACK_TTL_MS = 30 * 60 * 1000;
export function issueBroadcastToken(userId: string): string {
  return store({ kind: 'broadcast', userId, expires: Date.now() + PLAYBACK_TTL_MS });
}
export function readToken(t: unknown): Creds | null {
  const key = String(t ?? '');
  if (!key) return null;
  const e = TOKENS.get(key);
  if (!e) return null;
  if (e.expires < Date.now()) { TOKENS.delete(key); return null; }
  if (e.kind === 'broadcast') {
    const c = getConfigSync();
    return c ? { host: c.host, username: c.username, password: c.password } : null;
  }
  return e.creds ?? null;
}

/** True when the token belongs to the admin-configured broadcast. */
export function isBroadcastToken(t: unknown): boolean {
  const e = TOKENS.get(String(t ?? ''));
  return Boolean(e && e.kind === 'broadcast' && e.expires > Date.now());
}
export function dropToken(t: unknown): void { TOKENS.delete(String(t ?? '')); }
export function activeTokens(): number { return TOKENS.size; }

/* ---- upstream calls (server-side only; the browser never talks to the panel) ---- */
export async function playerApi(creds: Creds, params: Record<string, string> = {}, timeoutMs = 15_000): Promise<any> {
  const q = new URLSearchParams({ username: creds.username, password: creds.password, ...params });
  const url = `${creds.host}/player_api.php?${q.toString()}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'MagxTV/1.0 (+platform)' } });
  if (!r.ok) throw new Error(`The provider answered HTTP ${r.status}.`);
  const text = await r.text();
  try { return JSON.parse(text); } catch { throw new Error('The provider did not return JSON — check the host and credentials.'); }
}

export function liveStreamUrl(creds: Creds, id: string, ext: 'm3u8' | 'ts'): string {
  return `${creds.host}/live/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${encodeURIComponent(id)}.${ext}`;
}

/* Hosts a relay request is allowed to be pointed at: the configured Xtream
   panel, plus every host present in the imported playlist. Memoised against the
   playlist's import timestamp so a large import does not rebuild it per segment. */
let pinCache: { stamp: string; hosts: Set<string> } | null = null;
export async function pinnedHosts(): Promise<Set<string>> {
  const { readStoredPlaylist } = await import('./providerRouter');
  const stored = await readStoredPlaylist();
  const stamp = stored?.importedAt ?? 'none';
  if (pinCache && pinCache.stamp === stamp) return pinCache.hosts;
  const hosts = new Set<string>();
  const p = getConfigSync();
  if (p?.host) { try { hosts.add(new URL(p.host).host); } catch { /* ignore */ } }
  for (const c of stored?.channels ?? []) { try { hosts.add(new URL(c.url).host); } catch { /* ignore */ } }
  pinCache = { stamp, hosts };
  return hosts;
}

/* One entry point for both flows: a viewer's own panel session (bare numeric id
   plus credentials) or a router reference such as "xtream:123" / "m3u:c4f2". */
export async function resolveUpstream(refOrId: string, creds: Creds | null): Promise<URL | null> {
  const raw = String(refOrId);
  if (raw.includes(':')) {
    const { playbackUrlsFor } = await import('./providerRouter');
    const urls = await playbackUrlsFor(raw);
    if (!urls) return null;
    try { return assertRelayable(urls.hls); } catch { return null; }
  }
  if (creds && /^[A-Za-z0-9_.-]+$/.test(raw)) {
    try { return assertRelayable(liveStreamUrl(creds, raw, 'm3u8')); } catch { return null; }
  }
  return null;
}

/* Resolve a channel reference ("xtream:<id>" or "m3u:<id>") to the URL that
   must be relayed. Imported playlist entries keep their own absolute URL, and
   the relay is pinned to that channel's host below. */
export async function upstreamFor(ref: string): Promise<URL | null> {
  const { playbackUrlsFor } = await import('./providerRouter');
  const urls = await playbackUrlsFor(ref);
  if (!urls) return null;
  try { return assertRelayable(urls.hls); } catch { return null; }
}

/* ---- relay guard: block SSRF and anything that is not media ---- */
const PRIVATE = /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i;
export function assertRelayable(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('Malformed media URL.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) media can be relayed.');
  if (PRIVATE.test(u.hostname)) throw new Error('Private addresses are never relayed.');
  const media = /\.(m3u8|ts|m4s|mp4|aac|key|vtt|mp3)(\?|$)/i.test(u.pathname + u.search);
  const panelPath = /^\/(live|movie|series|timeshift|hls|vod|stream)\//i.test(u.pathname);
  if (!media && !panelPath) throw new Error('That upstream path is not relayable media.');
  return u;
}

/* Rewrite an HLS playlist so every child request comes back through this API. */
export function rewritePlaylist(body: string, playlistUrl: string, token: string): string {
  const proxy = (abs: string) => `/api/live/seg?t=${encodeURIComponent(token)}&u=${Buffer.from(abs).toString('base64url')}`;
  const resolve = (ref: string) => { try { return new URL(ref, playlistUrl).toString(); } catch { return ''; } };
  return body.split(/\r?\n/).map((line) => {
    const s = line.trim();
    if (!s) return line;
    if (s.startsWith('#')) {
      if (/URI="/.test(s)) return s.replace(/URI="([^"]+)"/g, (_m, ref: string) => `URI="${proxy(resolve(ref))}"`);
      return line;
    }
    return proxy(resolve(s));
  }).join('\n');
}
