/**
 * ETU Conditions entry point: settings, status registration, API, the radial menu on right-click,
 * and the hooks that keep pips and the open menu in step with changes.
 */

import { MODULE_ID } from './constants.js';
import { registerSettings } from './settings.js';
import { registerStatusEffects } from './conditions.js';
import { api } from './api.js';
import { drawPips, positionPips, redrawActorPips, redrawAllPips, repositionAllPips } from './pips.js';
import { radialMenu } from './radial.js';
import { installTokenRightClick } from './compat.js';

Hooks.once('init', () =>
{
   registerSettings({ onPipsChange: redrawAllPips });
   registerStatusEffects();
   installTokenRightClick((token) => radialMenu.open(token));
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
      if (actor)
      {
         redrawActorPips(actor);
         radialMenu.refresh(actor);
      }
   });
}

// Unlinked tokens store their actor changes in the token's delta; redraw from the token update as well,
// in case the embedded-document hooks above don't fire for synthetic actors.
Hooks.on('updateToken', (tokenDoc, change) =>
{
   if (change?.delta && tokenDoc.object)
   {
      drawPips(tokenDoc.object);
      radialMenu.refresh(tokenDoc.object.actor);
   }
   if (change && 'hidden' in change) { radialMenu.refresh(); }
});
