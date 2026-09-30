/**
 * Loads the whole module graph in Node with Foundry mocked, then runs the init hook.
 * One bad import stops the entire module in Foundry, and ESLint doesn't check that imports exist.
 * Usage: npm run load
 */
import { hooks } from './foundry-mock.mjs';

try
{
   await import(new URL('../scripts/main.js', import.meta.url));
   for (const fn of hooks.get('init') ?? []) { fn(); }
   if (!game.modules.get('fhl-etu-conditions').api) { throw new Error('init did not expose the API'); }
   if (CONFIG.statusEffects.length !== 4) { throw new Error(`expected 4 status effects, got ${CONFIG.statusEffects.length}`); }
   if (CONFIG.Token.objectClass.name !== 'EtuMockToken') { throw new Error('init did not extend the configured token class'); }
   console.log('Module graph loads and init runs.');
}
catch (err)
{
   console.error(`Module failed to load: ${err.message}`);
   process.exit(1);
}
