/**
 * ETU Conditions entry point: settings, status registration, API, and the hooks that keep
 * token pips in step with condition changes.
 */

import { MODULE_ID } from './constants.js';
import { registerSettings } from './settings.js';
import { registerStatusEffects } from './conditions.js';
import { api } from './api.js';
import { drawPips, positionPips, redrawActorPips, redrawAllPips, repositionAllPips } from './pips.js';

Hooks.once('init', () =>
{
   registerSettings({ onPipsChange: redrawAllPips });
   registerStatusEffects();
   game.modules.get(MODULE_ID).api = api;
});

Hooks.on('drawToken', (token) => drawPips(token));
Hooks.on('refreshToken', (token) => positionPips(token));
Hooks.on('canvasPan', () => repositionAllPips());

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
      if (actor) { redrawActorPips(actor); }
   });
}

// Unlinked tokens store their actor changes in the token's delta; redraw from the token update as well,
// in case the embedded-document hooks above don't fire for synthetic actors.
Hooks.on('updateToken', (tokenDoc, change) =>
{
   if (change?.delta && tokenDoc.object) { drawPips(tokenDoc.object); }
});
