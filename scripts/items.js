/**
 * Which items are a unit's systems (Hard Point, Sensor, Bay), for the Hacked condition.
 *
 * Systems and links: an item linked to an artifact by the Cypher Card Sheet (`linkedArtifact`) is the
 * same system as that artifact. The artifact is the host: it holds the Hack rating, and the mount is
 * read from the whole linked group, host first.
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

/** Item types that can be mounted systems, and so get the Mount setting on their sheet. */
export const MOUNTABLE_TYPES = new Set(['attack', 'artifact', 'equipment', 'armor']);

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
      const value = i.flags?.[MODULE_ID]?.mount;
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

/** @returns {string|null} The item's mount, or null if it isn't a system. */
export function mountOf(item)
{
   if (!MOUNTABLE_TYPES.has(hostOf(item)?.type)) { return null; }
   return mountInfo(item).mount;
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {number} Hack rating of the system (stored on the host).
 */
export function hackOf(item)
{
   let rating = 0;
   // Read the whole group so a rating stored before items were linked still counts.
   for (const i of systemGroup(item)) { rating = Math.max(rating, Number(i.flags?.[MODULE_ID]?.hack ?? 0) || 0); }
   return rating;
}

/**
 * @param {string} img - An item image path.
 * @returns {boolean} Whether it's a placeholder: Foundry's item bag or the Cypher System's type icon.
 */
function isDefaultArt(img)
{
   return !img || img === 'icons/svg/item-bag.svg' || img.startsWith('systems/cyphersystem/icons/items/');
}

/**
 * @param {Item} item - Any item on an actor.
 * @returns {string|null} The system's own card art (host first, then linked items), or null if it only
 *   has placeholder images.
 */
export function artOf(item)
{
   for (const i of systemGroup(item)) { if (!isDefaultArt(i.img)) { return i.img; } }
   return null;
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
      // Tag items named "Hard Point" are labels, not systems.
      if (hosts.includes(host) || !MOUNTABLE_TYPES.has(host.type)) { continue; }
      if (mountOf(host) || hackOf(host) > 0) { hosts.push(host); }
   }
   return hosts;
}
