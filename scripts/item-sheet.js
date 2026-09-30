/**
 * The "ETU system" section on Cypher System item sheets (Settings tab): the item's mount.
 * The input is named by flag path, so the system's own form submit saves it; nothing here writes.
 * Same approach as the Cypher Card Sheet's item fields. Baseline: cyphersystem v3.5.2 (AppV1 sheet).
 */

import { MODULE_ID } from './constants.js';
import { MOUNTABLE_TYPES, hostOf, mountInfo } from './items.js';

const t = (key) => game.i18n.localize(`${MODULE_ID}.${key}`);
const tf = (key, data) => game.i18n.format(`${MODULE_ID}.${key}`, data);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * @param {Item} item - The item whose sheet is rendering.
 * @param {boolean} editable - Whether the sheet is editable.
 * @returns {string} Section HTML, or "" for item types that can't be systems.
 */
export function etuFieldsHtml(item, editable)
{
   if (!MOUNTABLE_TYPES.has(item.type)) { return ''; }
   const header = `<li class="item flexrow item-header"><div class="item-name">${esc(t('sheet.title'))}</div></li>`;
   const wrap = (body) => `<div class="flexrow etu-sheet-fields"><ol class="items-list">${header}${body}</ol></div>`;

   // Half of a linked pair: the artifact carries the mount and Hack rating for both.
   const host = item.parent ? hostOf(item) : item;
   if (host !== item)
   {
      return wrap(`<li class="item flexrow"><div class="settings-list etu-sheet-note">${esc(tf('sheet.linkedNote', { host: host.name }))}</div></li>`);
   }

   const info = item.parent ? mountInfo(item, { useFlag: false }) : { mount: null, source: 'none' };
   const auto = info.mount
      ? tf('sheet.autoFrom', { value: t(`mount.${info.mount}`), source: t(`source.${info.source}`) })
      : t('sheet.autoNone');
   const current = String(item.flags?.[MODULE_ID]?.mount ?? '');
   const options = [['', auto], ['hardpoint', t('mount.hardpoint')], ['sensor', t('mount.sensor')], ['bay', t('mount.bay')], ['none', t('mount.none')]]
      .map(([v, label]) => `<option value="${v}"${current === v ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
   const select = `<select class="auto-margin settings-input" name="flags.${MODULE_ID}.mount"${editable ? '' : ' disabled'}>${options}</select>`;
   return wrap(`<li class="item flexrow item-settings"><div class="settings-list">${esc(t('sheet.mount'))}</div><div class="item-quantity">${select}</div></li>`);
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
