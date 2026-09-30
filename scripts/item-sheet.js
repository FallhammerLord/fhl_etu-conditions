/**
 * The "ETU system" section on Cypher System item sheets (Settings tab): mount, Recoil, Signal, Drain.
 * Inputs are named by flag path, so the system's own form submit saves them; nothing here writes.
 * Same approach as the Cypher Card Sheet's item fields. Baseline: cyphersystem v3.5.2 (AppV1 sheet).
 */

import { MODULE_ID } from './constants.js';
import { ETU_ITEM_TYPES, hostOf, mountInfo, recoilInfo } from './items.js';

const t = (key) => game.i18n.localize(`${MODULE_ID}.${key}`);
const tf = (key, data) => game.i18n.format(`${MODULE_ID}.${key}`, data);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const flagPath = (key) => `flags.${MODULE_ID}.${key}`;

/**
 * @param {string} key - Flag key.
 * @param {Array<[string, string]>} options - [value, label] pairs.
 * @param {*} current - Stored value.
 * @param {string} off - " disabled" or "".
 * @returns {string} HTML.
 */
function select(key, options, current, off)
{
   const opts = options.map(([v, label]) => `<option value="${esc(v)}"${String(current ?? '') === v ? ' selected' : ''}>${esc(label)}</option>`);
   return `<select class="auto-margin settings-input" name="${flagPath(key)}"${off}>${opts.join('')}</select>`;
}

function number(key, value, placeholder, off)
{
   const v = value === null || value === undefined ? '' : value;
   return `<input class="auto-margin settings-input" type="number" data-dtype="Number" min="0" name="${flagPath(key)}" value="${esc(v)}" placeholder="${esc(placeholder)}"${off}>`;
}

const row = (label, input) =>
   `<li class="item flexrow item-settings"><div class="settings-list">${esc(label)}</div><div class="item-quantity">${input}</div></li>`;

const note = (text) => `<li class="item flexrow"><div class="settings-list etu-sheet-note">${esc(text)}</div></li>`;

/**
 * @param {Item} item - The item whose sheet is rendering.
 * @param {boolean} editable - Whether the sheet is editable.
 * @returns {string} Section HTML, or "" for item types without ETU values.
 */
export function etuFieldsHtml(item, editable)
{
   const rows = ETU_ITEM_TYPES[item.type];
   if (!rows) { return ''; }
   const flags = item.flags?.[MODULE_ID] ?? {};
   const off = editable ? '' : ' disabled';
   const header = `<li class="item flexrow item-header"><div class="item-name">${esc(t('sheet.title'))}</div></li>`;
   const wrap = (body) => `<div class="flexrow etu-sheet-fields"><ol class="items-list">${header}${body}</ol></div>`;

   // Half of a linked pair: the artifact carries the values for both.
   const host = item.parent ? hostOf(item) : item;
   if (host !== item) { return wrap(note(tf('sheet.linkedNote', { host: host.name }))); }

   const out = [];
   if (rows.mount)
   {
      const info = item.parent ? mountInfo(item, { useFlag: false }) : { mount: null, source: 'none' };
      const detected = info.mount
         ? tf('sheet.autoFrom', { value: t(`mount.${info.mount}`), source: t(`source.${info.source}`) })
         : t('sheet.autoNone');
      out.push(row(t('sheet.mount'), select('mount', [
         ['', detected],
         ['hardpoint', t('mount.hardpoint')],
         ['sensor', t('mount.sensor')],
         ['bay', t('mount.bay')],
         ['none', t('mount.none')]
      ], flags.mount, off)));
   }
   if (rows.recoil)
   {
      // Show what "blank" means for this weapon right now.
      const auto = item.parent ? recoilInfo(item, { useFlag: false }) : { rating: 0, source: 'none' };
      const placeholder = auto.rating ? tf('sheet.recoilAuto', { rating: auto.rating }) : t('sheet.recoilNone');
      out.push(row(t('sheet.recoil'), number('recoil', flags.recoil, placeholder, off)));
   }
   if (rows.signal)
   {
      out.push(row(t('sheet.signalRole'), select('signalRole', [
         ['', t('role.none')], ['source', t('role.source')], ['reliant', t('role.reliant')]
      ], flags.signalRole, off)));
      if (flags.signalRole === 'source' || flags.signalRole === 'reliant')
      {
         out.push(row(t('sheet.signalType'), select('signalType', [
            ['', t('signal.electromagnetic')], ['liminal', t('signal.liminal')], ['etheric', t('signal.etheric')]
         ], flags.signalType, off)));
         out.push(row(t('sheet.signalLevel'), number('signalLevel', flags.signalLevel, t('sheet.signalLevelHint'), off)));
      }
   }
   if (rows.drain)
   {
      out.push(row(t('sheet.drainPool'), select('drainPool', [
         ['', t('pool.none')], ['frame', t('pool.frame')], ['reactor', t('pool.reactor')], ['strain', t('pool.strain')]
      ], flags.drainPool, off)));
      if (flags.drainPool) { out.push(row(t('sheet.drainAmount'), number('drainAmount', flags.drainAmount, '0', off))); }
   }
   return wrap(out.join(''));
}

/**
 * renderCypherItemSheet hook: adds the section to the Settings tab once per render.
 *
 * @param {Application} app - The item sheet.
 * @param {jQuery|HTMLElement} html - Rendered HTML.
 */
export function onRenderItemSheet(app, html)
{
   const item = app.document ?? app.object;
   const root = app.element?.[0] ?? app.element ?? html?.[0] ?? html;
   if (!item || !(root instanceof HTMLElement)) { return; }
   const tab = root.querySelector('.tab[data-tab="settings"]');
   if (!tab || tab.querySelector('.etu-sheet-fields')) { return; }
   const section = etuFieldsHtml(item, app.isEditable);
   if (section) { tab.insertAdjacentHTML('afterbegin', section); }
}
