/**
 * Pure rules math, no Foundry calls, so tools/rules-check.mjs can test it in Node.
 * Rules text: docs/SCOPE.md section 3. Pools use the hack's names: frame, reactor, strain.
 */

/** Signal strength offsets against Electromagnetic. */
export const SIGNAL_TYPE_BONUS = { electromagnetic: 0, liminal: 2, etheric: 4 };

/** Default Recoil ratings by weapon size. */
export const RECOIL_BY_SIZE = { light: 2, medium: 4, heavy: 6, capital: 8 };

/**
 * Extra pool cost per level of Effort from Temperature.
 *
 * @param {number} temperature - -3 (Freezing) to 3 (Overheating).
 * @param {string} pool - frame | reactor | strain.
 * @returns {number} Points added per level of Effort.
 */
export function temperatureCostPerEffort(temperature, pool)
{
   if (temperature === 2 || temperature === -2) { return pool === 'reactor' ? 1 : 0; }
   if (temperature === 3) { return pool === 'reactor' || pool === 'frame' ? 3 : 0; }
   if (temperature === -3) { return pool === 'reactor' || pool === 'strain' ? 3 : 0; }
   return 0;
}

/**
 * Net difficulty steps for a Signal attack. Jammed is a high-water line against Target Lock:
 * a lock above the jam eases by the difference; otherwise the full jam hinders.
 *
 * @param {number} targetLock - The target's Target Lock level.
 * @param {number} jammed - The attacker's Jammed level.
 * @returns {number} Positive = eased by that many steps, negative = hindered.
 */
export function signalSteps(targetLock, jammed)
{
   if (targetLock > jammed) { return targetLock - jammed; }
   return jammed > 0 ? -jammed : 0;
}

/**
 * Whether a signal gets through a jam, and at what level.
 *
 * @param {number} level - The signal's base level.
 * @param {string} type - electromagnetic | liminal | etheric.
 * @param {number} jammed - Jammed level affecting it.
 * @returns {{ works: boolean, effective: number }} A signal at or below the jam fails.
 */
export function signalThroughJam(level, type, jammed)
{
   const strength = level + (SIGNAL_TYPE_BONUS[type] ?? 0);
   if (jammed > 0 && strength <= jammed) { return { works: false, effective: 0 }; }
   return { works: true, effective: strength - jammed };
}

/**
 * Recoil after firing: each shot's Recoil adds to what the unit already carries.
 *
 * @param {number} current - The unit's Recoil before the shot.
 * @param {number} shot - This shot's Recoil.
 * @param {number} [max=Infinity] - Cap from the condition's range.
 * @returns {number} Recoil after the shot.
 */
export function stackRecoil(current, shot, max = Infinity)
{
   return Math.min(max, Math.max(0, current) + Math.max(0, shot));
}

/**
 * Recoil after a Recoil Control test: the test's result comes off the current Recoil.
 *
 * @param {number} current - The unit's Recoil.
 * @param {number} result - The Recoil Control test's result.
 * @returns {number} Recoil left, never below 0.
 */
export function recoilAfterControl(current, result)
{
   return Math.max(0, current - Math.max(0, result));
}

/**
 * Pool fraction a pool must stay above for Deep Well to apply.
 *
 * @param {number} picks - Times Deep Well was chosen for this pool.
 * @returns {number|null} 0.9 for one pick, 0.8 for two, and so on; null with no picks.
 */
export function deepWellThreshold(picks)
{
   if (!picks || picks < 1) { return null; }
   return Math.max(0, 0.9 - 0.1 * (picks - 1));
}

/**
 * Points a Drain feature takes from its pool. Edge never reduces Drain; Deep Well lowers it by 1
 * while the pool is above its threshold.
 *
 * @param {number} drain - The feature's Drain value.
 * @param {number} current - Pool's current value.
 * @param {number} max - Pool's maximum.
 * @param {number} [picks=0] - Deep Well picks for this pool.
 * @returns {number} Points to subtract.
 */
export function drainCost(drain, current, max, picks = 0)
{
   const threshold = deepWellThreshold(picks);
   const reduce = threshold !== null && max > 0 && current / max > threshold ? 1 : 0;
   return Math.max(0, drain - reduce);
}
