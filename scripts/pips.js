/**
 * Condition pips: small labeled pills above each token (e.g. HOT, L4, J3, R4, H1).
 * Drawn as a child container of the Token placeable, so they move with it.
 */

import { CONDITIONS, CONDITION_ORDER, HACKED } from './conditions.js';
import { getConditions } from './store.js';
import { showPips } from './settings.js';
import { activeTokens, makePip } from './compat.js';

const CHILD = 'etuPips';

/**
 * @param {object} conditions - Snapshot from getConditions.
 * @returns {Array<[string, string]>} [label, color] per active condition.
 */
function pipList(conditions)
{
   const list = [];
   for (const key of CONDITION_ORDER)
   {
      const level = conditions[key];
      if (level) { list.push([CONDITIONS[key].pip(level), CONDITIONS[key].pipColor(level)]); }
   }
   if (conditions.hacked.length) { list.push([HACKED.pip(conditions.hacked.length), HACKED.color]); }
   return list;
}

/**
 * (Re)draws the pips for one token.
 *
 * @param {Token} token - The placeable.
 */
export function drawPips(token)
{
   // Token#draw may already have destroyed the old row along with the token's other children.
   if (token[CHILD] && !token[CHILD].destroyed) { token[CHILD].destroy({ children: true }); }
   token[CHILD] = null;
   if (!token.actor || !showPips()) { return; }

   const list = pipList(getConditions(token.actor));
   if (!list.length) { return; }

   const size = globalThis.canvas?.dimensions?.size ?? 100;
   const height = Math.max(12, Math.round(size * 0.18));
   const gap = Math.round(height * 0.2);
   const row = new PIXI.Container();
   let x = 0;
   for (const [label, color] of list)
   {
      const pip = makePip(label, color, height);
      pip.position.set(x, 0);
      row.addChild(pip);
      x += pip.pipWidth + gap;
   }
   row.pipRowWidth = x - gap;
   row.pipHeight = height;
   row.eventMode = 'none';
   token[CHILD] = token.addChild(row);
   positionPips(token);
}

/**
 * Centers the pip row above the token. Cheap enough to run on every token refresh.
 *
 * @param {Token} token - The placeable.
 */
export function positionPips(token)
{
   const row = token[CHILD];
   if (!row || row.destroyed) { return; }
   row.position.set((token.w - row.pipRowWidth) / 2, -row.pipHeight - Math.round(row.pipHeight * 0.3));
}

/** @param {Actor} actor - Redraw pips on every token of this actor on the current scene. */
export function redrawActorPips(actor)
{
   for (const token of activeTokens(actor)) { drawPips(token); }
}

/** Redraw pips on every token on the current scene. */
export function redrawAllPips()
{
   for (const token of globalThis.canvas?.tokens?.placeables ?? []) { drawPips(token); }
}
