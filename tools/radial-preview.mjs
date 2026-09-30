/**
 * Renders the real radial menu in Chromium with Foundry mocked (tools/radial-harness.html),
 * drives a few clicks, checks the stored values, and saves screenshots to tools/out/.
 * Not part of `npm run check` (needs a browser). Usage:
 *   CHROMIUM_PATH=/opt/pw-browsers/chromium npm run preview
 */
import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname } from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer(async (req, res) =>
{
   if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
   try
   {
      const body = await readFile(new URL(`.${decodeURIComponent(req.url.split('?')[0])}`, root));
      res.writeHead(200, { 'content-type': types[extname(req.url)] ?? 'application/octet-stream' });
      res.end(body);
   }
   catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;
const out = new URL('out/', import.meta.url);
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 660 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); } });

let failed = false;
const check = (ok, msg) => { if (!ok) { failed = true; console.error(`FAIL ${msg}`); } };
const wait = () => page.waitForTimeout(250);

await page.goto(`${base}/tools/radial-harness.html`);
await page.waitForFunction(() => window.ready === true);
await wait();
await page.screenshot({ path: new URL('radial-root.png', out).pathname });

// Signal ring, then the Target Lock gauge, then set 4 by clicking its cell.
await page.click('[data-act="slice"][data-i="1"]');
await page.click('[data-act="slice"][data-i="0"]');
await wait();
await page.click('[data-act="cell"][data-v="4"]');
await wait();
check(await page.evaluate(() => window.store.getLevel(window.actor, 'targetLock')) === 4, 'clicking cell 4 sets Target Lock 4');
await page.hover('[data-act="cell"][data-v="6"]');
await page.screenshot({ path: new URL('radial-gauge.png', out).pathname });

// Wheel on the gauge raises it; arrow keys step it.
await page.mouse.wheel(0, -100);
await wait();
check(await page.evaluate(() => window.store.getLevel(window.actor, 'targetLock')) === 5, 'wheel up raises to 5');
await page.keyboard.press('ArrowLeft');
await wait();
check(await page.evaluate(() => window.store.getLevel(window.actor, 'targetLock')) === 4, 'left arrow lowers to 4');

// Esc twice returns to root; keys 4 opens Hacked; screenshot the systems ring.
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.keyboard.press('4');
await wait();
await page.screenshot({ path: new URL('radial-hacked.png', out).pathname });
check(await page.evaluate(() => window.radialMenu.path.join('/')) === 'hacked', 'key 4 opens Hacked');

// Temperature via root wheel: Hot (2) -> Overheating (3).
await page.keyboard.press('Escape');
await wait();
await page.hover('[data-act="slice"][data-i="0"]');
await page.mouse.wheel(0, -100);
await wait();
check(await page.evaluate(() => window.store.getLevel(window.actor, 'temperature')) === 3, 'wheel on Thermal raises to Overheating');
await page.screenshot({ path: new URL('radial-root-after.png', out).pathname });

// Esc at root closes; clicking outside closes.
await page.keyboard.press('Escape');
check(await page.evaluate(() => !window.radialMenu.isOpen && !document.querySelector('.etu-radial')), 'Esc at root closes the menu');

check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
await browser.close();
server.close();
console.log(failed ? 'Radial preview found problems.' : 'Radial preview passed. Screenshots in tools/out/.');
process.exit(failed ? 1 : 0);
