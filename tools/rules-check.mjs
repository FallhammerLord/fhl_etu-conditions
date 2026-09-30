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
   constructor(name) { Object.assign(this, { id: `i${nextId++}`, name, flags: {} }); }
   getFlag(scope, key) { return this.flags[scope]?.[key]; }
   async setFlag(scope, key, v) { await latency(); (this.flags[scope] ??= {})[key] = v; }
   async unsetFlag(scope, key) { await latency(); delete this.flags[scope]?.[key]; }
}

function mockActor(name, itemNames = [])
{
   const items = itemNames.map((n) => new MockItem(n));
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

console.log(`${passed} checks passed${process.exitCode ? ', some failed' : ''}.`);
