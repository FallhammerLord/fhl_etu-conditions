/**
 * Small colour maths for readable text on the ring's filled gauge cells (WCAG relative luminance).
 * No Foundry calls, so tools/check-contrast.mjs uses the same functions the ring does.
 */

/** Wedge fill per palette. Must match `--etu-slice` in styles/etu.css (the contrast check verifies it). */
export const SURFACE = { standard: '#1c2430', contrast: '#141a23' };

/** How much of a condition's colour a "within the level" gauge cell shows, per palette. */
export const WITHIN_MIX = { standard: 0.45, contrast: 0.7 };

/** Light and dark label colours. Must match `--etu-fg` and `--etu-bg` (checked). */
export const LABEL = { standard: { light: '#e7edf4', dark: '#0f131a' }, contrast: { light: '#ffffff', dark: '#05070a' } };

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** @returns {number} WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex)
{
   const [r, g, b] = rgb(hex).map((c) => channel(c / 255));
   return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

/** @returns {number} WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a, b)
{
   const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
   return (hi + 0.05) / (lo + 0.05);
}

/**
 * @param {string} a - `#rrggbb`.
 * @param {string} b - `#rrggbb`.
 * @param {number} p - Share of `a`, 0–1.
 * @returns {string} The sRGB mix, like CSS `color-mix(in srgb, a p, b)`.
 */
export function mix(a, b, p)
{
   const [x, y] = [rgb(a), rgb(b)];
   return `#${x.map((c, i) => Math.round((c * p) + (y[i] * (1 - p))).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @param {string} fill - Background `#rrggbb`.
 * @param {{ light: string, dark: string }} labels - Candidate text colours.
 * @returns {string} Whichever reads better on the fill.
 */
export function readableOn(fill, labels)
{
   return contrastRatio(labels.light, fill) >= contrastRatio(labels.dark, fill) ? labels.light : labels.dark;
}
