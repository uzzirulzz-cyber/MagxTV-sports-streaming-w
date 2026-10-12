import 'dotenv/config';

const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: num(process.env.PORT, 8787),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'playbeat-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  /* Sports data provider adapter -------------------------------------------- */
  provider: (process.env.SPORTS_PROVIDER ?? 'mock').toLowerCase(),
  providerBaseUrl: process.env.SPORTS_API_BASE_URL ?? '',
  providerUser: process.env.SPORTS_API_USER ?? '',
  providerPass: process.env.SPORTS_API_PASS ?? '',
  /* Only hosts on this list may ever be played back. */
  streamAllowlist: (process.env.STREAM_ALLOWLIST ?? 'test-streams.mux.dev,commondatastorage.googleapis.com')
    .split(',').map((s) => s.trim()).filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:4173')
    .split(',').map((s) => s.trim()).filter(Boolean)
};

export const isAllowedStreamHost = (url: string): boolean => {
  try { return config.streamAllowlist.includes(new URL(url).hostname); } catch { return false; }
};
