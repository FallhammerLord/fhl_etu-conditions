/**
 * Module settings. Player edit rights are per condition; the GM can always edit.
 * Players handle their own units' conditions from the ring, so every condition defaults to player-editable.
 */

import { MODULE_ID } from './constants.js';

/** Condition keys with a player-edit setting, and their defaults. */
const PLAYER_EDIT_DEFAULTS = {
   temperature: true,
   targetLock: true,
   jammed: true,
   recoil: true,
   hacked: true
};

/**
 * @param {object} callbacks - Hooks back into the module.
 * @param {Function} callbacks.onPipsChange - Redraws pips on every token.
 */
export function registerSettings({ onPipsChange })
{
   for (const [key, value] of Object.entries(PLAYER_EDIT_DEFAULTS))
   {
      game.settings.register(MODULE_ID, `playerEdit.${key}`, {
         name: `${MODULE_ID}.settings.playerEdit.${key}.name`,
         hint: `${MODULE_ID}.settings.playerEdit.hint`,
         scope: 'world',
         config: true,
         type: Boolean,
         default: value
      });
   }

   game.settings.register(MODULE_ID, 'contrast', {
      name: `${MODULE_ID}.settings.contrast.name`,
      hint: `${MODULE_ID}.settings.contrast.hint`,
      scope: 'client',
      config: true,
      type: String,
      choices: {
         standard: `${MODULE_ID}.settings.contrast.standard`,
         high: `${MODULE_ID}.settings.contrast.high`
      },
      default: 'standard',
      onChange: () => onPipsChange()
   });

   game.settings.register(MODULE_ID, 'showPips', {
      name: `${MODULE_ID}.settings.showPips.name`,
      hint: `${MODULE_ID}.settings.showPips.hint`,
      scope: 'client',
      config: true,
      type: Boolean,
      default: true,
      onChange: () => onPipsChange()
   });
}

/**
 * @param {string} key - Condition key, or "hacked".
 * @returns {boolean} Whether the current user may change this condition on units they own.
 */
export function canEdit(key)
{
   if (game.user.isGM) { return true; }
   return game.settings.get(MODULE_ID, `playerEdit.${key}`) === true;
}

/** @returns {boolean} Whether this player chose the high-contrast (colour-blind friendly) look. */
export function highContrast()
{
   try { return game.settings.get(MODULE_ID, 'contrast') === 'high'; }
   catch { return false; }
}

/** @returns {boolean} Whether this client draws condition pips on tokens. */
export function showPips()
{
   return game.settings.get(MODULE_ID, 'showPips') !== false;
}
