/* The broadcast provider configured by an administrator.
   Stored server-side only (PostgreSQL when available, otherwise process memory)
   and never returned to a browser in cleartext. */
import { query, dbEnabled } from './db';

export interface ConfiguredProvider { host: string; username: string; password: string; updatedAt: string }

let cache: ConfiguredProvider | null = null;

export const getConfigSync = (): ConfiguredProvider | null => cache;

export async function refresh(): Promise<ConfiguredProvider | null> {
  if (!dbEnabled) return cache;
  try {
    const r = await query<{ host: string; username: string; password: string; updated_at: string }>(
      'SELECT host, username, password, updated_at FROM provider_config WHERE id = 1'
    );
    const row = r.rows[0];
    cache = row ? { host: row.host, username: row.username, password: row.password, updatedAt: new Date(row.updated_at).toISOString() } : null;
  } catch (e) {
    console.warn('[provider] could not read stored configuration:', e instanceof Error ? e.message : e);
  }
  return cache;
}

export async function saveProvider(p: { host: string; username: string; password: string }): Promise<ConfiguredProvider> {
  cache = { host: p.host, username: p.username, password: p.password, updatedAt: new Date().toISOString() };
  if (dbEnabled) {
    try {
      await query(
        `INSERT INTO provider_config (id, host, username, password, updated_at)
         VALUES (1, $1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE SET host = EXCLUDED.host, username = EXCLUDED.username,
           password = EXCLUDED.password, updated_at = now()`,
        [p.host, p.username, p.password]
      );
    } catch (e) {
      console.warn('[provider] configuration kept in memory only:', e instanceof Error ? e.message : e);
    }
  }
  return cache;
}

export async function clearProvider(): Promise<void> {
  cache = null;
  if (dbEnabled) { try { await query('DELETE FROM provider_config WHERE id = 1'); } catch { /* ignore */ } }
}

/** Looks like a stored password without ever revealing it. */
export const maskSecret = (s: string) => '•'.repeat(Math.max(6, Math.min(14, s.length)));
