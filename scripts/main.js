/**
 * ETU Conditions entry point: settings, status registration, API, the radial menu on right-click,
 * and the hooks that keep pips and the open menu in step with changes.
 */

import { MODULE_ID } from './constants.js';
import { registerSettings } from './settings.js';
import { registerStatusEffects } from './conditions.js';
import { api } from './api.js';
import { drawPips, positionPips, redrawAllPips, repositionAllPips } from './pips.js';
import { radialMenu } from './radial.js';
import { activeTokens, installTokenRightClick } from './compat.js';

Hooks.once('init', () =>
{
   registerSettings({ onPipsChange: redrawAllPips });
   registerStatusEffects();
   installTokenRightClick((token, event) => radialMenu.open(token, event));
   game.modules.get(MODULE_ID).api = api;
});

Hooks.on('drawToken', (token) => drawPips(token));
Hooks.on('refreshToken', (token) =>
{
   positionPips(token);
   if (token === radialMenu.token) { radialMenu.reposition(); }
});
Hooks.on('canvasPan', () =>
{
   repositionAllPips();
   radialMenu.reposition();
});
Hooks.on('canvasTearDown', () => radialMenu.close());
Hooks.on('deleteToken', (tokenDoc) => { if (tokenDoc.object === radialMenu.token) { radialMenu.close(); } });

// Labels in the Token ring (Target, Join combat) follow these.
for (const hook of ['targetToken', 'createCombatant', 'deleteCombatant'])
{
   Hooks.on(hook, () => radialMenu.refresh());
}

/**
 * @param {foundry.abstract.Document} doc - An ActiveEffect or Item.
 * @returns {Actor|null} The actor it belongs to, if it is embedded in one.
 */
function owningActor(doc)
{
   const parent = doc?.parent;
   return parent?.documentName === 'Actor' ? parent : null;
}

for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect', 'createItem', 'updateItem', 'deleteItem'])
{
   Hooks.on(hook, (doc) =>
   {
      const actor = owningActor(doc);
      if (actor) { conditionsChanged(activeTokens(actor)); }
   });
}

// Unlinked tokens keep their actor changes in the token's ActorDelta. Redraw from those updates too,
// in case the hooks above fire before the token's synthetic actor has caught up.
for (const hook of ['createActorDelta', 'updateActorDelta'])
{
   Hooks.on(hook, (delta) => conditionsChanged([delta.parent?.object]));
}
Hooks.on('updateToken', (tokenDoc, change) =>
{
   if (change?.delta) { conditionsChanged([tokenDoc.object]); }
   if (change && 'hidden' in change) { radialMenu.refresh(); }
});

/**
 * Redraws pips and the open menu for these tokens on the next tick, after Foundry has finished
 * applying the change (synthetic actors update a moment after their effect hooks fire).
 *
 * @param {Array<Token|undefined>} tokens - Tokens whose conditions may have changed.
 */
function conditionsChanged(tokens)
{
   const list = tokens.filter(Boolean);
   if (!list.length) { return; }
   setTimeout(() =>
   {
      for (const token of list)
      {
         if (token.destroyed) { continue; }
         drawPips(token);
         if (token === radialMenu.token) { radialMenu.refresh(); }
      }
   }, 0);
}
