/* Captures the branded surfaces: boot mark, sign-in card, nav lockup — desktop + mobile.
   The image element's naturalWidth is asserted so a broken/missing asset fails loudly. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8787';
const OUT = path.resolve('shots');
await mkdir(OUT, { recursive: true });
const EXEC = process.env.CHROME_PATH || '/home/user/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = [];

async function shot(page, url, name, sel) {
  const errors = [];
  const onErr = (e) => errors.push(String(e).slice(0, 140));
  page.on('pageerror', onErr);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  let img = { src: null, naturalWidth: 0 };
  if (sel) img = await page.locator(sel).first().evaluate((el) => ({ src: el.getAttribute('src'), naturalWidth: el.naturalWidth })).catch(() => img);
  const title = await page.locator('h1').first().textContent().catch(() => null);
  const btn = await page.locator('.auth-submit, .mx-boot-btn').first().innerText().catch(() => null);
  const labels = await page.locator('.auth-field label').allInnerTexts().catch(() => []);
  report.push({ name, img, title: (title || '').trim(), btn: (btn || '').trim(), labels, errors });
  console.log(`✓ ${name.padEnd(24)} logo=${img.src} naturalWidth=${img.naturalWidth} h1="${(title || '').trim()}" button="${(btn || '').trim()}" labels=[${labels.join(' | ')}]${errors.length ? '  ERRORS: ' + errors.join(' | ') : ''}`);
  page.off('pageerror', onErr);
}

const APP = () => { try { sessionStorage.setItem('magx.boot.played', '1'); } catch {} };

const desk = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const d = await desk.newPage();
await d.addInitScript(APP);
await shot(d, BASE + '/login', 'desktop-login-branded', '.auth-mark img');
await shot(d, BASE + '/?boot=1', 'desktop-boot-branded', '.mx-boot-glyph');
await shot(d, BASE + '/', 'desktop-nav-branded', '.brand-img');

const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await mob.newPage();
await m.addInitScript(APP);
await shot(m, BASE + '/login', 'mobile-login-branded', '.auth-mark img');
await shot(m, BASE + '/?boot=1', 'mobile-boot-branded', '.mx-boot-glyph');

/* exercise the interactive controls: demo chip fills the form, then a real sign-in */
const flow = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const f = await flow.newPage();
await f.addInitScript(APP);
await f.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await f.getByRole('button', { name: 'Administrator' }).click();
await f.waitForTimeout(300);
const filled = { email: await f.inputValue('#auth-email'), pw: (await f.inputValue('#auth-password')).length };
await f.screenshot({ path: path.join(OUT, 'desktop-login-filled.png') });
await f.click('.auth-submit');
await f.waitForTimeout(2200);
console.log(`✓ demo chip filled email=${filled.email} passwordLength=${filled.pw} -> landed on ${new URL(f.url()).pathname}`);
await shot(f, BASE + '/profile', 'desktop-signed-in-branded', '.brand-img');

await browser.close();
const bad = report.filter((r) => r.errors.length || !r.img.naturalWidth || !r.img.src);
console.log(`\nCaptured ${report.length + 1} screenshots into ${OUT}`);
console.log(bad.length ? `FAILED brand assertions: ${bad.map((b) => b.name).join(', ')}` : 'All brand images loaded (naturalWidth > 0) on every surface.');
