/* Captures the boot experience at desktop + mobile widths, including the real
   offline/degraded path (the catalogue request is aborted, not mocked).
     npm run build && npm start      # http://localhost:8787
     node scripts/shot_boot.mjs */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = path.resolve('shots');
await mkdir(OUT, { recursive: true });
const EXEC = process.env.CHROME_PATH || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const report = [];

async function shot(page, url, name) {
  const errors = [];
  const onErr = (e) => errors.push(String(e).slice(0, 140));
  page.on('pageerror', onErr);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const title = await page.locator('.mx-boot-title').first().textContent().catch(() => null);
  const pct = await page.locator('.mx-boot-bar').first().getAttribute('aria-valuenow').catch(() => null);
  const note = await page.locator('.mx-boot-note').first().innerText().catch(() => null);
  const btn = await page.locator('.mx-boot-btn').first().innerText().catch(() => null);
  const flat = (note || '').replace(/\s+/g, ' ');
  report.push({ name, title: (title || '').trim(), pct, note: flat.slice(0, 64), btn: (btn || '').trim(), errors });
  console.log(`✓ ${name.padEnd(26)} progress=${String(pct).padStart(3)}%  button="${(btn || '').trim()}"  note="${flat.slice(0, 46)}"${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  page.off('pageerror', onErr);
}

const desk = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const d = await desk.newPage();
await shot(d, BASE + '/?boot=1', 'desktop-boot-ready');
await shot(d, BASE + '/?stage=2', 'desktop-boot-progress');
await shot(d, BASE + '/?stage=0', 'desktop-boot-start');

/* Degraded path: abort the real catalogue call so the failure branch is exercised. */
const bad = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const b = await bad.newPage();
await b.route('**/api/catalog**', (r) => r.abort());
await shot(b, BASE + '/?boot=1', 'desktop-boot-degraded');

const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await mob.newPage();
await shot(m, BASE + '/?boot=1', 'mobile-boot-ready');
await shot(m, BASE + '/?stage=2', 'mobile-boot-progress');

/* A normal visit (intro already played) must land on the app itself. */
const after = await mob.newPage();
await after.addInitScript(() => { try { sessionStorage.setItem('pbd.boot.played', '1'); } catch {} });
await shot(after, BASE + '/live', 'mobile-live-after-boot');

await browser.close();
const badPages = report.filter((r) => r.errors.length);
console.log(`\nCaptured ${report.length} screenshots into ${OUT}`);
console.log(badPages.length ? `Pages reporting JS errors: ${badPages.map((x) => x.name).join(', ')}` : 'No page errors reported.');
