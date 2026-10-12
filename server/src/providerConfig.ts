/* The broadcast provider configured by an administrator — either an Xtream API
   panel (host + username + password) or an M3U playlist URL.
   Stored server-side only and never returned to a browser in cleartext. */
import { query, dbEnabled } from './db';
import { maskPlaylistUrl } from './m3u';

export type ProviderKind = 'xtream' | 'm3u';
export interface ConfiguredProvider { kind: ProviderKind; updatedAt: string; host: string; username: string; password: string }

let cache: ConfiguredProvider | null = null;
export const getConfigSync = (): ConfiguredProvider | null => cache;

/* M3U playlists are imported through the worker queue and read from here, so the
   playlist URL (which carries credentials for many providers) stays server-side. */
let playlistUrl: string | null = null;
export const getPlaylistUrl = (): string | null => playlistUrl;
export const setPlaylistUrl = (u: string | null): void => { playlistUrl = u; };
/** The masked form, safe for the admin panel. */
export const maskedPlaylistUrl = (): string | null => (playlistUrl ? maskPlaylistUrl(playlistUrl) : null);

export async function refresh(): Promise<ConfiguredProvider | null> {
  if (!dbEnabled) return cache;
  try {
    const r = await query<{ kind: string; host: string; username: string; password: string; updated_at: string }>(
      'SELECT kind, host, username, password, updated_at FROM provider_config WHERE id = 1'
    );
    const row = r.rows[0];
    cache = row
      ? { kind: (row.kind === 'm3u' ? 'm3u' : 'xtream'), host: row.host, username: row.username, password: row.password, updatedAt: new Date(row.updated_at).toISOString() }
      : null;
  } catch (e) {
    console.warn('[provider] could not read stored configuration:', e instanceof Error ? e.message : e);
  }
  return cache;
}

export async function saveProvider(p: { kind?: ProviderKind; host?: string; username?: string; password?: string }): Promise<ConfiguredProvider> {
  const prev = cache;
  cache = {
    kind: p.kind ?? prev?.kind ?? 'xtream',
    host: p.host ?? prev?.host ?? '',
    username: p.username ?? prev?.username ?? '',
    password: p.password ?? prev?.password ?? '',
    updatedAt: new Date().toISOString()
  };
  if (dbEnabled) {
    try {
      await query(
        `INSERT INTO provider_config (id, kind, host, username, password, updated_at)
         VALUES (1, $1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, host = EXCLUDED.host,
           username = EXCLUDED.username, password = EXCLUDED.password, updated_at = now()`,
        [cache.kind, cache.host, cache.username, cache.password]
      );
    } catch (e) {
      console.warn('[provider] configuration kept in memory only:', e instanceof Error ? e.message : e);
    }
  }
  return cache;
}

export async function clearProvider(): Promise<void> {
  cache = null; playlistUrl = null;
  if (dbEnabled) { try { await query('DELETE FROM provider_config WHERE id = 1'); } catch { /* ignore */ } }
}

export const maskSecret = (s: string) => '•'.repeat(Math.max(6, Math.min(14, s.length)));
