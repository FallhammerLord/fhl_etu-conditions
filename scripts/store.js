/**
 * Reading and writing condition levels.
 * Unit conditions: one Active Effect per condition, found by its status ID, level in a flag.
 * Hacked: a rating flag on the system's host item (see items.js for linked pairs).
 * Writes for one actor run one at a time, so fast wheel nudges can't create duplicate effects.
 */

import { MODULE_ID } from './constants.js';
import { CONDITIONS, CONDITION_ORDER, HACKED, clampLevel, conditionLabel } from './conditions.js';
import { canEdit } from './settings.js';
import { showIconNever } from './compat.js';
import { hackOf, hostOf, systemGroup } from './items.js';

/** Per-actor write queues, keyed by actor UUID. */
const queues = new Map();

/**
 * How long one write may wait for the server (ms). A write lost to a dropped connection never
 * answers; without a limit it would hold up every later write for that unit until a reload.
 */
let writeTimeout = 8000;

/** @param {number} ms - Change the write time limit (tests use a short one). */
export function setWriteTimeout(ms)
{
   writeTimeout = ms;
}

/** Forget every pending write, e.g. after the connection comes back. Later writes start fresh. */
export function resetQueues()
{
   queues.clear();
}

class WriteTimeout extends Error {}

/**
 * @param {Promise<*>} promise - A write.
 * @returns {Promise<*>} The write, or a WriteTimeout rejection after the time limit.
 */
function withTimeout(promise)
{
   let timer;
   const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new WriteTimeout()), writeTimeout); });
   return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/**
 * Runs `task` after any earlier write for the same actor has finished (or timed out).
 * A timed-out task resolves to null with a warning, so callers and later writes carry on.
 *
 * @param {Actor} actor - The actor being written.
 * @param {Function} task - Async work.
 * @returns {Promise<*>} The task's result, or null if it timed out.
 */
function enqueue(actor, task)
{
   const key = actor.uuid;
   const previous = queues.get(key) ?? Promise.resolve();
   const next = previous
      .catch(() => {})
      .then(() => withTimeout(Promise.resolve().then(task)))
      .catch((err) =>
      {
         if (!(err instanceof WriteTimeout)) { throw err; }
         ui.notifications.warn(game.i18n.format(`${MODULE_ID}.warn.saveTimeout`, { name: actor.name }));
         return null;
      });
   queues.set(key, next);
   next.finally(() => { if (queues.get(key) === next) { queues.delete(key); } }).catch(() => {});
   return next;
}

/**
 * @param {Actor} actor - The unit.
 * @param {string} key - Condition key.
 * @returns {ActiveEffect[]} Every effect carrying this condition's status (normally zero or one).
 */
function effectsFor(actor, key)
{
   const id = CONDITIONS[key].id;
   return actor.effects.filter((e) => e.statuses?.has(id));
}

/**
 * @param {Actor} actor - The unit.
 * @param {string} key - Condition key.
 * @returns {number} Current level; 0 when absent or disabled.
 */
export function getLevel(actor, key)
{
   const effect = effectsFor(actor, key).find((e) => !e.disabled);
   return effect ? clampLevel(key, effect.getFlag(MODULE_ID, 'level') ?? 0) : 0;
}

/**
 * @param {Actor} actor - The unit.
 * @returns {Array<{ id: string, name: string, rating: number }>} Hacked systems with a rating above 0.
 */
export function getHacked(actor)
{
   const out = [];
   for (const item of actor.items)
   {
      if (!(Number(item.flags?.[MODULE_ID]?.hack) > 0)) { continue; }
      // A linked attack and its artifact are one system: report it once, under the host.
      const host = hostOf(item);
      if (out.some((h) => h.id === host.id)) { continue; }
      out.push({ id: host.id, name: host.name, rating: clampLevel(HACKED.key, hackOf(host)) });
   }
   return out;
}

/**
 * @param {Actor} actor - The unit.
 * @returns {{ temperature: number, targetLock: number, jammed: number, recoil: number, hacked: Array }} Snapshot.
 */
export function getConditions(actor)
{
   const out = {};
   for (const key of CONDITION_ORDER) { out[key] = getLevel(actor, key); }
   out.hacked = getHacked(actor);
   return out;
}

/**
 * Checks that the current user may change `key` on `actor`, warning them if not.
 *
 * @param {Actor} actor - The unit.
 * @param {string} key - Condition key, or "hacked".
 * @returns {boolean} Allowed.
 */
function mayWrite(actor, key)
{
   if (!actor.isOwner)
   {
      ui.notifications.warn(game.i18n.format(`${MODULE_ID}.warn.notOwner`, { name: actor.name }));
      return false;
   }
   if (!canEdit(key))
   {
      ui.notifications.warn(game.i18n.localize(`${MODULE_ID}.warn.gmOnly`));
      return false;
   }
   return true;
}

/**
 * Writes a unit condition. Callers must already hold the actor's queue.
 *
 * @param {Actor} actor - The unit.
 * @param {string} key - Condition key.
 * @param {number} level - New level; clamped to the condition's range.
 * @returns {Promise<number>} The level now stored.
 */
async function writeLevel(actor, key, level)
{
   const value = clampLevel(key, level);
   const [effect, ...extras] = effectsFor(actor, key);
   if (extras.length) { await actor.deleteEmbeddedDocuments('ActiveEffect', extras.map((e) => e.id)); }

   if (value === 0)
   {
      if (effect) { await effect.delete(); }
      return 0;
   }

   const name = conditionLabel(key, value);
   if (effect)
   {
      await effect.update({ name, disabled: false, [`flags.${MODULE_ID}.level`]: value });
   }
   else
   {
      const def = CONDITIONS[key];
      await actor.createEmbeddedDocuments('ActiveEffect', [{
         name,
         img: def.img,
         statuses: [def.id],
         showIcon: showIconNever(),
         flags: { [MODULE_ID]: { level: value } }
      }]);
   }
   return value;
}

/**
 * Sets a unit condition. Level 0 removes the effect.
 *
 * @param {Actor} actor - The unit.
 * @param {string} key - Condition key.
 * @param {number} level - New level; clamped to the condition's range.
 * @returns {Promise<number|null>} The level now stored, or null if refused.
 */
export async function setLevel(actor, key, level)
{
   if (!CONDITIONS[key]) { throw new Error(`${MODULE_ID} | Unknown condition "${key}"`); }
   if (!mayWrite(actor, key)) { return null; }
   return enqueue(actor, () => writeLevel(actor, key, level));
}

/**
 * Changes a unit condition by `delta`. The read and the write happen in one queued step,
 * so back-to-back nudges each build on the previous result.
 *
 * @param {Actor} actor - The unit.
 * @param {string} key - Condition key.
 * @param {number} delta - Amount to add (negative to lower).
 * @returns {Promise<number|null>} The level now stored, or null if refused.
 */
export async function adjustLevel(actor, key, delta)
{
   if (!CONDITIONS[key]) { throw new Error(`${MODULE_ID} | Unknown condition "${key}"`); }
   if (!mayWrite(actor, key)) { return null; }
   return enqueue(actor, () => writeLevel(actor, key, getLevel(actor, key) + delta));
}

/**
 * Sets a system's Hack rating. Rating 0 removes it. The rating is stored on the system's host (a linked
 * artifact, when there is one), so hacking either half of a linked pair hacks both.
 *
 * @param {Actor} actor - The unit that owns the system.
 * @param {string} itemRef - Item ID or exact item name.
 * @param {number} rating - New Hack rating.
 * @returns {Promise<number|null>} The rating now stored, or null if refused or not found.
 */
export async function setHack(actor, itemRef, rating)
{
   const item = actor.items.get(itemRef) ?? actor.items.getName(itemRef);
   if (!item)
   {
      ui.notifications.warn(game.i18n.format(`${MODULE_ID}.warn.noItem`, { item: itemRef, name: actor.name }));
      return null;
   }
   if (!mayWrite(actor, HACKED.key)) { return null; }
   const value = clampLevel(HACKED.key, rating);
   return enqueue(actor, async () =>
   {
      const [host, ...linked] = systemGroup(item);
      if (value === 0) { await host.unsetFlag(MODULE_ID, 'hack'); }
      else { await host.setFlag(MODULE_ID, 'hack', value); }
      // Clear ratings left on linked items from before they were linked.
      for (const other of linked)
      {
         if (other.flags?.[MODULE_ID]?.hack !== undefined) { await other.unsetFlag(MODULE_ID, 'hack'); }
      }
      return value;
   });
}

/**
 * Clears one condition, or every condition including Hacked systems.
 *
 * @param {Actor} actor - The unit.
 * @param {string} [key] - Condition key or "hacked"; omit to clear all.
 * @returns {Promise<void>}
 */
export async function clearConditions(actor, key)
{
   const keys = key ? [key] : [...CONDITION_ORDER, HACKED.key];
   for (const k of keys)
   {
      if (k === HACKED.key)
      {
         for (const h of getHacked(actor)) { await setHack(actor, h.id, 0); }
      }
      else if (getLevel(actor, k) !== 0 || effectsFor(actor, k).length)
      {
         await setLevel(actor, k, 0);
      }
   }
}
