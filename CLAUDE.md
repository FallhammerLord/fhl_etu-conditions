# ETU Conditions: working notes

Read this first in any new session. The design, the conditions, and open decisions live in `docs/SCOPE.md` (Draft 3).

## What this is

A Foundry VTT **v14** module (ID `fhl-etu-conditions`, CSS prefix `etu-`) for a Cypher System hack about Ether-Tech units (ETUs). It tracks the hack's conditions (Temperature, Target Lock, Jammed, Recoil, Hacked) and lets players set them from a radial token menu, with pips above tokens. Players handle their own conditions; the module does not interpret rolls. Plain ES modules, no build step. Version 0.5.0.

Targets: Foundry v14, Cypher System 3.5.x (`cyphersystem`, verified on 14.360).

**Scope decision (2026-09-30):** the main thing is the main thing. Roll automation, the weapon model (per-weapon Recoil rules, Signal, Drain), and damage types are parked; Draft 2 of `docs/SCOPE.md` in git history holds those designs. Don't rebuild them unless the user asks. If they return, it's as one-click suggestions, never auto-applied changes.

Verified in Foundry by the user: pips on PC and unlinked NPC tokens; macro API; radial menu opens on right-click and all rings click through; Shift + right-click opens Foundry's HUD; right-drag panning still works; the table used the ring for a full Silver Hail spin-up and called it smooth.

Not yet tested in Foundry: Mount on item sheets; connection-loss recovery; the mod frame and gliding dividers; high contrast. The look was reviewed by the user and table in the live preview (https://claude.ai/artifact/2RKzhyr5YUuKpYhtbDZztm), which runs the real ring code bundled with esbuild in the session scratchpad (not in the repo).

Next: GM-defined conditions (SCOPE §3.8), the Recoil cap question, then a v1.0 release.

## Working with the user

- The user has dyslexia: keep replies concise, plain, and forward-stated.
- Say what was verified and what wasn't. Nothing here can run inside Foundry; the user tests in their own v14 world and reports back. Ask for console errors (F12) when something breaks. `docs/TESTING.md` holds the test steps and macros.
- The user shares table conversations as design input; distill intent from them rather than taking every idea as a build request.
- Commit and push after each coherent slice. Don't open a PR unless asked.

## Commands

```sh
npm run check   # lint + load + rules. Run before every push.
npm run load    # imports every module file with Foundry mocked and runs init
npm run rules   # condition store, item systems, right-click routing, string keys
npm run contrast # WCAG AA for ring/pip text in both palettes; JS colours must match CSS tokens
npm run preview # real radial menu in Chromium with Foundry mocked; screenshots to tools/out/
                # set CHROMIUM_PATH (here: /opt/pw-browsers/chromium)
```

## Design rules

- **Everything is manually steppable.** The module tracks and shows; it never applies rules or blocks actions.
- **Version-sensitive Foundry and Cypher System calls go only in `scripts/compat.js`.** That includes PIXI drawing.
- **Right-click:** extend whatever `CONFIG.Token.objectClass` holds at `init` (the Cypher System sets `CypherSystemToken`). Never replace it outright. Shift + right-click calls `super` to open Foundry's HUD.
- **Pools:** Frame = Might, Reactor = Speed, Strain = Intellect in the system's data.
- **Storage:** one Active Effect per unit condition, found by status ID (`etu-temperature`, `etu-target-lock`, `etu-jammed`, `etu-recoil`), level in `flags.fhl-etu-conditions.level`, `showIcon` NEVER (our pips show levels). Hacked is `flags.fhl-etu-conditions.hack` on the system's host item. Mount is `flags.fhl-etu-conditions.mount` on the item.
- **Cypher tags are read-only to us.** Toggling a tag archives items; never toggle one.
- **All writes for one actor go through the queue in `store.js`,** read and write in one step, with a time limit.
- **Ring icons are our own SVG symbols** (`scripts/icons.js`), not Foundry files or fonts, so they match everywhere.
- **Motion respects reduced-motion.** Animations live in CSS; `motionAllowed()` skips the furl delay and the divider glide (SMIL `<animate>`, which CSS can't switch off).
- **Gold means nothing special.** A gold highlight on submenu wedges read as "important" to players. "Opens another ring" is an outward double chevron in the frame's colour.
- **Colours:** condition colours live in `PALETTES` (conditions.js), per player via the `contrast` setting. Filled gauge cells compute their fill and label colour in JS (`color.js`); `SURFACE`/`LABEL` there must match the CSS tokens, which `npm run contrast` checks.
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
- A write sent while the connection drops may never answer. The per-actor queue gives each write a time limit and resets on reconnect; without that, every later write for the unit hung until a reload.
- During a ring transition the old ring stays in the DOM for ~200 ms with `data-act` attributes. Tests and selectors should target `.etu-layer` (the live ring).

## Map

| Path | Role |
|---|---|
| `scripts/main.js` | init/ready hooks, token draw/refresh hooks, document hooks that redraw pips and the ring |
| `scripts/compat.js` | **only** place for version-sensitive APIs (PIXI, tokens, right-click, HUD, socket) |
| `scripts/conditions.js` | condition registry, temperature scale, status effect registration |
| `scripts/store.js` | read/write levels and hack ratings, per-actor write queue with time limit, permissions |
| `scripts/api.js` | public macro API (`game.modules.get(id).api`), incl. `diagnose()` |
| `scripts/items.js` | which items are systems: mount, Hack host, Cypher Card Sheet links |
| `scripts/item-sheet.js` | "ETU system" Mount setting in the Cypher item sheet's Settings tab |
| `scripts/pips.js` | condition pips drawn above tokens (min 20 screen px tall at any zoom) |
| `scripts/radial.js` | radial token menu: rings, gauges, keys, wheel, paging, readout, transitions |
| `scripts/icons.js` | line icons for the ring (incl. flame/snowflake by intensity) and the frame's plate gradients |
| `scripts/color.js` | luminance, contrast, mixes, and readable label choice for filled cells |
| `scripts/settings.js` | player edit rights per condition, pip toggle |
| `styles/etu.css` | ring styles, mod frame, dividers, furl/unfurl, high contrast; colours via `--etu-*` tokens |
| `tools/` | Foundry mock, load check, store/item/routing checks, Chromium ring preview |
| `docs/SCOPE.md` | scope, conditions, spec, open decisions |
| `docs/TESTING.md` | install notes, test steps, and macros for the user |
| `docs/mockups/radial-menu.html` | the original clickable mockup |
