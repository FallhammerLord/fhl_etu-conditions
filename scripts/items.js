/**
 * What an item is, as an ETU system: its mount (Hard Point, Sensor, Bay), Recoil, Signal, and Drain.
 *
 * Systems and links: an item linked to an artifact by the Cypher Card Sheet (`linkedArtifact`) is the
 * same system as that artifact. The artifact is the host: it holds the Hack rating, and every value
 * below is read from the whole linked group, host first.
 *
 * Mount comes from, in order: this module's item flag, a Cypher System tag named "Hard Point",
 * "Sensor", or "Bay" (matched by name; tags are per-actor items), then the item's own name.
 * This module only reads Cypher tags; it never toggles them.
 */

import { MODULE_ID } from './constants.js';

/** Cypher Card Sheet module ID and its link flag (optional; ignored when absent). */
const CARD_SHEET_ID = 'cypher-card-sheet';

export const MOUNTS = ['hardpoint', 'sensor', 'bay'];

const MOUNT_PATTERNS = {
   hardpoint: /\bhard\s*-?\s*points?\b/i,
   sensor: /\bsensors?\b/i,
   bay: /\bbays?\b/i
};

/** Default Recoil by the Cypher attack's weapon size. Capital has no core size: set it per weapon. */
const RECOIL_BY_WEAPON_TYPE = { 'light weapon': 2, 'medium weapon': 4, 'heavy weapon': 6 };

/** Item types that get the ETU section on their sheet, and which rows each shows. */
export const ETU_ITEM_TYPES = {
   attack:    { mount: true, recoil: true, signal: true, drain: true },
   artifact:  { mount: true, recoil: true, signal: true, drain: true },
   equipment: { mount: true, recoil: false, signal: true, drain: true },
   armor:     { mount: true, recoil: false, signal: false, drain: false },
   cypher:    { mount: false, recoil: false, signal: true, drain: true },
   ability:   { mount: false, recoil: false, signal: true, drain: true },
   oddity:    { mount: false, recoil: false, signal: true, drain: false }
};

/**
 * @param {Item} item - Any item.
 * @param {string} key - Flag key in this module's scope.
 * @returns {*} The flag value, or undefined.
 */
function flag(item, key)
{
   return item?.flags?.[MODULE_ID]?.[key];
}

/** @returns {boolean} A value the user actually set (not blank, not null). */
function isSet(value)
{
   return value !== undefined && value !== null && value !== '';
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {Item} The system's host: the linked artifact if there is one, else the item itself.
 */
export function hostOf(item)
{
   const linked = item?.flags?.[CARD_SHEET_ID]?.linkedArtifact;
   if (linked && item.type !== 'artifact')
   {
      const artifact = item.parent?.items?.get?.(linked);
      if (artifact) { return artifact; }
   }
   return item;
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {Item[]} Every item that is this same system: the host first, then items linked to it.
 */
export function systemGroup(item)
{
   const host = hostOf(item);
   const others = host.parent?.items ? [...host.parent.items].filter((i) => i !== host && hostOf(i) === host) : [];
   return [host, ...others];
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {string[]} Names of the Cypher System tags this item carries.
 */
export function cypherTagNames(item)
{
   const ids = item?.flags?.cyphersystem?.tags;
   if (!Array.isArray(ids)) { return []; }
   return ids.map((id) => item.parent?.items?.get?.(id)?.name).filter(Boolean);
}

/**
 * @param {string} text - A tag or item name.
 * @returns {string|null} The mount it names, if any.
 */
function mountFromText(text)
{
   for (const mount of MOUNTS) { if (MOUNT_PATTERNS[mount].test(text ?? '')) { return mount; } }
   return null;
}

/**
 * @param {Item} item - Any item on an actor.
 * @param {object} [options]
 * @param {boolean} [options.useFlag=true] - False to see what would be detected without a manual setting.
 * @returns {{ mount: string|null, source: string }} The system's mount and where it came from
 *   ("flag", "tag", "name", or "none").
 */
export function mountInfo(item, { useFlag = true } = {})
{
   const group = systemGroup(item);
   for (const i of useFlag ? group : [])
   {
      const value = flag(i, 'mount');
      if (value === 'none') { return { mount: null, source: 'flag' }; }
      if (MOUNTS.includes(value)) { return { mount: value, source: 'flag' }; }
   }
   for (const i of group)
   {
      for (const name of cypherTagNames(i))
      {
         const mount = mountFromText(name);
         if (mount) { return { mount, source: 'tag' }; }
      }
   }
   for (const i of group)
   {
      const mount = mountFromText(i.name);
      if (mount) { return { mount, source: 'name' }; }
   }
   return { mount: null, source: 'none' };
}

/** @returns {string|null} Shortcut for mountInfo(item).mount. */
export function mountOf(item)
{
   if (!ETU_ITEM_TYPES[hostOf(item)?.type]?.mount) { return null; }
   return mountInfo(item).mount;
}

/**
 * @param {Item} item - Any item on an actor.
 * @param {object} [options]
 * @param {boolean} [options.useFlag=true] - False to see the automatic value without a manual setting.
 * @returns {{ rating: number, source: string }} Recoil rating: a number set on the system ("flag"),
 *   else the attack's weapon size when the system is a Hard Point ("size"), else 0 ("none").
 */
export function recoilInfo(item, { useFlag = true } = {})
{
   const group = systemGroup(item);
   for (const i of useFlag ? group : [])
   {
      const value = flag(i, 'recoil');
      if (isSet(value) && Number.isFinite(Number(value))) { return { rating: Math.max(0, Math.trunc(Number(value))), source: 'flag' }; }
   }
   if (mountOf(item) === 'hardpoint')
   {
      for (const i of group)
      {
         const size = RECOIL_BY_WEAPON_TYPE[i.type === 'attack' ? i.system?.basic?.type : ''];
         if (size) { return { rating: size, source: 'size' }; }
      }
   }
   return { rating: 0, source: 'none' };
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {{ role: string, type: string, level: number|null }} Signal profile of the system.
 *   Role: none | source | reliant. Level null means "roll or read the item card".
 */
export function signalOf(item)
{
   for (const i of systemGroup(item))
   {
      const role = flag(i, 'signalRole');
      if (role === 'source' || role === 'reliant')
      {
         const level = flag(i, 'signalLevel');
         return {
            role,
            type: flag(i, 'signalType') || 'electromagnetic',
            level: isSet(level) && Number.isFinite(Number(level)) ? Number(level) : null
         };
      }
   }
   return { role: 'none', type: 'electromagnetic', level: null };
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {{ pool: string, amount: number }|null} Drain, if the feature has it.
 */
export function drainOf(item)
{
   for (const i of systemGroup(item))
   {
      const pool = flag(i, 'drainPool');
      const amount = Number(flag(i, 'drainAmount'));
      if (['frame', 'reactor', 'strain'].includes(pool) && amount > 0) { return { pool, amount: Math.trunc(amount) }; }
   }
   return null;
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {number} Hack rating of the system (stored on the host).
 */
export function hackOf(item)
{
   let rating = 0;
   // Read the whole group so a rating stored before items were linked still counts.
   for (const i of systemGroup(item)) { rating = Math.max(rating, Number(flag(i, 'hack') ?? 0) || 0); }
   return rating;
}

/**
 * @param {Actor} actor - The unit.
 * @returns {Item[]} One host per mounted or hacked system, in sheet order.
 */
export function unitSystems(actor)
{
   const hosts = [];
   for (const item of actor?.items ?? [])
   {
      const host = hostOf(item);
      // Only weapons and gear can be mounted systems; tag items named "Hard Point" are labels, not systems.
      if (hosts.includes(host) || !ETU_ITEM_TYPES[host.type]?.mount) { continue; }
      if (mountOf(host) || hackOf(host) > 0) { hosts.push(host); }
   }
   return hosts;
}
