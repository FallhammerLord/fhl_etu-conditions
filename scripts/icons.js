/**
 * Line icons for the radial menu, drawn as SVG symbols (24×24, stroked with currentColor).
 * Bundled here rather than loaded from Foundry or a font, so they look the same in every world
 * and in the offline preview.
 */

const FLAME = '<path d="M12 21.2c-3.9 0-6.6-2.6-6.6-6.3 0-3.3 2.3-5.4 3.7-8 .5 1.7 1.6 2.8 2.7 3.3.2-3.1 1.2-5.6 3.4-7.1-.2 3 1.2 4.8 2.3 6.6 1 1.6 1.5 3.2 1.5 5.2 0 3.7-2.7 6.3-7 6.3z"/>';
const FLAME_CORE = '<path d="M12 21.2c-1.8 0-3-1.2-3-2.9 0-1.6 1.2-2.6 2-3.9.4 1 1 1.5 1.6 1.8.3-1 .7-1.8 1.4-2.4 0 1.5.9 2.5.9 4 0 2.1-1.2 3.4-2.9 3.4z"/>';
const SNOW = '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>';

const ICONS = {
   thermal: '<path d="M10 4.5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z"/><path d="M12 9v7.5"/>',
   signal: '<path d="M12 21v-9"/><circle cx="12" cy="10" r="1.6"/><path d="M8.6 13.4a4.8 4.8 0 0 1 0-6.8M15.4 6.6a4.8 4.8 0 0 1 0 6.8M5.8 16.2a8.8 8.8 0 0 1 0-12.4M18.2 3.8a8.8 8.8 0 0 1 0 12.4"/>',
   recoil: '<path d="M21 12H7"/><path d="M11 7.5L6.5 12l4.5 4.5"/><path d="M3 6.5v11"/>',
   hacked: '<rect x="7" y="7" width="10" height="10" rx="1.2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/><path d="M10 10l4 4M14 10l-4 4"/>',
   token: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0"/>',
   clear: '<circle cx="12" cy="12" r="8.5"/><path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4"/>',
   targetLock: '<circle cx="12" cy="12" r="6.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.2"/>',
   jammed: '<path d="M2.5 12c2.2-4.4 4.3-4.4 6.4 0s4.2 4.4 6.3 0 4.2-4.4 6.3 0"/><path d="M5 20.5L19 3.5"/>',
   hardpoint: '<rect x="3" y="9.5" width="11" height="5.5" rx="1"/><path d="M14 12.2h7"/><path d="M6.5 15v3.5M10 15v2"/>',
   sensor: '<path d="M12 12l6.5-6.5"/><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/><path d="M12 8a4 4 0 1 0 4 4"/>',
   bay: '<rect x="4" y="4.5" width="16" height="15" rx="1.2"/><circle cx="9" cy="9.5" r="1.7"/><circle cx="15" cy="9.5" r="1.7"/><circle cx="9" cy="14.5" r="1.7"/><circle cx="15" cy="14.5" r="1.7"/>',
   system: '<rect x="5" y="5" width="14" height="14" rx="1.5"/><path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2"/><rect x="9" y="9" width="6" height="6" rx="0.5"/>',
   more: '<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>',
   target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
   combat: '<path d="M4 4l10.5 10.5M20 4L9.5 14.5"/><path d="M6.5 14.5l3 3M17.5 14.5l-3 3M4.5 19.5l3-3M19.5 19.5l-3-3"/>',
   hide: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 20L20 4"/>',
   reveal: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>',
   hud: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',

   // Temperature, three intensities each: the shape grows more complex as it gets hotter or colder.
   flame1: FLAME,
   flame2: FLAME + FLAME_CORE,
   flame3: FLAME + FLAME_CORE + '<path d="M3.5 7.5l1.6 1.2M20.5 7l-1.6 1.2M2.8 13h1.8M19.4 13h1.8M6 3.5l.9 1.6"/>',
   snow1: SNOW,
   snow2: SNOW + '<path d="M9.6 4.6L12 6.6l2.4-2M9.6 19.4L12 17.4l2.4 2"/>',
   snow3: SNOW + '<path d="M9.6 4.6L12 6.6l2.4-2M9.6 19.4L12 17.4l2.4 2M4.5 10.6l2.9.9.7-2.9M19.5 10.6l-2.9.9-.7-2.9M4.5 13.4l2.9-.9.7 2.9M19.5 13.4l-2.9-.9-.7 2.9"/>'
};

/**
 * @param {number} value - Temperature, -3 to 3.
 * @returns {string} Flame for hot, snowflake for cold (more elaborate the further from Normal), else thermometer.
 */
export function temperatureIcon(value)
{
   if (value > 0) { return `flame${Math.min(3, value)}`; }
   if (value < 0) { return `snow${Math.min(3, -value)}`; }
   return 'thermal';
}

/** @returns {string[]} Every icon name. */
export function iconNames()
{
   return Object.keys(ICONS);
}

/**
 * @param {string} name - Icon name.
 * @returns {string} The symbol's element ID, for `<use href="#…">`.
 */
export function iconId(name)
{
   return `etu-icon-${ICONS[name] ? name : 'system'}`;
}

/**
 * @returns {string} A `<defs>` block with every icon as a symbol, to place once inside an SVG.
 */
export function iconDefs()
{
   const symbols = Object.entries(ICONS).map(([name, body]) =>
      `<symbol id="etu-icon-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`);
   return `<defs>${symbols.join('')}</defs>`;
}
