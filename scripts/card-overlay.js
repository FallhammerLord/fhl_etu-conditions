/**
 * Hacked overlay on the Cypher Card Sheet's item cards (only when that module's sheet is in use).
 * A hacked system's card gets a hazard tint and a "HACKED n" badge; unhacked cards are untouched.
 * Linked cards (an attack linked to its artifact) read the artifact's rating, so both show it.
 * Card markup baseline: cypher-card-sheet 1.0 (`article.ccs-card[data-item-id] > .ccs-card-body`).
 */

import { MODULE_ID } from './constants.js';
import { conditionColor } from './conditions.js';
import { hackOf } from './items.js';
import { highContrast } from './settings.js';
import { LABEL, readableOn } from './color.js';
import { iconDefs } from './icons.js';

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
   const ink = readableOn(color, LABEL[highContrast() ? 'contrast' : 'standard']);
   ensureIcons(root);
   for (const card of root.querySelectorAll('article.ccs-card[data-item-id]'))
   {
      for (const old of card.querySelectorAll('.etu-hack-veil, .etu-hack-badge')) { old.remove(); }
      card.classList.remove('etu-hacked');
      const item = actor.items.get(card.dataset.itemId);
      const rating = item ? hackOf(item) : 0;
      if (!rating) { continue; }

      card.classList.add('etu-hacked');
      card.style.setProperty('--etu-hack', color);
      card.style.setProperty('--etu-hack-ink', ink);
      const body = card.querySelector('.ccs-card-body') ?? card;
      const note = tf('card.hackedNote', { level: rating });

      const veil = document.createElement('span');
      veil.className = 'etu-hack-veil';
      veil.setAttribute('aria-hidden', 'true');

      const badge = document.createElement('span');
      badge.className = 'etu-hack-badge';
      badge.dataset.tooltip = note;
      badge.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#etu-icon-hacked"/></svg>';
      const text = document.createElement('span');
      text.textContent = tf('card.hacked', { level: rating });
      const sr = document.createElement('span');
      sr.className = 'etu-visually-hidden';
      sr.textContent = `. ${note}`;
      badge.append(text, sr);

      // Under the card's own text (caps, name, value), over its art.
      const shade = body.querySelector('.ccs-card-shade');
      if (shade) { shade.after(veil, badge); }
      else { body.append(veil, badge); }
   }
}

/** The badge's chip icon is an SVG symbol; make sure the page has the symbol set once. */
function ensureIcons(root)
{
   const doc = root.ownerDocument ?? document;
   if (doc.getElementById('etu-icon-hacked')) { return; }
   const holder = doc.createElement('div');
   holder.id = 'etu-icon-sprite';
   holder.hidden = true;
   holder.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">${iconDefs()}</svg>`;
   doc.body.append(holder);
}
