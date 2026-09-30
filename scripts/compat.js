/**
 * The compatibility boundary. Every version-sensitive Foundry or Cypher System API is reached
 * through this file, so a new Foundry major means editing here first. See docs/SCOPE.md section 7.
 * Paths checked against the v14 community type definitions (build 14.366) and Cypher System 3.5.2.
 */

/** @returns {number} ActiveEffect showIcon value that hides the core icon (our pips show the level). */
export function showIconNever()
{
   return CONST.ACTIVE_EFFECT_SHOW_ICON?.NEVER ?? 0;
}

/** @returns {Token[]} Tokens the current user has selected on the canvas. */
export function controlledTokens()
{
   return globalThis.canvas?.tokens?.controlled ?? [];
}

/**
 * @param {Actor} actor - A world actor or a token's synthetic actor.
 * @returns {Token[]} Placeables on the current scene that show this actor.
 */
export function activeTokens(actor)
{
   return actor?.getActiveTokens?.() ?? [];
}

/**
 * @param {string} uuid - Any document UUID.
 * @returns {foundry.abstract.Document|null} The document, if it is already loaded.
 */
export function documentFromUuid(uuid)
{
   try { return fromUuidSync(uuid); }
   catch { return null; }
}

/** @returns {number} Current canvas zoom (1 = 100%). */
export function canvasZoom()
{
   return globalThis.canvas?.stage?.scale?.x || 1;
}

/** @returns {typeof PIXI.Text} Foundry's crisp text class, falling back to plain PIXI text. */
function textClass()
{
   return foundry.canvas?.containers?.PreciseText ?? PIXI.Text;
}

/**
 * @param {string} hex - A `#rrggbb` color.
 * @returns {number} The color as a PIXI number.
 */
function colorNumber(hex)
{
   return Number.parseInt(hex.slice(1), 16);
}

/**
 * Builds one pip: a dark rounded pill with a colored border and label. PIXI 7 Graphics API.
 *
 * @param {string} label - Pip text, e.g. "L4".
 * @param {string} color - `#rrggbb` border and text color.
 * @param {number} height - Pip height in canvas pixels.
 * @returns {PIXI.Container} The pip, origin at its top-left corner.
 */
export function makePip(label, color, height)
{
   const pip = new PIXI.Container();
   const Text = textClass();
   const text = new Text(label, {
      fontFamily: 'monospace',
      fontSize: Math.round(height * 0.66),
      fontWeight: '700',
      fill: colorNumber(color)
   });
   const padX = height * 0.35;
   const width = Math.max(height * 1.6, text.width + padX * 2);
   const bg = new PIXI.Graphics();
   bg.lineStyle(Math.max(1.5, height * 0.1), colorNumber(color), 1);
   bg.beginFill(0x0e1318, 0.92);
   bg.drawRoundedRect(0, 0, width, height, height * 0.25);
   bg.endFill();
   text.anchor?.set?.(0.5, 0.5);
   text.position.set(width / 2, height / 2);
   pip.addChild(bg, text);
   pip.pipWidth = width;
   return pip;
}
