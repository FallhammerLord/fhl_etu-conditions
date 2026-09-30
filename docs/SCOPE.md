# ETU Conditions: Scope and Spec

Draft 1, 2026-09-30. Repo: https://github.com/FallhammerLord/fhl_etu-conditions

A Foundry VTT v14 module for a Cypher System hack about Ether-Tech units (ETUs). It tracks the hack's conditions on tokens, sets them from a radial token menu, and pre-fills the Cypher System All-in-One roll dialog.

Mockup: https://claude.ai/artifact/RhASweXS8WdvpJD4wg1Czg (source: `docs/mockups/radial-menu.html`)

---

## 1. Principles

1. **Track, don't enforce.** The module records conditions and fills in the roll dialog. It never blocks a roll, refuses an action, or rolls on its own.
2. **Every automatic value can be seen and dropped.** Each pre-filled modifier appears as its own line with a checkbox.
3. **The radial menu is the main way to apply conditions.** Foundry's own Token HUD stays one keystroke away (Shift + right-click).
4. **Visual effects are optional.** Rules work with no visual modules installed. A broken visual module never breaks tracking.
5. **Version-sensitive Foundry and Cypher System calls live in one file** (`compat.js`), the same pattern as the Fallhammer Quest Log.

## 2. Scope

**In (v1)**
- Conditions: Temperature, Target Lock, Jammed, Recoil, Hacked.
- Drain and Deep Well cost handling.
- A radial token menu with drill-down rings and gauge rings.
- Status pips on tokens at rest.
- Roll dialog pre-fill, including the Optical/Signal firing choice.
- Post-roll steps:
  - apply Recoil after a Recoil weapon fires;
  - offer the Frame mitigation test;
  - expire Recoil;
  - pay Drain.
- Item tags: Signal (Source/Reliant, type, level), Recoil rating, mount type (Hard Point, Sensor, Bay), Drain.
- A macro API: `game.modules.get(id).api` with `set`, `adjust`, `get` and `clear`.

**Later**
- Visual adapter: Token Magic FX, Sequencer + JB2A (free).
- Jammed secondary effects stored per jammer source.
- Showing conditions on the Cypher Card Sheet.
- An upstream hook in the Cypher System roller.

**Out**
- Automatic success/failure decisions.
- NPC rolls (Cypher NPCs don't roll; they matter as targets).
- Replacing Foundry's Token HUD for other modules.

## 3. Rules as implemented

Pools map onto Cypher's internal pools like this:

| Pool | Replaces | Role |
|---|---|---|
| Frame | Might | Durability, weapons, lifting; takes damage first |
| Reactor | Speed | Power for weapons, boosters, electronics; takes damage second |
| Strain | Intellect | Protection, mental load, etheric contact; last line |

The system charges armor's extra Effort cost to the Speed pool, so armor taxes Reactor Effort (see §11).

### 3.1 Temperature
One value per unit, from −3 to +3. Changing it takes a Thermal Management test at a level equal to the distance from Normal.

| Value | Name | Effect |
|---|---|---|
| +3 | Overheating | Reactor and Frame: +3 cost per level of Effort |
| +2 | Hot | Reactor: +1 cost per level of Effort |
| +1 | Warm | none |
| 0 | Normal | none |
| −1 | Chill | none |
| −2 | Cold | Reactor: +1 cost per level of Effort |
| −3 | Freezing | Reactor and Strain: +3 cost per level of Effort |

NPCs and Companions away from Normal take ambient damage instead.

### 3.2 Signals
- **Signal level:** the level of the signal's origin, or 1d4+2 per item.
- **Signal type:** Liminal counts +2 and Etheric +4 against Electromagnetic.
- **Roles:** an item with signals is either a Source (emits one) or Reliant (needs one).
- **Firing mode:** attacks are Optical by default and may choose Signal. A Reliant weapon is always Signal.

### 3.3 Target Lock
A level from 0 to 10 on the *target*. Signal attacks against the target are eased by that level. Establishing a lock takes a Target Painter (or similar) and a successful Reactor attack.

### 3.4 Jammed
A level on the unit.
- **Hindrance:** its Signal-reliant tasks are hindered by the Jammed level.
- **Cutoff:** Jammed is a high-water line. A signal at or below the Jammed level does not work. A stronger signal works at (its level − Jammed level).
- **Multiple jammers:** the highest level applies. Each jammer's secondary effects still apply.
- **Against Target Lock:** the net result is subtractive.
  - Lock above Jam: the attack is eased by (Lock − Jam).
  - Lock equal to or below Jam: the attack is hindered by the full Jam level.

### 3.5 Recoil
- **Ratings:** each weapon has a Recoil rating. The defaults are Light 2, Medium 4, Heavy 6, Capital 8.
- **Effect:** after firing a Recoil weapon, the unit's Hard Point attacks are hindered by the rating until the end of its next turn.
- **Several weapons in one round:** the highest rating applies; ratings do not add.
- **Mitigation:** as part of firing, the unit may make a Frame test against the rating. The test's result reduces the rating (see §11).
- **Low gravity:** the unit gets an Asset on the mitigation test.
- **Zero gravity:** the unit may instead be pushed back (30 m × rating, opposite to the shot) and take no Recoil.
- **Tandem pilots:** Heavy units with tandem pilots count Recoil across both pilots' turns.
- **Design intent:** Recoil offsets ranged weapons' safety compared with melee. In this game, difficulties of 7+ are reachable.

### 3.6 Hacked
Belongs to one system (a Hard Point, Sensor, or Bay) and carries a Hack rating. Using a hacked system first takes a Reactor test against the rating. On a failure, the system doesn't work.

### 3.7 Drain and Deep Well
- **Drain N:** a feature with Drain N takes N points from its pool. Edge doesn't reduce it.
- **Deep Well:** an optional advancement tied to one pool. While that pool is above 90% of its maximum, Drain costs from it are 1 lower. Each extra pick for the same pool widens the threshold by 10% (90% → 80% → …).

## 4. Data model

| Thing | Stored as |
|---|---|
| Temperature, Target Lock, Jammed, Recoil | One Active Effect per condition on the actor. It carries `statuses: [id]` and `flags.<mod>.level`. Recoil also stores its expiry `{combat, round, turn}`. Jammed later stores `sources: [{name, level, note}]`. |
| Hacked | Item flag `flags.<mod>.hack = rating` on the Hard Point, Sensor, or Bay |
| Item tags | Item flags: `signal {role, type, level}`, `recoil`, `mount`, `drain {pool, amount}` |
| Deep Well | Actor flag `deepWell {frame, reactor, strain}` = number of picks |

Active Effects give Foundry's own status icons and HUD toggles for free. The Cypher System uses no Active Effects, so nothing conflicts. Each condition is registered in `CONFIG.statusEffects` with an icon.

## 5. Radial menu

**Opening and closing**
- Right-click a token: the ring opens around it.
- Shift + right-click: Foundry's Token HUD opens.
- Click the token in the center, or press Esc: back up one ring. At the root, this closes the menu.
- Click outside the ring: close.

**Root ring**
- Thermal (gauge)
- Signal: a ring with Target Lock and Jammed (gauges)
- Recoil (gauge)
- Hacked: a ring with one gauge per system
- Token: a ring with Target, Combat, Hide/Reveal, and Foundry HUD
- Clear all

**Rules**
- **Size:** at most 8 slices per ring and 2 levels deep. A long system list gets a "More" slice.
- **Gauge ring:** a 270° arc of level cells, with the gap at the bottom marking "back." Clicking a cell sets the level. Cells between zero and the current level are shaded, so the arc reads as a meter. Temperature's arc runs blue → gray → red.
- **Mouse wheel** over a root-ring condition or any gauge nudges it ±1. The keys 1–9 pick a slice, and ← → step a gauge.
- **Resting state:** every slice shows its current value. Pips above the token show active conditions even when the menu is closed.
- **Readout:** a box under the ring shows the condition name, its value, and its rules text.
- **Multi-select:** changes apply to every selected token, and the breadcrumb shows the count.
- **Screen size:** the ring keeps a constant size at every zoom level and moves inward near screen edges.
- **Permissions:** the ring opens on tokens the user owns. Which conditions players may edit is a setting (§11).

**Rendering.** An HTML/SVG overlay placed over the canvas, the way Foundry's HUD container is. This is simpler than PIXI for text, keyboard focus, and CSS theming.

## 6. Roll integration

Findings from Cypher System v3.5.2, which is verified on Foundry 14.360:
- The roll data already has `difficultyModifier` + `easedOrHindered` (steps), `poolPointCost` (flat cost), and `baseDifficulty`. It also has an Impaired-style "+1 cost per Effort" term; Temperature has the same shape.
- There's no pre-roll hook. Sheets call the roll engine through direct imports, so replacing `game.cyphersystem.rollEngineMain` misses them.
- The dialog is `RollEngineDialogSheet`, an Application v1 FormApplication. It fires `renderRollEngineDialogSheet`, and its `_updateObject` runs just before the math.
- A post-roll hook exists: `Hooks.call("rollEngine", actor, data)`.

**Pre-fill (dialog render)**
- **Who is involved:** the attacker is the rolling PC; the target is the user's first targeted token. The system is `data.itemID`, and its tags decide mount, signal role, and Recoil.
- **Firing mode:** an Optical/Signal toggle in the dialog, forced to Signal for Reliant items.
- **Modifier lines**, each with a checkbox:
  - Target Lock and Jammed, per §3.4;
  - Recoil (Hard Point attacks only);
  - Temperature cost per Effort;
  - a Hacked warning with a "Roll Reactor vs N" button, which calls `rollEngineMain` with `baseDifficulty: N`.
- **Merging:** at submit, the wrapped `_updateObject` adds the checked lines to what the user typed. Our step total merges with the dialog's own modifier into one signed value. Temperature cost becomes Effort × per-Effort cost added to `poolPointCost`. The module never overwrites the user's own entries.
- **Rolls that skip the dialog** (Alt-click or the setting) get a chat card listing the active conditions that were not applied.

**Post-roll (`rollEngine` hook)**
- **After a Recoil weapon fires:**
  - offer the Frame mitigation test, pre-filled with the low-gravity Asset;
  - apply the remaining Recoil, keeping the highest rating this round;
  - set its expiry.
  - In zero gravity, offer the push-back option instead.
- **Drain:** pay Drain N from the item's pool without Edge, minus 1 under Deep Well.
- **Target Painter success:** offer to apply Target Lock to the target.
- **Recoil expiry:** watched on `updateCombat`. At the end of the unit's next turn, Recoil clears.

**Upstream.** Ask the Cypher System author for a `preRollEngineComputation` hook. With it, the `_updateObject` wrapper and the skip-dialog gap both go away.

## 7. Foundry v14 integration points

What's known here comes from community type definitions (`foundry-vtt-types` 14.366.0) and the Cypher System source. Foundry's own site is blocked in this environment.

| Point | Status |
|---|---|
| `Token#_onClickRight(event)` exists (protected) and is the right-click entry point on tokens | confirmed in v14 types |
| `CONFIG.Token.hudClass` (TokenHUD), created once in `HeadsUpDisplayContainer` | confirmed in v14 types |
| The Cypher System sets `CONFIG.Token.objectClass = CypherSystemToken` | confirmed in system source |
| The system's `init` runs before modules' `init`, so we can extend the class already set there | standard Foundry load order; confirm in world |
| Core `_onClickRight` controls the token and toggles the HUD; Shift-click passes through by calling `super` | behavior inferred; confirm in world |
| `Actor#toggleStatusEffect` and Active Effect `statuses` behave as in v12–v13 | not checked for v14 |

**Plan.** At `init`, take the current `CONFIG.Token.objectClass` and extend it. The subclass overrides `_onClickRight`: with Shift held it calls `super` (Foundry's HUD); otherwise it opens the radial menu. Chaining this way keeps the Cypher System's token ruler and any other module that also extends the class. libWrapper is the fallback if another module replaces the class later.

## 8. Visual adapter (later milestone)
- Presets per condition:
  - Temperature: frost or heat haze, scaled by value;
  - Jammed and Hacked: a glitch effect;
  - Target Lock: a reticle;
  - Recoil: a short shake when applied.
- Each preset checks that its module is active and fails quietly.
- Off by default. Each condition's effect can be switched on or off in settings.

## 9. Settings
- The radial menu replaces right-click (on by default); Shift + right-click opens the Foundry HUD.
- Which conditions players may edit on tokens they own.
- Default Recoil ratings by weapon size.
- Visual presets on or off, per condition.
- Chat card for rolls that skip the dialog (on or off).

## 10. Milestones
1. **Skeleton.** `module.json`, `compat.js`, lint + load + layout checks carried over from the quest log tooling.
2. **Conditions.** Registry, Active Effect store, status icons, token pips, macro API.
3. **Radial menu.** Rings, gauges, keys, multi-select, edge clamping, Shift pass-through.
4. **Roll pre-fill.** Dialog lines, firing mode, Hacked test button, skip-dialog card.
5. **Post-roll.** Recoil mitigation and expiry, Drain and Deep Well, Target Painter.
6. **Visual adapter.**
7. **Docs and release.** Then Card Sheet integration.

Each milestone ends with a test pass by the user in their own v14 world.

## 11. Open decisions
1. **Recoil "result":** the difficulty level the Frame roll beat after easing (recommended), or the raw roll ÷ 3?
2. **Thermal Management success:** does it move one step or all the way to Normal?
3. **NPC ambient damage from Temperature:** how much, and when (start or end of turn)?
4. **Target Painter:** how much Lock does a success apply, a fixed amount or the item's value?
5. **Player permissions:** which conditions can players set themselves? Proposed: Temperature and Recoil on their own units; the GM sets Lock, Jammed, and Hacked.
6. **Tandem pilots:** does Recoil expire at the end of the second pilot's turn?
7. **Armor cost on Reactor:** does armor's extra Effort cost landing on Reactor stand, or should it be offset?
8. **Module ID and repo:** for example `etu-conditions` with CSS prefix `etu-`.
