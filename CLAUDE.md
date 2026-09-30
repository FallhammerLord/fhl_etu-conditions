# ETU Conditions: working notes

Read this first in any new session. The full design, rules, and open decisions live in `docs/SCOPE.md`.

## What this is

A Foundry VTT **v14** module (ID `fhl-etu-conditions`, CSS prefix `etu-`) for a Cypher System hack about Ether-Tech units (ETUs). It tracks the hack's conditions (Temperature, Target Lock, Jammed, Recoil, Hacked, plus Drain), sets them from a radial token menu, and pre-fills the Cypher System All-in-One roll dialog. Plain ES modules, no build step. Version 0.1.0.

Targets: Foundry v14, Cypher System 3.5.x (`cyphersystem`, verified on 14.360).

Status: milestones 1–3 written (v0.2.4). Next: milestone 4, roll dialog pre-fill.

Verified in Foundry by the user: pips on PC and unlinked NPC tokens; macro API; radial menu opens on right-click, all rings click through; Shift + right-click opens Foundry's HUD; right-drag panning still works.

Known issue: the Hacked ring is crowded (every attack/equipment/armor/artifact is listed; long names wrap). Planned fix: item tags so only Hard Points, Sensors, and Bays appear.

## Working with the user

- The user has dyslexia: keep replies concise, plain, and forward-stated.
- Say what was verified and what wasn't. Nothing here can run inside Foundry; the user tests in their own v14 world and reports back. Ask for console errors (F12) when something breaks. `docs/TESTING.md` holds the test macros.
- Commit and push after each coherent slice. Don't open a PR unless asked.

## Commands

```sh
npm run check   # lint + load + rules. Run before every push.
npm run load    # imports every module file with Foundry mocked and runs init
npm run rules   # rules math, condition store, right-click routing, string keys
npm run preview # real radial menu in Chromium with Foundry mocked; screenshots to tools/out/
                # set CHROMIUM_PATH (here: /opt/pw-browsers/chromium)
```

## Design rules

- **Track, don't enforce.** Never block a roll or an action. Every pre-filled modifier is visible and can be unchecked.
- **Version-sensitive Foundry and Cypher System calls go only in `scripts/compat.js`.** That includes PIXI drawing.
- **Right-click:** extend whatever `CONFIG.Token.objectClass` holds at `init` (the Cypher System sets `CypherSystemToken`). Never replace it outright. Shift + right-click calls `super` to open Foundry's HUD.
- **Pools:** Frame = Might, Reactor = Speed, Strain = Intellect in the system's data.
- **Storage:** one Active Effect per unit condition, found by status ID (`etu-temperature`, `etu-target-lock`, `etu-jammed`, `etu-recoil`), level in `flags.fhl-etu-conditions.level`, `showIcon` NEVER (our pips show levels). Hacked is `flags.fhl-etu-conditions.hack` on the item.
- **All writes for one actor go through the queue in `store.js`,** read and write in one step, so rapid nudges can't race.
- **Pure rules math lives in `scripts/rules.js`** with no Foundry calls, tested by `npm run rules`.
- **Visual modules are optional** and sit behind an adapter that fails quietly.

## Lessons carried over from the Fallhammer Quest Log

- One bad import stops the whole module in Foundry, and ESLint won't catch it. `npm run load` catches it.
- Don't rely on Handlebars `eq`/`and`/`or`; compute booleans in JS.
- GM-relayed requests (`CONFIG.queries`) don't know who sent them. Re-check everything against the named user.
- Colors only through CSS tokens.
- After any scripted cut or splice of a file, diff it against the previous commit.

## Lessons from testing this module

- Foundry reads `module.json` only when a world launches. New `styles`, `esmodules`, or `languages` entries need a world relaunch, not F5. `ensureStylesheet` covers the stylesheet.
- A right-click we handle must still stop propagation at the token, as core does, or the canvas starts a right-drag pan that never ends.
- Don't draw an overlay under a held mouse button: it steals the release from the canvas. The ring opens after the right-button release.

## Map

| Path | Role |
|---|---|
| `scripts/main.js` | init hook, token draw/refresh hooks, document hooks that redraw pips |
| `scripts/compat.js` | **only** place for version-sensitive APIs (PIXI, status constants, tokens) |
| `scripts/conditions.js` | condition registry, temperature scale, status effect registration |
| `scripts/store.js` | read/write levels and hack ratings, per-actor write queue, permissions |
| `scripts/api.js` | public macro API (`game.modules.get(id).api`) |
| `scripts/rules.js` | pure rules math: temperature cost, lock vs jam, signal cutoff, Drain |
| `scripts/pips.js` | condition pips drawn above tokens (min 20 screen px tall at any zoom) |
| `scripts/radial.js` | radial token menu: rings, gauges, keys, wheel, paging, readout |
| `styles/etu.css` | radial menu styles, colors through `--etu-*` tokens |
| `scripts/settings.js` | player edit rights per condition, pip toggle |
| `tools/` | Foundry mock, load check, rules and store checks |
| `docs/SCOPE.md` | scope, rules as implemented, spec, milestones, open decisions |
| `docs/TESTING.md` | install notes and test macros for the user |
| `docs/mockups/radial-menu.html` | clickable radial menu mockup |
