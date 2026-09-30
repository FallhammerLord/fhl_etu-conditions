/**
 * Condition pips: small labeled pills above each token (e.g. HOT, L4, J3, R4, H1).
 * Drawn as a child container of the Token placeable, so they move with it.
 */

import { CONDITIONS, CONDITION_ORDER, HACKED } from './conditions.js';
import { getConditions } from './store.js';
import { highContrast, showPips } from './settings.js';
import { activeTokens, canvasZoom, makePip } from './compat.js';

const CHILD = 'etuPips';

/** Pip height in canvas pixels, as a fraction of a grid square. */
const HEIGHT_OF_GRID = 0.24;

/** Pips never shrink below this height on screen, in screen pixels, however far out you zoom. */
const MIN_SCREEN_HEIGHT = 20;

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
   if (conditions.hacked.length) { list.push([HACKED.pip(conditions.hacked.length), HACKED.pipColor()]); }
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
   const height = Math.max(16, Math.round(size * HEIGHT_OF_GRID));
   const gap = Math.round(height * 0.2);
   const row = new PIXI.Container();
   let x = 0;
   for (const [label, color] of list)
   {
      const pip = makePip(label, color, height, { solid: highContrast() });
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
 * Centers the pip row above the token and scales it up when zoomed out, so it stays readable.
 * Cheap enough to run on every token refresh and canvas pan.
 *
 * @param {Token} token - The placeable.
 */
export function positionPips(token)
{
   const row = token[CHILD];
   if (!row || row.destroyed) { return; }
   const scale = Math.max(1, MIN_SCREEN_HEIGHT / (row.pipHeight * canvasZoom()));
   row.scale.set(scale);
   const height = row.pipHeight * scale;
   row.position.set((token.w - row.pipRowWidth * scale) / 2, -height - Math.round(height * 0.3));
}

/** Re-scale every token's pips after a zoom change. */
export function repositionAllPips()
{
   for (const token of globalThis.canvas?.tokens?.placeables ?? []) { positionPips(token); }
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
