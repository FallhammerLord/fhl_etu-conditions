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
const wait = () => page.waitForTimeout(500);
// The live ring; a ring that is furling away also carries data-act while it fades.
const live = (sel) => `.etu-layer ${sel}`;

await page.goto(`${base}/tools/radial-harness.html`);
await page.waitForFunction(() => window.ready === true);
await page.waitForTimeout(90);
await page.screenshot({ path: new URL('radial-unfurl.png', out).pathname });
await wait();
await page.screenshot({ path: new URL('radial-root.png', out).pathname });

// Signal ring, then the Target Lock gauge, then set 4 by clicking its cell.
await page.click(live('[data-act="slice"][data-i="1"]'));
await page.click(live('[data-act="slice"][data-i="0"]'));
await wait();
await page.click(live('[data-act="cell"][data-v="4"]'));
await wait();
check(await page.evaluate(() => window.store.getLevel(window.actor, 'targetLock')) === 4, 'clicking cell 4 sets Target Lock 4');
await page.hover(live('[data-act="cell"][data-v="6"]'));
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
const hackedSlices = await page.locator(live('[data-act="slice"]')).count();
check(hackedSlices === 4, `Hacked lists 4 systems (rail, Silver Hail once, bay, sensor array), got ${hackedSlices}`);

// Hacking the linked attack's system: set 2 on Silver Hail, then read it from the attack half.
await page.click(live('[data-act="slice"][data-i="1"]'));
await page.click(live('[data-act="cell"][data-v="2"]'));
await wait();
check(await page.evaluate(() => window.store.getHacked(window.actor).map((h) => `${h.name}:${h.rating}`).join(',')) === 'Silver Hail:2,Missile Bay:3',
   'Silver Hail hacked once, on the artifact');
await page.keyboard.press('Escape');
await wait();

// Temperature via root wheel: Hot (2) -> Overheating (3).
await page.keyboard.press('Escape');
await wait();
await page.hover(live('[data-act="slice"][data-i="0"]'));
await page.mouse.wheel(0, -100);
await wait();
check(await page.evaluate(() => window.store.getLevel(window.actor, 'temperature')) === 3, 'wheel on Thermal raises to Overheating');
await page.screenshot({ path: new URL('radial-root-after.png', out).pathname });

// Esc at root closes; clicking outside closes.
await page.keyboard.press('Escape');
check(await page.evaluate(() => !window.radialMenu.isOpen), 'Esc at root closes the menu');
await wait();
check(await page.evaluate(() => !document.querySelector('.etu-radial')), 'the closed ring is removed after furling');

// A right-click opens on release, not on press; a release after dragging (a pan) opens nothing.
const rightClick = (dx) => page.evaluate(async (dx) =>
{
   window.radialMenu.open(window.token, { clientX: 420, clientY: 330, buttons: 2 });
   const openBeforeRelease = window.radialMenu.isOpen;
   window.dispatchEvent(new PointerEvent('pointerup', { button: 2, clientX: 420 + dx, clientY: 330 }));
   await new Promise((r) => setTimeout(r, 150));
   const result = { openBeforeRelease, openAfter: window.radialMenu.isOpen };
   window.radialMenu.close();
   return result;
}, dx);
const click = await rightClick(0);
check(!click.openBeforeRelease, 'ring waits for the right-button release');
check(click.openAfter, 'ring opens after the release');
const pan = await rightClick(40);
check(!pan.openAfter, 'a right-drag (pan) does not open the ring');

// Foundry may report the click after the release (button already up): the ring opens on its own.
const released = await page.evaluate(async () =>
{
   window.radialMenu.open(window.token, { clientX: 420, clientY: 330, buttons: 0 });
   await new Promise((r) => setTimeout(r, 150));
   const open = window.radialMenu.isOpen;
   window.radialMenu.close();
   return open;
});
check(released, 'a click reported on release opens the ring');

check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
await browser.close();
server.close();
console.log(failed ? 'Radial preview found problems.' : 'Radial preview passed. Screenshots in tools/out/.');
process.exit(failed ? 1 : 0);
