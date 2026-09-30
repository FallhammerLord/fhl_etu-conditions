/**
 * The condition registry: one entry per unit-level condition, plus the temperature scale.
 * Hacked is not here because it lives on items (a Hard Point, Sensor, or Bay), not on the unit.
 * Rules text: docs/SCOPE.md section 3.
 */

import { MODULE_ID } from './constants.js';
import { highContrast } from './settings.js';

/** Temperature steps from Freezing (-3) to Overheating (+3). */
export const TEMPERATURE_STEPS = [
   { value: -3, key: 'freezing',    short: 'FRZ' },
   { value: -2, key: 'cold',        short: 'COLD' },
   { value: -1, key: 'chill',       short: 'CHILL' },
   { value: 0,  key: 'normal',      short: 'NORM' },
   { value: 1,  key: 'warm',        short: 'WARM' },
   { value: 2,  key: 'hot',         short: 'HOT' },
   { value: 3,  key: 'overheating', short: 'OVHT' }
];

/**
 * Condition colors. "contrast" is for colour-blind players, from the Okabe-Ito set: Temperature is a
 * blue-to-orange scale that stays ordered under protan, deutan, and tritan vision, and the other
 * conditions take hues outside that range (yellow, reddish purple, bluish green, vermillion) so no two
 * pips share a colour. Every colour also has a text cue (HOT, L4, J3, R6, H1).
 */
export const PALETTES = {
   standard: {
      targetLock: '#d8b25a', jammed: '#b07ad8', recoil: '#e0875a', hacked: '#e66b62',
      temperature: { '-3': '#5a95ec', '-2': '#5b9ae6', '-1': '#86b3e3', 0: '#9aa6b3', 1: '#e3b07a', 2: '#e68a4f', 3: '#ec6a4a' }
   },
   contrast: {
      targetLock: '#f0e442', jammed: '#cc79a7', recoil: '#10a877', hacked: '#e0602a',
      temperature: { '-3': '#4a9ff0', '-2': '#7cbcf2', '-1': '#b3d8f7', 0: '#c9ced4', 1: '#f7d08a', 2: '#f0a800', 3: '#d9621a' }
   }
};

/**
 * @param {string} key - Condition key, or "hacked".
 * @param {number} [level] - Level (Temperature's color depends on it).
 * @returns {string} `#rrggbb` for the current player's palette.
 */
export function conditionColor(key, level = 0)
{
   const palette = highContrast() ? PALETTES.contrast : PALETTES.standard;
   return key === 'temperature' ? palette.temperature[Math.max(-3, Math.min(3, level))] : palette[key];
}

/**
 * @param {number} value - Temperature value, -3 to 3.
 * @returns {object} The matching step (Normal when out of range).
 */
export function temperatureStep(value)
{
   return TEMPERATURE_STEPS.find((s) => s.value === value) ?? TEMPERATURE_STEPS[3];
}

/**
 * Unit-level conditions. Each is stored as one Active Effect carrying `statuses: [id]`
 * and its level in `flags.<module>.level`. Level 0 means the effect is removed.
 */
export const CONDITIONS = {
   temperature: {
      key: 'temperature', id: 'etu-temperature', min: -3, max: 3,
      img: 'icons/svg/fire.svg',
      pip: (level) => temperatureStep(level).short,
      pipColor: (level) => conditionColor('temperature', level)
   },
   targetLock: {
      key: 'targetLock', id: 'etu-target-lock', min: 0, max: 10,
      img: 'icons/svg/target.svg',
      pip: (level) => `L${level}`,
      pipColor: () => conditionColor('targetLock')
   },
   jammed: {
      key: 'jammed', id: 'etu-jammed', min: 0, max: 10,
      img: 'icons/svg/daze.svg',
      pip: (level) => `J${level}`,
      pipColor: () => conditionColor('jammed')
   },
   recoil: {
      key: 'recoil', id: 'etu-recoil', min: 0, max: 10,
      img: 'icons/svg/downgrade.svg',
      pip: (level) => `R${level}`,
      pipColor: () => conditionColor('recoil')
   }
};

/** Hacked systems share one pip. */
export const HACKED = { key: 'hacked', min: 0, max: 10, pip: (count) => `H${count}`, pipColor: () => conditionColor('hacked') };

/** Pip order on tokens. */
export const CONDITION_ORDER = ['temperature', 'targetLock', 'jammed', 'recoil'];

/**
 * @param {string} key - Condition key.
 * @param {number} level - Requested level.
 * @returns {number} The level as an integer inside the condition's range.
 */
export function clampLevel(key, level)
{
   const def = key === HACKED.key ? HACKED : CONDITIONS[key];
   const n = Math.trunc(Number(level) || 0);
   return Math.min(def.max, Math.max(def.min, n));
}

/**
 * Localized display name for a condition at a level, used as the effect's name.
 *
 * @param {string} key - Condition key.
 * @param {number} level - Current level.
 * @returns {string} e.g. "Hot" or "Target Lock 4".
 */
export function conditionLabel(key, level)
{
   if (key === 'temperature')
   {
      return game.i18n.localize(`${MODULE_ID}.temperature.${temperatureStep(level).key}`);
   }
   return `${game.i18n.localize(`${MODULE_ID}.condition.${key}`)} ${level}`;
}

/**
 * Registers the conditions as status effects so other modules and Foundry's effect lists
 * recognize them. They stay out of the Token HUD: they carry levels, which the HUD's
 * on/off toggles can't set.
 */
export function registerStatusEffects()
{
   for (const key of CONDITION_ORDER)
   {
      const def = CONDITIONS[key];
      if (CONFIG.statusEffects.some((s) => s.id === def.id)) { continue; }
      CONFIG.statusEffects.push({
         id: def.id,
         name: `${MODULE_ID}.condition.${key}`,
         img: def.img,
         hud: false
      });
   }
}
