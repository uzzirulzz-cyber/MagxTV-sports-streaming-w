/* Schema + seeds. Idempotent: safe to run repeatedly (npm run db:migrate). */
import { pool, dbEnabled } from './db';
import { createUser, findUserByEmail } from './repo';
import { SEED_ADMIN, SEED_USER } from './store';

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user'  CHECK (role IN ('user','admin')),
  plan          TEXT        NOT NULL DEFAULT 'free'  CHECK (plan IN ('free','standard','premium')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS favorites (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'system' CHECK (kind IN ('match','goal','system')),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS provider_config (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  kind       TEXT NOT NULL DEFAULT 'xtream' CHECK (kind IN ('xtream','m3u')),
  host       TEXT NOT NULL,
  username   TEXT NOT NULL,
  password   TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stream_overrides (
  match_id   TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function migrate(): Promise<void> {
  if (!dbEnabled) { console.log('[migrate] DATABASE_URL not set — using the in-memory store instead.'); return; }
  await pool!.query(SCHEMA);
  /* existing installs: add the provider kind column */
  await pool!.query("ALTER TABLE provider_config ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'xtream'");
  console.log('[migrate] schema ready.');

  if (!(await findUserByEmail(SEED_ADMIN.email))) {
    await createUser(SEED_ADMIN.name, SEED_ADMIN.email, SEED_ADMIN.password, 'admin', 'premium');
    console.log('[migrate] seeded admin:', SEED_ADMIN.email);
  }
  if (!(await findUserByEmail(SEED_USER.email))) {
    await createUser(SEED_USER.name, SEED_USER.email, SEED_USER.password, 'user', 'standard');
    console.log('[migrate] seeded viewer:', SEED_USER.email);
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  migrate()
    .then(() => pool?.end())
    .then(() => process.exit(0))
    .catch((e) => { console.error('[migrate] failed:', e); process.exit(1); });
}
