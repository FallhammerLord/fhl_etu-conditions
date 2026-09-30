/**
 * Public API: `game.modules.get('fhl-etu-conditions').api`.
 * Every function takes a flexible `target`: a Token, TokenDocument, Actor, UUID string, or an array of
 * those. Omit it to use the selected tokens.
 *
 * @example
 * const etu = game.modules.get('fhl-etu-conditions').api;
 * await etu.set(undefined, 'temperature', 2);   // selected tokens become Hot
 * await etu.adjust(game.user.targets.first(), 'targetLock', 1);
 * await etu.setHack(token, 'Missile Bay', 3);
 * etu.get(token);  // { temperature: 2, targetLock: 0, jammed: 0, recoil: 0, hacked: [...] }
 */

import { CONDITIONS, TEMPERATURE_STEPS } from './conditions.js';
import { adjustLevel, clearConditions, getConditions, setHack, setLevel } from './store.js';
import { controlledTokens, documentFromUuid } from './compat.js';
import * as rules from './rules.js';

/**
 * @param {*} target - What the caller passed.
 * @returns {Actor[]} Distinct actors (a token's synthetic actor for unlinked tokens).
 */
export function resolveActors(target)
{
   const list = target === undefined || target === null ? controlledTokens() : [target].flat();
   const actors = [];
   for (let entry of list)
   {
      if (typeof entry === 'string') { entry = documentFromUuid(entry); }
      const actor = entry?.documentName === 'Actor' ? entry : entry?.actor ?? entry?.document?.actor;
      if (actor && !actors.some((a) => a.uuid === actor.uuid)) { actors.push(actor); }
   }
   return actors;
}

export const api = {
   CONDITIONS,
   TEMPERATURE_STEPS,
   rules,

   /**
    * @param {*} [target] - Token, TokenDocument, Actor, or UUID; defaults to the first selected token.
    * @returns {object|null} Condition snapshot of the first matching unit.
    */
   get(target)
   {
      const [actor] = resolveActors(target);
      return actor ? getConditions(actor) : null;
   },

   /**
    * @param {*} target - Units to change (undefined = selected tokens).
    * @param {string} key - temperature | targetLock | jammed | recoil.
    * @param {number} level - New level.
    * @returns {Promise<Array<number|null>>} Stored level per unit.
    */
   set(target, key, level)
   {
      return Promise.all(resolveActors(target).map((a) => setLevel(a, key, level)));
   },

   /**
    * @param {*} target - Units to change (undefined = selected tokens).
    * @param {string} key - Condition key.
    * @param {number} delta - Amount to add.
    * @returns {Promise<Array<number|null>>} Stored level per unit.
    */
   adjust(target, key, delta)
   {
      return Promise.all(resolveActors(target).map((a) => adjustLevel(a, key, delta)));
   },

   /**
    * @param {*} target - Units whose system is hacked (undefined = selected tokens).
    * @param {string} itemRef - Item ID or exact name.
    * @param {number} rating - Hack rating; 0 clears it.
    * @returns {Promise<Array<number|null>>} Stored rating per unit.
    */
   setHack(target, itemRef, rating)
   {
      return Promise.all(resolveActors(target).map((a) => setHack(a, itemRef, rating)));
   },

   /**
    * Logs and returns what the module sees for each token, for bug reports.
    *
    * @param {*} [target] - Tokens to inspect (undefined = selected tokens).
    * @returns {object[]} One report per token.
    */
   diagnose(target)
   {
      const tokens = target === undefined ? controlledTokens() : [target].flat().map((t) => t?.object ?? t);
      const reports = tokens.map((token) =>
      {
         const actor = token?.actor;
         const pips = token?.etuPips;
         return {
            token: token?.name,
            actorType: actor?.type,
            linked: token?.document?.actorLink,
            owner: actor?.isOwner,
            conditions: actor ? getConditions(actor) : null,
            effects: actor?.effects.map((e) => ({ name: e.name, statuses: [...(e.statuses ?? [])], disabled: e.disabled })) ?? [],
            pips: pips ? { destroyed: pips.destroyed, visible: pips.visible, worldVisible: pips.worldVisible, onToken: pips.parent === token } : null
         };
      });
      console.log('ETU Conditions | diagnose', reports);
      return reports;
   },

   /**
    * @param {*} target - Units to clear (undefined = selected tokens).
    * @param {string} [key] - One condition key or "hacked"; omit to clear everything.
    * @returns {Promise<void[]>}
    */
   clear(target, key)
   {
      return Promise.all(resolveActors(target).map((a) => clearConditions(a, key)));
   }
};
