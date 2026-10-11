import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config';
import { dbHealth } from './db';
import { initStore } from './repo';
import { migrate } from './migrate';
import routes from './routes';
import { loadCatalog } from './providers';
import { PROVIDER_STATUS } from './providers/state';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '256kb' }));

app.use('/api', routes);

/* Serve the production build when it exists, so `npm start` runs the whole
   platform from one process. */
const dist = path.resolve(here, '../../dist');
app.use(express.static(dist, { index: false, maxAge: '1h' }));
app.get(/^\/(?!api).*/, (_req, res) => { res.sendFile(path.join(dist, 'index.html')); });

async function main() {
  await migrate();
  await initStore();
  const { status } = await loadCatalog();
  Object.assign(PROVIDER_STATUS, status);
  const db = await dbHealth();
  app.listen(config.port, () => {
    console.log(`\n  MagxTV API  →  http://localhost:${config.port}`);
    console.log(`  storage     :  ${db.ok ? 'PostgreSQL (' + db.detail + ')' : 'in-memory fallback'}`);
    console.log(`  provider    :  ${status.provider}${status.demo ? ' (DEMO DATA)' : ''}`);
    console.log(`  allowlist   :  ${config.streamAllowlist.join(', ')}\n`);
  });
}

main().catch((e) => { console.error('MagxTV failed to start:', e); process.exit(1); });
