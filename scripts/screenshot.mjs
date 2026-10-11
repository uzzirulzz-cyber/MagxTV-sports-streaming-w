/* Captures every route at desktop + mobile widths. Start the app first:
     npm run build && npm start        # http://localhost:8787
     npm run shot
   Uses Playwright chromium from devDependencies. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = path.resolve('shots');
await mkdir(OUT, { recursive: true });

const ROUTES = ['/', '/live', '/football', '/cricket', '/basketball', '/tennis', '/motorsports',
  '/highlights', '/schedule', '/search?q=cup', '/favorites', '/profile', '/login', '/credits'];

const EXEC = process.env.CHROME_PATH || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser = await chromium.launch({
  executablePath: EXEC || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required']
});
const report = [];

async function capture(page, route, name, size) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const h1 = await page.locator('h1, h2').first().textContent().catch(() => null);
  report.push({ name, route, size, heading: (h1 || '').trim().slice(0, 60), errors });
  console.log(`✓ ${name.padEnd(20)} ${route.padEnd(20)} "${(h1 || '').trim().slice(0, 44)}"${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const dpage = await desktop.newPage();

for (const r of ROUTES) {
  await capture(dpage, r, ('desktop' + r.replace(/[/?=]/g, '-').replace(/-+$/, '') || 'desktop-home'), '1440x960');
}

/* Watch Match — take the first live fixture straight off the home page */
await dpage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await dpage.waitForTimeout(1500);
const href = await dpage.locator('a[href^="/watch/"]').first().getAttribute('href').catch(() => null);
if (href) await capture(dpage, href, 'desktop-watch-match', '1440x960');
else console.log('! no /watch/ link found on home');

/* Admin — sign in through the real form, then capture the role-gated dashboard */
await dpage.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await dpage.fill('input[type="email"], input[name="email"]', 'admin@magxtv.example');
await dpage.fill('input[type="password"], input[name="password"]', 'MagxAdmin#2026');
await dpage.click('button[type="submit"], form button');
await dpage.waitForTimeout(1600);
await capture(dpage, '/admin', 'desktop-admin', '1440x960');
await capture(dpage, '/favorites', 'desktop-favorites-signed-in', '1440x960');

/* Mobile */
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mobile.newPage();
await capture(mpage, '/', 'mobile-home', '390x844');
await capture(mpage, '/live', 'mobile-live', '390x844');
if (href) await capture(mpage, href, 'mobile-watch-match', '390x844');
await mpage.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await mpage.fill('input[type="email"], input[name="email"]', 'admin@magxtv.example');
await mpage.fill('input[type="password"], input[name="password"]', 'MagxAdmin#2026');
await mpage.click('button[type="submit"], form button');
await mpage.waitForTimeout(1600);
await capture(mpage, '/admin', 'mobile-admin', '390x844');

await browser.close();
const bad = report.filter((r) => r.errors.length);
console.log(`\nCaptured ${report.length} screenshots into ${OUT}`);
console.log(bad.length ? `Pages reporting JS errors: ${bad.map((b) => b.name).join(', ')}` : 'No page errors reported.');
