# Testing in Foundry

## Install (before the first release)

Copy or clone the repo into your Foundry data folder under the module's ID. The folder name must be `fhl-etu-conditions` (hyphen), not the repo name:

```
Data/modules/fhl-etu-conditions/
```

Then enable **ETU Conditions** in your Cypher System world.

## Milestone 1–2 checks: conditions and pips

Select one or more tokens and run these one at a time from a script macro. `etu` is the module's API.

```js
const etu = game.modules.get('fhl-etu-conditions').api;

await etu.set(undefined, 'temperature', 2);    // selected tokens become Hot: an orange "HOT" pip
await etu.adjust(undefined, 'targetLock', 1);  // run a few times: L1, L2, L3...
await etu.set(undefined, 'jammed', 3);         // purple "J3"
await etu.set(undefined, 'recoil', 4);         // "R4"
await etu.setHack(undefined, 'NAME OF AN ITEM', 3);  // "H1": use a real item name from the sheet
console.log(etu.get());                        // snapshot of the first selected token
await etu.clear();                             // everything off
```

What to look for:
1. Pips appear above each token, centered, and follow it when it moves.
2. Pips stay readable at different token sizes and zoom levels.
3. Linked PC tokens and unlinked NPC tokens both work. Unlinked copies of the same NPC keep separate conditions.
4. Running `adjust` quickly several times gives the right count, with no duplicate effects.
5. As a player (a user who owns a unit): Temperature and Recoil change; Target Lock, Jammed, and Hacked show a "GM only" warning. These rights are toggles in Module Settings.
6. **Show condition pips on tokens** (Module Settings) hides and shows the pips.
7. No errors in the console (F12). If something breaks, a screenshot of the console helps most.

Optional check: `canvas.tokens.controlled[0].actor.statuses` should list IDs like `etu-temperature` while a condition is on.
