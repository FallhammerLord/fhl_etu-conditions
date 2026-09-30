/**
 * The condition registry: one entry per unit-level condition, plus the temperature scale.
 * Hacked is not here because it lives on items (a Hard Point, Sensor, or Bay), not on the unit.
 * Rules text: docs/SCOPE.md section 3.
 */

import { MODULE_ID } from './constants.js';

/** Temperature steps from Freezing (-3) to Overheating (+3). */
export const TEMPERATURE_STEPS = [
   { value: -3, key: 'freezing',    short: 'FRZ',   color: '#3d7fe0' },
   { value: -2, key: 'cold',        short: 'COLD',  color: '#5b9ae6' },
   { value: -1, key: 'chill',       short: 'CHILL', color: '#86b3e3' },
   { value: 0,  key: 'normal',      short: 'NORM',  color: '#9aa6b3' },
   { value: 1,  key: 'warm',        short: 'WARM',  color: '#e3b07a' },
   { value: 2,  key: 'hot',         short: 'HOT',   color: '#e68a4f' },
   { value: 3,  key: 'overheating', short: 'OVHT',  color: '#e25a3a' }
];

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
      img: 'icons/svg/fire.svg', color: '#e68a4f',
      pip: (level) => temperatureStep(level).short,
      pipColor: (level) => temperatureStep(level).color
   },
   targetLock: {
      key: 'targetLock', id: 'etu-target-lock', min: 0, max: 10,
      img: 'icons/svg/target.svg', color: '#d8b25a',
      pip: (level) => `L${level}`,
      pipColor: () => '#d8b25a'
   },
   jammed: {
      key: 'jammed', id: 'etu-jammed', min: 0, max: 10,
      img: 'icons/svg/daze.svg', color: '#b07ad8',
      pip: (level) => `J${level}`,
      pipColor: () => '#b07ad8'
   },
   recoil: {
      key: 'recoil', id: 'etu-recoil', min: 0, max: 10,
      img: 'icons/svg/downgrade.svg', color: '#e0875a',
      pip: (level) => `R${level}`,
      pipColor: () => '#e0875a'
   }
};

/** Hacked systems share one pip; its color lives here with the others. */
export const HACKED = { key: 'hacked', min: 0, max: 10, color: '#d0574e', pip: (count) => `H${count}` };

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
