/**
 * Checks the ring's and pips' text against what it sits on, in both palettes, for WCAG AA (4.5:1).
 * Theme colours come from styles/etu.css (`:root` and `.etu-radial.etu-hc`); condition colours from
 * PALETTES in scripts/conditions.js. Exits non-zero on any failure. Usage: npm run contrast
 */
import { readFileSync } from 'node:fs';
import './foundry-mock.mjs';

const { PALETTES } = await import('../scripts/conditions.js');
const MIN = 4.5;

const css = readFileSync(new URL('../styles/etu.css', import.meta.url), 'utf8');
const tokensIn = (selector) =>
{
   const start = css.indexOf(`${selector} {`);
   const body = css.slice(start, css.indexOf('}', start));
   return Object.fromEntries([...body.matchAll(/--etu-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, k, v]) => [k, v]));
};

const { LABEL, SURFACE, WITHIN_MIX, contrastRatio: ratio, mix, readableOn } = await import('../scripts/color.js');

const suites = [
   { name: 'standard', key: 'standard', tokens: tokensIn(':root'), palette: PALETTES.standard, pipSolid: false },
   { name: 'high contrast', key: 'contrast', tokens: { ...tokensIn(':root'), ...tokensIn('.etu-radial.etu-hc') }, palette: PALETTES.contrast, pipSolid: true }
];

let failures = 0;
for (const suite of suites)
{
   const t = suite.tokens;
   // The ring computes filled cells in JS; its surface and label colours must match the CSS tokens.
   const expect = { slice: SURFACE[suite.key], fg: LABEL[suite.key].light, bg: LABEL[suite.key].dark };
   for (const [token, value] of Object.entries(expect))
   {
      if (t[token]?.toLowerCase() !== value) { failures++; console.log(`  FAIL ${suite.name}: --etu-${token} is ${t[token]}, color.js says ${value}`); }
   }
   const p = suite.palette;
   const conditionColors = [
      ['Target Lock', p.targetLock], ['Jammed', p.jammed], ['Recoil', p.recoil], ['Hacked', p.hacked],
      ...Object.entries(p.temperature).filter(([v]) => Number(v) !== 0).map(([v, c]) => [`Temperature ${v}`, c])
   ];
   const pairs = [
      ['labels on wedges', t.fg, t.slice],
      ['labels on hovered wedges', t.fg, t['slice-hot']],
      ['muted text on wedges', t.muted, t.slice],
      ['badges on wedges', t.accent, t.slice],
      ['breadcrumb', t.accent, t.bg],
      ['readout note', t.muted, t.bg],
      // Card Sheet overlay: the HACKED stamp is Hacked-coloured text on the card's dark shade.
      ['Hacked card stamp', p.hacked, '#151b25']
   ];
   for (const [name, color] of conditionColors)
   {
      pairs.push([`${name} value on wedge`, color, t.slice]);
      pairs.push([`${name} pip`, ...(suite.pipSolid ? ['#0b0e12', color] : [color, '#0e1318'])]);
      // Filled gauge cells get whichever label colour reads better, as the ring picks it.
      const active = color;
      const within = mix(color, SURFACE[suite.key], WITHIN_MIX[suite.key]);
      pairs.push([`${name} active cell label`, readableOn(active, LABEL[suite.key]), active]);
      pairs.push([`${name} within cell label`, readableOn(within, LABEL[suite.key]), within]);
   }

   const results = pairs.map(([what, ink, surface]) => ({ what, ink, surface, r: ratio(ink, surface) }));
   const bad = results.filter((x) => x.r < MIN);
   const worst = results.reduce((a, b) => (a.r < b.r ? a : b));
   failures += bad.length;
   console.log(`${suite.name}: ${results.length} pairs, worst ${worst.r.toFixed(2)} (${worst.what})`);
   for (const x of bad) { console.log(`  FAIL ${x.r.toFixed(2)} ${x.what}: ${x.ink} on ${x.surface}`); }
}

process.exit(failures ? 1 : 0);
