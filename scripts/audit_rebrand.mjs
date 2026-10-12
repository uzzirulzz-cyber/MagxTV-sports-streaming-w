import { chromium } from 'playwright';
const BASE = 'http://localhost:8787';
const EXEC = process.env.CHROME_PATH || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const b = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const routes = ['/', '/live', '/login', '/football', '/cricket', '/basketball', '/tennis', '/motorsports',
  '/highlights', '/schedule', '/favorites', '/search', '/profile', '/connect', '/channels', '/credits', '/admin', '/?boot=1'];
let leaks = 0;
for (const r of routes) {
  const c = await b.newContext({ viewport: { width: 1440, height: 960 } });
  const p = await c.newPage();
  await p.addInitScript(() => { try { sessionStorage.setItem('pbd.boot.played', '1'); } catch {} });
  await p.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(1300);
  const body = await p.locator('body').innerText().catch(() => '');
  const html = await p.content();
  /* The retired name only: a bare 'mag' matches 'image'/'og:image' and was a false positive. */
  const hits = [...new Set([...`${body} ${html}`.matchAll(/[A-Za-z0-9@._-]*magx[A-Za-z0-9@._-]*/gi)].map((m) => m[0]))];
  const title = await p.title();
  const badTitle = /magx/i.test(title);
  if (hits.length || badTitle) { leaks++; console.log(`LEAK ${r.padEnd(15)} title="${title}" hits=${JSON.stringify(hits.slice(0, 8))}`); }
  else console.log(`clean ${r.padEnd(15)} title="${title}"`);
  await c.close();
}
console.log(leaks ? `\nFAIL: ${leaks}/${routes.length} routes carried another brand`
                  : `\nPASS: 0 brand leaks across ${routes.length} routes (visible text + full HTML + browser tab title)`);
await b.close();
