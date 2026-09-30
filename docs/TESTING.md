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
5. As a player (a user who owns a unit): every condition changes on units they own. The GM can make any condition GM-only in Module Settings; then players get a warning instead.
6. **Show condition pips on tokens** (Module Settings) hides and shows the pips.
7. No errors in the console (F12). If something breaks, a screenshot of the console helps most.

Optional check: `canvas.tokens.controlled[0].actor.statuses` should list IDs like `etu-temperature` while a condition is on.

## Milestone 3 checks: radial menu

Right-click a token you own.

1. A ring opens around the token: Thermal, Signal, Recoil, Hacked, Clear all, Token. Values show on the slices (e.g. HOT, 4).
2. Click Signal, then Target Lock: a gauge ring of 0–10. Click a cell to set it; the pip above the token updates.
3. Mouse wheel over a gauge, or over Thermal/Recoil on the first ring, nudges ±1. The canvas should not zoom while you do this.
4. Esc, right-click on the ring, or clicking the token in the middle goes back one ring; at the first ring it closes. Clicking elsewhere closes it.
5. Keys 1–9 pick slices; ← → step a gauge. These should not fire your hotbar macros while the ring is open.
6. Shift + right-click opens Foundry's normal Token HUD. Token → Foundry HUD does the same.
7. Select two tokens, right-click one of them, set a condition: both change. The breadcrumb says "2 selected".
8. Hacked lists the unit's systems (see "Which items are systems" below). More than seven adds a "More" slice that pages.
9. Pan and zoom with the ring open: it follows the token and stays the same size.
10. As a player: conditions the GM made GM-only look dimmed and show a warning when clicked.

## Ring look and motion

Live preview to compare against: https://claude.ai/artifact/2RKzhyr5YUuKpYhtbDZztm

1. Each wedge shows a faint icon behind its label (the Thermal wedge shows a flame or snowflake when Hot or Cold). Hacked systems with their own card art show that instead. Hovering a wedge brightens its texture a little.
2. Opening, including the very first time after a reload: wedges unfurl outward from the token, one after another.
3. Classic style (default): every wedge outlined; Signal, Hacked, and Token (they open another ring) outlined in gold.
4. Module Settings → **Ring style** → Mod frame: a metal rim round the wheel with a chevron and small tabs at every wedge break, gold dividers with a bright point gliding outward, and an outward double chevron over Signal, Hacked, and Token.
5. Module Settings → **Ring and pip colours** → High contrast: mint instead of gold (outlines, badges, breadcrumb), bolder condition colours, solid pips with dark text; in Mod frame, a green frame with mint gliding dividers. Each player picks their own style and colours.
6. Drilling into Signal: the first ring opens outward and fades while the Signal ring unfurls. Esc: the Signal ring furls into the center while the first ring settles back in.
7. Gauge rings sweep their cells in around the arc; the gap at the bottom shows the condition's icon above "back". Temperature cells carry flames and snowflakes.
8. Closing (Esc at the first ring, or clicking elsewhere) furls the ring into the center.
9. Clicking quickly during an animation still lands on the new ring.
10. With your OS set to reduce motion, the ring appears and changes instantly and the dividers don't glide.

## Which items are systems

Open a weapon, gear, armor, or artifact item on a unit. Its **Settings** tab has an **ETU system** section with one setting, **Mount**.

**Mount** decides whether the item is a system (it then appears under Hacked). "Auto" shows what the module detected. In order it checks:
1. this setting (Hard Point, Sensor, Bay, or "Not a system");
2. a Cypher System tag on the item named Hard Point, Sensor(s), or Bay;
3. the item's own name (e.g. "Missile Bay", "Sensor Suite").

Best practice for new items: give the unit tags named **Hard Point**, **Sensors**, and **Bay**, tag each system, and **keep those tags switched on**. The Cypher System archives tagged items whose tags are all off whenever any tag is toggled. This module only reads tags; it never toggles them.

Checks:
1. Hacked lists only mounted systems (and anything already hacked), with HP / SNS / BAY under each name. Knives, rations, and jackets don't appear.
2. A Card Sheet linked pair (e.g. Silver Hail artifact + Silver Hail attack) appears once. Hacking it shows on both; the attack's sheet says its mount and Hack rating live on the artifact.
3. Setting Mount to "Not a system" removes an item from Hacked, even if its name says "Bay".
