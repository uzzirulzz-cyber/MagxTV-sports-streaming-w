import pg from 'pg';
import { config } from './config';

const { Pool } = pg;

/* PostgreSQL is used whenever DATABASE_URL is present. Without it the API
   transparently serves the in-memory store so the demo build is fully usable. */
export const dbEnabled = Boolean(config.databaseUrl && /^postgres(ql)?:\/\//.test(config.databaseUrl));

export const pool = dbEnabled
  ? new Pool({ connectionString: config.databaseUrl, max: 8, idleTimeoutMillis: 30_000 })
  : null;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<pg.QueryResult<T>> {
  if (!pool) throw new Error('PostgreSQL is not configured (DATABASE_URL is empty).');
  return pool.query<T>(text, values as never[]);
}

export async function dbHealth(): Promise<{ ok: boolean; detail: string }> {
  if (!pool) return { ok: false, detail: 'in-memory store (no DATABASE_URL configured)' };
  try { await pool.query('SELECT 1'); return { ok: true, detail: 'connected' }; }
  catch (e) { return { ok: false, detail: e instanceof Error ? e.message : 'unreachable' }; }
}
