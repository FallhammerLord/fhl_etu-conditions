/**
 * Tests the pure rules math and the condition store (against an in-memory actor with simulated
 * server latency). Usage: npm run rules
 */
import assert from 'node:assert/strict';
import { hooks, settings, warnings } from './foundry-mock.mjs';

const rules = await import('../scripts/rules.js');
const { clampLevel } = await import('../scripts/conditions.js');
await import('../scripts/main.js');
for (const fn of hooks.get('init') ?? []) { fn(); }
const store = await import('../scripts/store.js');

let passed = 0;
async function test(name, fn)
{
   try { await fn(); passed++; }
   catch (err) { console.error(`FAIL ${name}\n  ${err.message}`); process.exitCode = 1; }
}

// ---- Rules -------------------------------------------------------------------

await test('temperature cost per Effort', () =>
{
   const t = rules.temperatureCostPerEffort;
   assert.equal(t(0, 'reactor'), 0);
   assert.equal(t(1, 'reactor'), 0);
   assert.equal(t(-1, 'reactor'), 0);
   assert.equal(t(2, 'reactor'), 1);
   assert.equal(t(2, 'frame'), 0);
   assert.equal(t(-2, 'reactor'), 1);
   assert.equal(t(3, 'reactor'), 3);
   assert.equal(t(3, 'frame'), 3);
   assert.equal(t(3, 'strain'), 0);
   assert.equal(t(-3, 'strain'), 3);
   assert.equal(t(-3, 'frame'), 0);
});

await test('Target Lock against Jammed', () =>
{
   assert.equal(rules.signalSteps(0, 0), 0);
   assert.equal(rules.signalSteps(4, 0), 4);
   assert.equal(rules.signalSteps(5, 3), 2);
   assert.equal(rules.signalSteps(3, 3), -3, 'equal lock is overridden by the full jam');
   assert.equal(rules.signalSteps(2, 3), -3);
   assert.equal(rules.signalSteps(0, 3), -3);
   assert.equal(rules.signalSteps(4, 3), 1, 'one point past the jam flips to easing');
});

await test('signal through jam', () =>
{
   assert.deepEqual(rules.signalThroughJam(4, 'electromagnetic', 0), { works: true, effective: 4 });
   assert.deepEqual(rules.signalThroughJam(4, 'electromagnetic', 4), { works: false, effective: 0 });
   assert.deepEqual(rules.signalThroughJam(4, 'electromagnetic', 3), { works: true, effective: 1 });
   assert.deepEqual(rules.signalThroughJam(4, 'liminal', 5), { works: true, effective: 1 });
   assert.deepEqual(rules.signalThroughJam(4, 'etheric', 8), { works: false, effective: 0 });
});

await test('recoil takes the highest rating', () =>
{
   assert.equal(rules.combinedRecoil([]), 0);
   assert.equal(rules.combinedRecoil([2, 6, 4]), 6);
});

await test('Drain and Deep Well', () =>
{
   assert.equal(rules.deepWellThreshold(0), null);
   assert.equal(rules.deepWellThreshold(1), 0.9);
   assert.ok(Math.abs(rules.deepWellThreshold(2) - 0.8) < 1e-9);
   assert.equal(rules.drainCost(3, 20, 20), 3, 'no Deep Well: full Drain');
   assert.equal(rules.drainCost(3, 20, 20, 1), 2, 'above 90%: one less');
   assert.equal(rules.drainCost(3, 18, 20, 1), 3, 'exactly 90% is not above it');
   assert.equal(rules.drainCost(3, 17, 20, 2), 2, 'two picks widen to 80%');
   assert.equal(rules.drainCost(1, 20, 20, 1), 0);
   assert.equal(rules.drainCost(0, 20, 20, 1), 0, 'never negative');
});

await test('levels clamp to each condition range', () =>
{
   assert.equal(clampLevel('temperature', 9), 3);
   assert.equal(clampLevel('temperature', -9), -3);
   assert.equal(clampLevel('targetLock', 11), 10);
   assert.equal(clampLevel('jammed', -1), 0);
   assert.equal(clampLevel('recoil', '4'), 4);
   assert.equal(clampLevel('hacked', 2.7), 2);
});

// ---- Store, against an in-memory actor ---------------------------------------------

const MOD = 'fhl-etu-conditions';
const latency = () => new Promise((r) => setTimeout(r, 5 + Math.random() * 10));
let nextId = 1;

function setPath(obj, path, value)
{
   const parts = path.split('.');
   let o = obj;
   for (const p of parts.slice(0, -1)) { o = o[p] ??= {}; }
   o[parts.at(-1)] = value;
}

class MockEffect
{
   constructor(actor, data)
   {
      Object.assign(this, { id: `e${nextId++}`, disabled: false, flags: {} }, structuredClone(data));
      this.statuses = new Set(data.statuses ?? []);
      this.parent = actor;
   }
   getFlag(scope, key) { return this.flags[scope]?.[key]; }
   async update(data)
   {
      await latency();
      for (const [k, v] of Object.entries(data)) { setPath(this, k, v); }
   }
   async delete()
   {
      await latency();
      this.parent.effects = this.parent.effects.filter((e) => e !== this);
   }
}

class MockItem
{
   /** @param {string|object} spec - A name, or { name, type, flags, system, id }. */
   constructor(spec)
   {
      const s = typeof spec === 'string' ? { name: spec } : spec;
      Object.assign(this, { id: s.id ?? `i${nextId++}`, name: s.name, type: s.type ?? 'equipment', flags: structuredClone(s.flags ?? {}), system: s.system ?? {} });
   }
   getFlag(scope, key) { return this.flags[scope]?.[key]; }
   async setFlag(scope, key, v) { await latency(); (this.flags[scope] ??= {})[key] = v; }
   async unsetFlag(scope, key) { await latency(); delete this.flags[scope]?.[key]; }
}

function mockActor(name, itemSpecs = [])
{
   const items = itemSpecs.map((n) => new MockItem(n));
   items.get = (id) => items.find((i) => i.id === id);
   items.getName = (n) => items.find((i) => i.name === n);
   const actor = {
      name, uuid: `Actor.${name}`, documentName: 'Actor', isOwner: true, effects: [], items,
      async createEmbeddedDocuments(_type, list)
      {
         await latency();
         const made = list.map((d) => new MockEffect(actor, d));
         actor.effects.push(...made);
         return made;
      },
      async deleteEmbeddedDocuments(_type, ids)
      {
         await latency();
         actor.effects = actor.effects.filter((e) => !ids.includes(e.id));
      }
   };
   for (const item of items) { item.parent = actor; }
   return actor;
}

await test('set, update, and remove a condition', async () =>
{
   const a = mockActor('A');
   assert.equal(await store.setLevel(a, 'targetLock', 4), 4);
   assert.equal(a.effects.length, 1);
   assert.ok(a.effects[0].statuses.has('etu-target-lock'));
   assert.equal(a.effects[0].showIcon, 0);
   assert.equal(store.getLevel(a, 'targetLock'), 4);
   await store.setLevel(a, 'targetLock', 7);
   assert.equal(a.effects.length, 1, 'updates in place');
   assert.equal(store.getLevel(a, 'targetLock'), 7);
   await store.setLevel(a, 'targetLock', 0);
   assert.equal(a.effects.length, 0, 'level 0 removes the effect');
});

await test('temperature stores negative levels and names the step', async () =>
{
   const a = mockActor('B');
   await store.setLevel(a, 'temperature', -3);
   assert.equal(store.getLevel(a, 'temperature'), -3);
   assert.equal(a.effects[0].name, `${MOD}.temperature.freezing`);
});

await test('rapid nudges neither lose updates nor duplicate effects', async () =>
{
   const a = mockActor('C');
   await Promise.all(Array.from({ length: 6 }, () => store.adjustLevel(a, 'jammed', 1)));
   assert.equal(a.effects.length, 1);
   assert.equal(store.getLevel(a, 'jammed'), 6);
   await Promise.all([store.adjustLevel(a, 'jammed', -2), store.adjustLevel(a, 'jammed', -2), store.setLevel(a, 'recoil', 4)]);
   assert.equal(store.getLevel(a, 'jammed'), 2);
   assert.equal(store.getLevel(a, 'recoil'), 4);
   assert.equal(a.effects.length, 2);
});

await test('duplicate effects from another client are cleaned up', async () =>
{
   const a = mockActor('D');
   await a.createEmbeddedDocuments('ActiveEffect', [
      { name: 'x', statuses: ['etu-recoil'], flags: { [MOD]: { level: 2 } } },
      { name: 'y', statuses: ['etu-recoil'], flags: { [MOD]: { level: 5 } } }
   ]);
   await store.setLevel(a, 'recoil', 3);
   assert.equal(a.effects.length, 1);
   assert.equal(store.getLevel(a, 'recoil'), 3);
});

await test('hack ratings live on items', async () =>
{
   const a = mockActor('E', ['Hard Point A', 'Missile Bay']);
   assert.equal(await store.setHack(a, 'Missile Bay', 3), 3);
   assert.deepEqual(store.getHacked(a).map((h) => [h.name, h.rating]), [['Missile Bay', 3]]);
   assert.equal(await store.setHack(a, 'Nope', 3), null, 'unknown system is refused');
   await store.setHack(a, a.items[1].id, 0);
   assert.equal(store.getHacked(a).length, 0);
});

// ---- Item systems: mounts, links, Recoil ---------------------------------------------------

const items = await import('../scripts/items.js');
const CS = 'cypher-card-sheet';

/** A unit with Cypher tags, a Card Sheet linked pair, and plain gear. */
function etuUnit(name)
{
   return mockActor(name, [
      { id: 'tagHP', name: 'Hard Point', type: 'tag' },
      { id: 'tagSNS', name: 'Sensors', type: 'tag' },
      { id: 'rail', name: 'Rail Cannon', type: 'attack', system: { basic: { type: 'medium weapon' } }, flags: { cyphersystem: { tags: ['tagHP'] } } },
      { id: 'knife', name: 'Combat Knife', type: 'attack', system: { basic: { type: 'light weapon' } } },
      { id: 'hailArt', name: 'Silver Hail', type: 'artifact', flags: { cyphersystem: { tags: ['tagHP'] } } },
      { id: 'hailAtk', name: 'Silver Hail', type: 'attack', system: { basic: { type: 'heavy weapon' } }, flags: { [CS]: { linkedArtifact: 'hailArt' } } },
      { id: 'suite', name: 'Sensor Suite', type: 'equipment' },
      { id: 'bay', name: 'Missile Bay', type: 'equipment', flags: { [MOD]: { signalRole: 'reliant', signalLevel: 5 } } },
      { id: 'cloak', name: 'Cloak Field', type: 'equipment', flags: { [MOD]: { mount: 'none' } } },
      { id: 'flare', name: 'Flare Pod', type: 'equipment', flags: { [MOD]: { mount: 'bay', drainPool: 'reactor', drainAmount: 2 } } }
   ]);
}
const byId = (a, id) => a.items.get(id);

await test('mount comes from flag, then Cypher tag, then name', () =>
{
   const a = etuUnit('M');
   assert.deepEqual(items.mountInfo(byId(a, 'rail')), { mount: 'hardpoint', source: 'tag' });
   assert.deepEqual(items.mountInfo(byId(a, 'suite')), { mount: 'sensor', source: 'name' });
   assert.deepEqual(items.mountInfo(byId(a, 'bay')), { mount: 'bay', source: 'name' });
   assert.deepEqual(items.mountInfo(byId(a, 'flare')), { mount: 'bay', source: 'flag' });
   assert.deepEqual(items.mountInfo(byId(a, 'cloak')), { mount: null, source: 'flag' }, '"Not a system" overrides');
   assert.equal(items.mountOf(byId(a, 'knife')), null);
   assert.deepEqual(items.mountInfo(byId(a, 'flare'), { useFlag: false }), { mount: null, source: 'none' }, 'auto preview ignores the manual setting');
});

await test('a Card Sheet linked attack is the same system as its artifact', () =>
{
   const a = etuUnit('L');
   assert.equal(items.hostOf(byId(a, 'hailAtk')), byId(a, 'hailArt'));
   assert.equal(items.hostOf(byId(a, 'hailArt')), byId(a, 'hailArt'));
   assert.deepEqual(items.systemGroup(byId(a, 'hailArt')).map((i) => i.id), ['hailArt', 'hailAtk']);
   assert.equal(items.mountOf(byId(a, 'hailAtk')), 'hardpoint', 'the attack inherits the artifact\'s tag');
   const names = items.unitSystems(a).map((i) => i.id);
   assert.deepEqual(names, ['rail', 'hailArt', 'suite', 'bay', 'flare'], 'one entry per system; knife and cloak excluded');
});

await test('Recoil: set value, else weapon size on Hard Points, else none', async () =>
{
   const a = etuUnit('R');
   assert.deepEqual(items.recoilInfo(byId(a, 'rail')), { rating: 4, source: 'size' });
   assert.deepEqual(items.recoilInfo(byId(a, 'hailArt')), { rating: 6, source: 'size' }, 'artifact takes the linked attack\'s size');
   assert.deepEqual(items.recoilInfo(byId(a, 'knife')), { rating: 0, source: 'none' }, 'not a Hard Point');
   byId(a, 'rail').flags[MOD] = { recoil: 8 };
   assert.deepEqual(items.recoilInfo(byId(a, 'rail')), { rating: 8, source: 'flag' }, 'Capital override');
   assert.deepEqual(items.recoilInfo(byId(a, 'rail'), { useFlag: false }), { rating: 4, source: 'size' });
   byId(a, 'rail').flags[MOD] = { recoil: null };
   assert.equal(items.recoilInfo(byId(a, 'rail')).rating, 4, 'blank field means auto');
});

await test('Signal and Drain read from the system', () =>
{
   const a = etuUnit('S');
   assert.deepEqual(items.signalOf(byId(a, 'bay')), { role: 'reliant', type: 'electromagnetic', level: 5 });
   assert.deepEqual(items.signalOf(byId(a, 'rail')), { role: 'none', type: 'electromagnetic', level: null });
   assert.deepEqual(items.drainOf(byId(a, 'flare')), { pool: 'reactor', amount: 2 });
   assert.equal(items.drainOf(byId(a, 'rail')), null);
});

await test('hacking either half of a linked pair hacks both, counted once', async () =>
{
   const a = etuUnit('H');
   assert.equal(await store.setHack(a, 'hailAtk', 3), 3);
   assert.equal(byId(a, 'hailArt').flags[MOD].hack, 3, 'stored on the artifact');
   assert.equal(items.hackOf(byId(a, 'hailAtk')), 3);
   assert.deepEqual(store.getHacked(a).map((h) => [h.id, h.rating]), [['hailArt', 3]]);
   // A rating left on the attack from before it was linked is cleared on the next write.
   byId(a, 'hailAtk').flags[MOD] = { hack: 5 };
   assert.equal(items.hackOf(byId(a, 'hailArt')), 5, 'old rating still counts until rewritten');
   assert.equal(store.getHacked(a).length, 1);
   await store.setHack(a, 'hailArt', 0);
   assert.equal(items.hackOf(byId(a, 'hailAtk')), 0);
   assert.equal(store.getHacked(a).length, 0);
});

await test('item sheet section renders per type and defers linked items to the artifact', async () =>
{
   const { etuFieldsHtml } = await import('../scripts/item-sheet.js');
   const a = etuUnit('I');
   const rail = etuFieldsHtml(byId(a, 'rail'), true);
   assert.ok(rail.includes('name="flags.fhl-etu-conditions.mount"'));
   assert.ok(rail.includes('name="flags.fhl-etu-conditions.recoil"'));
   assert.ok(rail.includes('sheet.recoilAuto'), 'shows the automatic Recoil as the placeholder');
   assert.ok(!rail.includes('signalType'), 'signal type appears only once a role is chosen');
   const bay = etuFieldsHtml(byId(a, 'bay'), false);
   assert.ok(bay.includes('signalType') && bay.includes(' disabled'), 'read-only sheet disables inputs');
   const linked = etuFieldsHtml(byId(a, 'hailAtk'), true);
   assert.ok(linked.includes('sheet.linkedNote') && !linked.includes('<select'), 'linked attack shows a note only');
   assert.equal(etuFieldsHtml(new MockItem({ name: 'x', type: 'skill' }), true), '', 'skills get no section');
});

await test('clear removes everything', async () =>
{
   const a = mockActor('F', ['Sensor Suite']);
   await store.setLevel(a, 'temperature', 2);
   await store.setLevel(a, 'targetLock', 5);
   await store.setHack(a, 'Sensor Suite', 4);
   await store.clearConditions(a);
   assert.equal(a.effects.length, 0);
   assert.equal(store.getHacked(a).length, 0);
   assert.deepEqual(store.getConditions(a), { temperature: 0, targetLock: 0, jammed: 0, recoil: 0, hacked: [] });
});

await test('player permissions follow the settings', async () =>
{
   const a = mockActor('G');
   game.user.isGM = false;
   warnings.length = 0;
   assert.equal(await store.setLevel(a, 'temperature', 1), 1, 'Temperature allowed by default');
   assert.equal(await store.setLevel(a, 'targetLock', 1), null, 'Target Lock is GM-only by default');
   assert.equal(warnings.length, 1);
   settings.set(`${MOD}.playerEdit.targetLock`, true);
   assert.equal(await store.setLevel(a, 'targetLock', 1), 1);
   a.isOwner = false;
   assert.equal(await store.setLevel(a, 'temperature', 2), null, 'non-owners are refused');
   game.user.isGM = true;
});

// ---- Right-click routing and strings ----------------------------------------------------

await test('right-click opens the menu; Shift or a refusal falls through to Foundry', async () =>
{
   const { radialMenu } = await import('../scripts/radial.js');
   const opened = [];
   const realOpen = radialMenu.open;
   radialMenu.open = (token) => { opened.push(token); return token.menuOk; };
   try
   {
      const Token = CONFIG.Token.objectClass;
      const a = Object.assign(new Token(), { menuOk: true });
      let stopped = 0;
      a._onClickRight({ shiftKey: false, buttons: 2, stopPropagation: () => stopped++ });
      assert.equal(opened.length, 1);
      assert.equal(a.coreRightClick, undefined, 'menu handled it; core HUD not called');
      assert.equal(stopped, 1, 'a handled right-click stops at the token, like core, so the canvas does not start panning');
      a._onClickRight({ shiftKey: false, buttons: 3, stopPropagation: () => {} });
      assert.equal(opened.length, 1, 'right-click during a left drag goes to Foundry');
      assert.equal(a.coreRightClick, 1);
      a.coreRightClick = undefined;
      a._onClickRight({ shiftKey: true });
      assert.equal(opened.length, 1, 'Shift skips the menu');
      assert.equal(a.coreRightClick, 1, 'Shift reaches the core HUD');
      const b = Object.assign(new Token(), { menuOk: false });
      b._onClickRight({ shiftKey: false });
      assert.equal(b.coreRightClick, 1, 'a refused open (e.g. not owner) falls through');
   }
   finally { radialMenu.open = realOpen; }
});

await test('every literal string key used in scripts exists in en.json', async () =>
{
   const { readFile, readdir } = await import('node:fs/promises');
   const lang = JSON.parse(await readFile(new URL('../lang/en.json', import.meta.url), 'utf8'))[MOD];
   const has = (key) => key.split('.').reduce((o, k) => o?.[k], lang) !== undefined;
   const dir = new URL('../scripts/', import.meta.url);
   const missing = [];
   for (const file of await readdir(dir))
   {
      const src = await readFile(new URL(file, dir), 'utf8');
      const keys = [
         ...[...src.matchAll(/\btf?\('([\w.]+)'/g)].map((m) => m[1]),
         ...[...src.matchAll(/(?<!flags\.)\$\{MODULE_ID\}\.([\w.]+)[`']/g)].map((m) => m[1])
      ];
      for (const key of keys) { if (!has(key)) { missing.push(`${file}: ${key}`); } }
   }
   // Keys built from a variable, checked by expanding them here.
   for (const k of ['temperature', 'targetLock', 'jammed', 'recoil', 'hacked']) { if (!has(`condition.${k}`)) { missing.push(`condition.${k}`); } }
   for (const k of ['freezing', 'cold', 'chill', 'normal', 'warm', 'hot', 'overheating'])
   {
      if (!has(`temperature.${k}`)) { missing.push(`temperature.${k}`); }
      if (!has(`note.temperature.${k}`)) { missing.push(`note.temperature.${k}`); }
   }
   for (const k of ['targetLock', 'jammed', 'recoil'])
   {
      for (const key of [`none.${k}`, `note.${k}`, `note.${k}Off`, `settings.playerEdit.${k}.name`]) { if (!has(key)) { missing.push(key); } }
   }
   assert.deepEqual(missing, []);
});

console.log(`${passed} checks passed${process.exitCode ? ', some failed' : ''}.`);
