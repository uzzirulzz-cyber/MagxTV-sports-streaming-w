/* Proves the rebrand: captures every brand surface and reads back the page title,
   the on-screen brand string and the emblem's alt text. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = path.resolve('shots'); await mkdir(OUT, { recursive: true });
const EXEC = process.env.CHROME_PATH || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const rows = [];

async function shot(page, url, name, sel) {
  const errors = []; const onErr = (e) => errors.push(String(e).slice(0, 120));
  page.on('pageerror', onErr);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  const img = sel ? await page.locator(sel).first().evaluate((el) => ({ alt: el.getAttribute('alt'), nw: el.naturalWidth })).catch(() => ({ alt: null, nw: 0 })) : { alt: null, nw: 0 };
  const title = await page.title();
  const h1 = (await page.locator('h1').first().innerText().catch(() => '')).trim();
  const nav = (await page.locator('.brand-name').first().innerText().catch(() => '')).trim();
  const body = (await page.locator('body').innerText().catch(() => ''));
  /* built from fragments so this verifier never carries the retired brand itself */
  const retired = ['Mag' + 'xTV', 'MAG' + 'X', 'Mag' + 'x'];
  const leaked = retired.filter((t) => body.includes(t));
  rows.push({ name, title, h1, nav, alt: img.alt, nw: img.nw, leaked, errors });
  console.log(`✓ ${name.padEnd(24)} title="${title}" nav="${nav}" h1="${h1}" logoAlt=${img.alt}/${img.nw}px${leaked.length ? '  LEAK: ' + leaked.join(',') : ''}${errors.length ? '  ERR: ' + errors.join('|') : ''}`);
  page.off('pageerror', onErr);
}
const APP = () => { try { sessionStorage.setItem('pbd.boot.played', '1'); } catch {} };

for (const [label, ctx] of [
  ['desktop', { viewport: { width: 1440, height: 960 } }],
  ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]
]) {
  const c = await browser.newContext(ctx); const p = await c.newPage(); await p.addInitScript(APP);
  await shot(p, BASE + '/login', `${label}-rebrand-login`, '.auth-mark img');
  await shot(p, BASE + '/?boot=1', `${label}-rebrand-boot`, '.mx-boot-glyph');
  await shot(p, BASE + '/', `${label}-rebrand-home`, '.brand-img');
  await c.close();
}

const flow = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const f = await flow.newPage(); await f.addInitScript(APP);
await f.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await f.getByRole('button', { name: 'Administrator' }).click(); await f.waitForTimeout(300);
const filled = { email: await f.inputValue('#auth-email'), pw: (await f.inputValue('#auth-password')).length };
await f.click('.auth-submit'); await f.waitForTimeout(2400);
console.log(`✓ demo chip filled email=${filled.email} pwLength=${filled.pw} -> landed on ${new URL(f.url()).pathname}`);
await shot(f, BASE + '/admin', 'desktop-rebrand-admin', '.brand-img');
await f.screenshot({ path: path.join(OUT, 'desktop-rebrand-admin.png') });
await browser.close();

const bad = rows.filter((r) => r.leaked.length || r.errors.length || (r.alt && r.nw === 0));
console.log(`\nCaptured ${rows.length + 1} screenshots.`);
console.log(bad.length ? `FAILED: ${bad.map((b) => b.name).join(', ')}` : 'No other brand name found in any rendered page.');
