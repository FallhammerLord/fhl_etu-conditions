# ETU Conditions: working notes

Read this first in any new session. The full design, rules, and open decisions live in `docs/SCOPE.md`.

## What this is

A Foundry VTT **v14** module for a Cypher System hack about Ether-Tech units (ETUs). It tracks the hack's conditions (Temperature, Target Lock, Jammed, Recoil, Hacked, plus Drain), sets them from a radial token menu, and pre-fills the Cypher System All-in-One roll dialog. Plain ES modules, no build step. Nothing is built yet; the status is spec plus mockup.

Targets: Foundry v14, Cypher System 3.5.x (`cyphersystem`, verified on 14.360).

## Working with the user

- The user has dyslexia: keep replies concise, plain, and forward-stated.
- Say what was verified and what wasn't. Nothing here can run inside Foundry; the user tests in their own v14 world and reports back. Ask for console errors (F12) when something breaks.
- Commit and push after each coherent slice. Don't open a PR unless asked.

## Design rules

- **Track, don't enforce.** Never block a roll or an action. Every pre-filled modifier is visible and can be unchecked.
- **Version-sensitive Foundry and Cypher System calls go only in `compat.js`.**
- **Right-click:** extend whatever `CONFIG.Token.objectClass` holds at `init` (the Cypher System sets `CypherSystemToken`). Never replace it outright. Shift + right-click calls `super` to open Foundry's HUD.
- **Pools:** Frame = Might, Reactor = Speed, Strain = Intellect in the system's data.
- **Visual modules are optional** and sit behind an adapter that fails quietly.

## Lessons carried over from the Fallhammer Quest Log

- One bad import stops the whole module in Foundry, and ESLint won't catch it. Keep a load check that imports every file with Foundry mocked.
- Don't rely on Handlebars `eq`/`and`/`or`; compute booleans in JS.
- GM-relayed requests (`CONFIG.queries`) don't know who sent them. Re-check everything against the named user.
- Colors only through CSS tokens.

## Map

| Path | Role |
|---|---|
| `docs/SCOPE.md` | scope, rules as implemented, spec, milestones, open decisions |
| `docs/mockups/radial-menu.html` | clickable radial menu mockup (open in a browser) |
