# ETU Conditions: Scope and Spec

Draft 2, 2026-09-30. Repo: https://github.com/FallhammerLord/fhl_etu-conditions

A Foundry VTT v14 module for a Cypher System hack about Ether-Tech units (ETUs), built to make J:A's conditions cheap to apply and use. Weapons and armor carry properties and rules; rolls apply what they can get right and prompt for the rest; a radial token menu handles manual fixes.

Mockup: https://claude.ai/artifact/RhASweXS8WdvpJD4wg1Czg (source: `docs/mockups/radial-menu.html`)

---

## 1. Principles

1. **Track, don't enforce.** The module records conditions and fills in the roll dialog. It never blocks a roll or refuses an action.
2. **Automate only what it can get right; prompt for the rest.** A wrong automatic value becomes a correction players make every round, which is worse than doing it by hand. Anything that needs judgment (did it hit? clear Recoil now?) is a button, not an automatic action.
3. **Every automatic value can be seen and dropped.** Each pre-filled modifier appears as its own line with a checkbox.
4. **The roll is the main path; the radial menu is for cleanup and manual application.** Foundry's own Token HUD stays one keystroke away (Shift + right-click).
5. **GMs define the lists.** Conditions, damage types, and armor types are world data the GM edits, with the hack's defaults as a starting point.
6. **Visual effects are optional.** Rules work with no visual modules installed. A broken visual module never breaks tracking.
7. **Version-sensitive Foundry and Cypher System calls live in one file** (`compat.js`).

## 2. Scope

**Done (verified in Foundry unless noted)**
- Conditions: Temperature, Target Lock, Jammed, Recoil, Hacked, stored per unit; pips on tokens.
- Radial token menu with drill-down rings and gauge rings; Shift + right-click for Foundry's HUD.
- Item tags: mount (Hard Point, Sensor, Bay), Recoil rating, Signal, Drain; Cypher Card Sheet linked pairs as one system. *(Not yet tested in Foundry.)*
- Macro API: `game.modules.get('fhl-etu-conditions').api`.

**Next**
- The weapon model (§3.9): properties, rules, and effects on attack and armor items.
- GM-defined lists (§3.10): conditions, damage types, armor types.
- Roll integration (§6): pre-fill; self-Recoil and the Recoil Control prompt on fire; "Apply to target" for on-hit effects; Drain.

**Later**
- Damage types, armor penetration, and armor types applied to damage (§3.11).
- Visual adapter: Token Magic FX, Sequencer + JB2A (free).
- Jammed secondary effects stored per jammer source.
- Showing conditions on the Cypher Card Sheet.
- An upstream hook in the Cypher System roller.

**Out**
- Deciding whether an attack hit. The GM decides; the module offers buttons.
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

### 3.5 Recoil (revised 2026-09-30)
- **Only ranged weapons incur Recoil.** Each ranged weapon has a Recoil rating; the defaults by size are Light 2, Medium 4, Heavy 6, Capital 8. A weapon's rules can change its rating shot to shot (Silver Hail: 6, then 3, then 1).
- **Stacking:** each attack adds that shot's Recoil to the unit's current Recoil.
- **Effect:** the unit's Hard Point attacks are hindered by its current Recoil.
- **Recoil Control:** as part of firing, the unit may make a Frame test; its result is subtracted from the current Recoil.
- **Clearing:** after a full round in which the unit didn't fire, Recoil is ready to clear. The module offers a **Clear Recoil** button; it never clears on its own. Clearing also resets per-shot sequences such as Silver Hail's. *(Assumed; confirm.)*
- **Inflicted Recoil:** some weapons give Recoil to their target on a hit (§3.9 effects).
- **Low gravity:** the unit gets an Asset on the Recoil Control test.
- **Zero gravity:** the unit may instead be pushed back (30 m × the shot's Recoil, opposite to the shot) and take no Recoil from that shot.
- **Tandem pilots:** Heavy units with tandem pilots count Recoil across both pilots' turns.
- **Design intent:** Recoil keeps ranged weapons from being the default best choice, since melee has no equivalent. In this game, difficulties of 7+ are reachable.

### 3.6 Hacked
Belongs to one system (a Hard Point, Sensor, or Bay) and carries a Hack rating. Using a hacked system first takes a Reactor test against the rating. On a failure, the system doesn't work.

An artifact and the items linked to it by the Cypher Card Sheet are one system: hacking the artifact hacks every linked card.

A weapon that inflicts Hacked can hit any mounted system: the effect names how the system is picked (attacker's choice, random, or GM's pick).

### 3.7 Drain and Deep Well
- **Drain N:** a feature with Drain N takes N points from its pool. Edge doesn't reduce it.
- **Deep Well:** an optional advancement tied to one pool. While that pool is above 90% of its maximum, Drain costs from it are 1 lower. Each extra pick for the same pool widens the threshold by 10% (90% → 80% → …).

### 3.8 Which items are systems (item tags)
- **Mount** (Hard Point, Sensor, Bay) comes from, in order: the item's ETU setting; a Cypher System tag named Hard Point, Sensor(s), or Bay; the item's name. Cypher tags are read, never toggled. Best practice: keep mount tags switched on, because toggling any tag archives items whose tags are all off.
- **Signal** (Source/Reliant, type, level) and **Drain** (pool, amount) are ETU settings on the item.
- A linked pair reads all of these from the whole pair, artifact first.

### 3.9 The weapon model: properties, rules, effects (new)

**Properties** are named values on attack and armor items.

| Property | On | Example |
|---|---|---|
| Ranged | attacks | yes / no |
| Recoil | ranged attacks | 6 (default from size) |
| Damage type | attacks | Kinetic, or several |
| Armor penetration (AP) | attacks | 2 |
| Armor type | armor | Plated |
| Armor ratings by damage type | armor | Thermal (Hot) 2 |

**Rules** change a property when something happens. Each rule has:
- a **trigger**: on fire, on each consecutive shot, on hit;
- an **operation**: add, subtract, multiply, divide (with rounding: down, up, nearest), or set;
- a **value**.

Silver Hail: Recoil 6; on each consecutive shot, multiply Recoil by ½, rounding down → 6, 3, 1. The shot count resets when Recoil clears.

**Effects** are what a weapon does to someone:
- **Self, on fire:** add this shot's Recoil. Applied automatically, followed at once by the Recoil Control prompt.
- **Target, on hit:** change a condition (Temperature ±N, Recoil +N, Hacked N with a system pick, Prone, or any GM-defined condition). Offered as an **Apply to target** button on the chat card, because only the GM decides a hit.

**Escape hatch:** a weapon can name a macro for behavior the fixed set can't express. The macro receives the attack's roll data, the attacker, and the targets.

### 3.10 GM-defined lists (new)
- **Conditions:** the built-in five plus any the GM adds (for example Prone). Each has a name, a range (on/off or a level range), a color, and an icon. Built-ins keep their rules; added conditions are tracked and shown, with rules text as a readout note.
- **Damage types:** open-ended, and types can have a parent, so new types branch off existing ones. Seed list: Kinetic, Explosive, Thermal (Hot), Thermal (Cold), Fusion, Liminal, Etheric. Thermal (Hot) and Thermal (Cold) share the parent Thermal.
- **Armor types:** open-ended, same shape.

Edited from Module Settings in a small list editor; stored as world settings.

### 3.11 Damage application (later)
Damage type vs armor type and AP act where the Cypher System applies damage to pools. The interaction table (resist, vulnerable, AP subtracting armor) is for the GM to define with the lists. Shape to be decided when that milestone starts.

## 4. Data model

| Thing | Stored as |
|---|---|
| Unit conditions | One Active Effect per condition on the actor: `statuses: [id]`, `flags.fhl-etu-conditions.level`. Recoil also stores `lastFired {combat, round}` and per-weapon shot counts. |
| Hacked | `flags.fhl-etu-conditions.hack` on the system's host item |
| Item tags | Item flags: `mount`, `recoil`, `signalRole`, `signalType`, `signalLevel`, `drainPool`, `drainAmount` |
| Weapon model | Item flags: `properties {…}`, `rules [{trigger, property, op, value, round}]`, `effects [{when, who, condition, amount, pick}]`, `macro` |
| GM lists | World settings: `conditions`, `damageTypes`, `armorTypes` (each `[{id, name, parent?, …}]`) |
| Deep Well | Actor flag `deepWell {frame, reactor, strain}` = number of picks |

The Cypher System uses no Active Effects, so nothing conflicts. Each condition is registered in `CONFIG.statusEffects`.

## 5. Radial menu

**Opening and closing**
- Right-click a token: the ring opens around it when the button is released. A right-drag still pans.
- Shift + right-click: Foundry's Token HUD opens.
- Click the token in the center, press Esc, or right-click the ring: back up one ring. At the root, this closes the menu.
- Click outside the ring: close.

**Root ring:** Thermal, Signal (Target Lock, Jammed), Recoil, Hacked (one gauge per system), Token (Target, Combat, Hide/Reveal, Foundry HUD), Clear all. GM-defined conditions will get their own ring.

**Rules**
- **Size:** at most 8 slices per ring and 2 levels deep. A long list gets a "More" slice.
- **Gauge ring:** a 270° arc of level cells. Clicking a cell sets the level. Temperature's arc runs blue → gray → red.
- **Mouse wheel** over a condition or gauge nudges it ±1. Keys 1–9 pick a slice; ← → step a gauge.
- **Multi-select:** changes apply to every selected token.
- **Screen size:** constant at every zoom; moves inward near screen edges.
- **Permissions:** opens on tokens the user owns; which conditions players may edit is a setting.
- **Connection loss:** a save that gets no answer (e.g. a dropped connection) is abandoned after a time limit with a warning, so later changes still save.

## 6. Roll integration

Findings from Cypher System v3.5.2 (verified on Foundry 14.360):
- The roll data has `difficultyModifier` + `easedOrHindered` (steps), `poolPointCost` (flat cost), and `baseDifficulty`, plus an Impaired-style "+1 cost per Effort" term; Temperature has the same shape.
- There's no pre-roll hook. The dialog is `RollEngineDialogSheet` (AppV1); it fires `renderRollEngineDialogSheet`, and `_updateObject` runs just before the math.
- A post-roll hook exists: `Hooks.call("rollEngine", actor, data)`.

**Pre-fill (dialog render)**
- The attacker is the rolling PC; the target is the user's first targeted token; the weapon is `data.itemID`.
- Optical/Signal toggle, forced to Signal for Reliant items.
- Modifier lines, each with a checkbox: Target Lock vs Jammed (§3.4); current Recoil on Hard Point attacks; Temperature cost per Effort; a Hacked warning with a "Roll Reactor vs N" button.
- At submit, checked lines merge with what the user typed; the module never overwrites the user's own entries.
- Rolls that skip the dialog get a chat card listing the conditions that were not applied.

**Post-roll (`rollEngine` hook)**
- **Firing a ranged weapon:** work out this shot's Recoil from the weapon's rules, add it to the unit's Recoil, and post the Recoil Control prompt (with the low-gravity Asset; zero-gravity push-back as an alternative). The prompt's result is subtracted when rolled.
- **On-hit effects:** an **Apply to target** button on the chat card for each target effect.
- **Drain:** pay Drain from the item's pool without Edge, minus 1 under Deep Well.
- **Recoil clearing:** on `updateCombat`, when a unit finishes a round without firing, its Recoil pip is marked "ready to clear" and a **Clear Recoil** button appears (chat card and radial menu).

**Upstream.** Ask the Cypher System author for a `preRollEngineComputation` hook, which would remove the `_updateObject` wrapper and the skip-dialog gap.

## 7. Foundry v14 integration points

| Point | Status |
|---|---|
| `Token#_onClickRight` is the right-click entry point; handled clicks must stop propagation like core, or the canvas starts a right-drag pan | verified in world |
| v14 reports a token right-click on release; the ring handles press or release | verified in world |
| The Cypher System sets `CONFIG.Token.objectClass`; we extend the class at `init` | verified in world |
| `module.json` is read at world launch only; the module loads its stylesheet itself if missing | verified in world |
| Cypher item sheets are AppV1 (`renderCypherItemSheet`); fields named by flag path save through the system's form | proven by the Cypher Card Sheet; not yet tested for this module |

## 8. Visual adapter (later)
Presets per condition (frost or heat haze by Temperature, glitch for Jammed and Hacked, reticle for Target Lock, shake on Recoil), each checking that its module is active and failing quietly. Off by default.

## 9. Settings
- Which conditions players may edit on units they own.
- Condition pips on or off (per player).
- GM lists: conditions, damage types, armor types.
- Default Recoil ratings by weapon size.
- Visual presets, per condition.

## 10. Milestones
1. ~~Skeleton~~ done.
2. ~~Conditions and pips~~ done.
3. ~~Radial menu~~ done.
4. ~~Item tags~~ written; awaiting a Foundry test.
5. **Robustness and Recoil rules:** connection-loss recovery; stacking Recoil.
6. **GM lists:** conditions (incl. added ones), damage types, armor types, with a settings editor.
7. **Weapon model:** properties, rules, effects, macro hook, edited on the item.
8. **Roll integration:** pre-fill; on-fire Recoil and Recoil Control prompt; Apply to target; Drain; Clear Recoil prompt.
9. **Damage application:** types, AP, armor.
10. **Visual adapter,** then docs and release.

Each milestone ends with a test pass in the user's own v14 world.

## 11. Open decisions
1. **Recoil Control "result":** the difficulty level the Frame roll beat after easing (recommended), or the raw roll ÷ 3?
2. **Clearing Recoil:** confirm that clearing also resets per-shot sequences (Silver Hail).
3. **Thermal Management success:** one step, or back to Normal?
4. **NPC ambient damage from Temperature:** how much, and when?
5. **Target Painter:** how much Lock does a success apply?
6. **Tandem pilots:** how does "a round without firing" count across both pilots?
7. **Damage vs armor:** the interaction table's shape (§3.11).
8. **Armor cost on Reactor:** does armor's extra Effort cost landing on Reactor stand?
