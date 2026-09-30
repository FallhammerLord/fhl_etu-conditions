/**
 * Hacked overlay on the Cypher Card Sheet's item cards (only when that module's sheet is in use).
 * A hacked system's card gets a hazard tint and a "HACKED n" stamp across its middle, like a rejected
 * stamp on a document; unhacked cards are untouched. The tint sits under the card's text; the stamp prints
 * over everything at full strength and fades to half when the card is hovered or focused, so the text
 * beneath can be read. Clicks pass through the stamp to the card.
 * Linked cards (an attack linked to its artifact) read the artifact's rating, so both show it.
 * Card markup baseline: cypher-card-sheet 1.0 (`article.ccs-card[data-item-id] > .ccs-card-body`).
 */

import { MODULE_ID } from './constants.js';
import { conditionColor } from './conditions.js';
import { hackOf } from './items.js';

const tf = (key, data) => game.i18n.format(`${MODULE_ID}.${key}`, data);

/**
 * renderCypherCardSheet hook (ApplicationV2: app, element).
 *
 * @param {Application} app - The Card Sheet.
 * @param {HTMLElement} [element] - Its root element.
 */
export function onRenderCardSheet(app, element)
{
   const actor = app.document ?? app.actor;
   const root = element instanceof HTMLElement ? element : app.element;
   if (!actor?.items || !(root instanceof HTMLElement)) { return; }
   decorateCards(root, actor);
}

/**
 * Adds or refreshes the Hacked overlay on every card in `root`.
 *
 * @param {HTMLElement} root - Element containing `article.ccs-card` cards.
 * @param {Actor} actor - The sheet's actor.
 */
export function decorateCards(root, actor)
{
   const color = conditionColor('hacked');
   for (const card of root.querySelectorAll('article.ccs-card[data-item-id]'))
   {
      for (const old of card.querySelectorAll('.etu-hack-veil, .etu-hack-badge')) { old.remove(); }
      card.classList.remove('etu-hacked');
      const item = actor.items.get(card.dataset.itemId);
      const rating = item ? hackOf(item) : 0;
      if (!rating) { continue; }

      card.classList.add('etu-hacked');
      card.style.setProperty('--etu-hack', color);
      const body = card.querySelector('.ccs-card-body') ?? card;
      const note = tf('card.hackedNote', { level: rating });

      const veil = document.createElement('span');
      veil.className = 'etu-hack-veil';
      veil.setAttribute('aria-hidden', 'true');

      const badge = document.createElement('span');
      badge.className = 'etu-hack-badge';
      const text = document.createElement('span');
      text.textContent = tf('card.hacked', { level: rating });
      const sr = document.createElement('span');
      sr.className = 'etu-visually-hidden';
      sr.textContent = `. ${note}`;
      badge.append(text, sr);

      // Tint over the art, under the card's text (right after the shade); stamp on top of everything.
      const shade = body.querySelector('.ccs-card-shade');
      if (shade) { shade.after(veil); }
      else { body.prepend(veil); }
      body.append(badge);
   }
}
