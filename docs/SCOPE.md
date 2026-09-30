# ETU Conditions: Scope and Spec

Draft 3, 2026-09-30. Repo: https://github.com/FallhammerLord/fhl_etu-conditions

A Foundry VTT v14 module for a Cypher System hack about Ether-Tech units (ETUs). It tracks the hack's conditions on tokens and lets players set them quickly from a radial token menu. Players handle their own conditions; the module does not interpret rolls.

Mockup: https://claude.ai/artifact/RhASweXS8WdvpJD4wg1Czg (source: `docs/mockups/radial-menu.html`)

---

## 1. Principles

1. **The main thing is the main thing:** apply and track this genre's conditions, quickly and reliably. Anything else earns its place by making that easier.
2. **Players handle their own conditions.** The module tracks and shows; it doesn't apply rules or decide outcomes.
3. **Everything is manually steppable.** Every value can be set, nudged, or cleared by hand.
4. **GMs define the lists.** The hack's conditions ship built in; the GM can add more.
5. **Visual effects are optional** and fail quietly.
6. **Version-sensitive Foundry and Cypher System calls live in one file** (`compat.js`).

## 2. Scope

**Done (verified in Foundry unless noted)**
- Conditions Temperature, Target Lock, Jammed, Recoil, and Hacked, stored per unit; pips above tokens.
- Radial token menu: drill-down rings, gauge rings, wheel and keys, multi-select, Shift + right-click for Foundry's HUD.
- Mount on items (Hard Point, Sensor, Bay) for Hacked; Cypher Card Sheet linked pairs as one system. *(Not yet tested in Foundry.)*
- Connection-loss recovery for saves. *(Not yet tested in Foundry.)*
- Ring icons and furl/unfurl animation. *(Not yet tested in Foundry.)*
- Macro API: `game.modules.get('fhl-etu-conditions').api`.

**Next**
- GM-defined conditions (§3.8).
- Recoil cap: confirm whether Recoil can exceed 10.
- v1.0 release.

**Later (optional)**
- Visual adapter: Token Magic FX, Sequencer + JB2A (free).
- Showing conditions on the Cypher Card Sheet.

**Parked** (decided 2026-09-30: not needed; the table handles conditions from the ring)
- Roll dialog pre-fill and post-roll automation.
- The weapon model: Recoil ratings per weapon, per-shot rules, Signal and Drain fields, on-hit effects.
- Damage types, armor penetration, and armor types.

Draft 2 of this file (git history) holds the parked designs if they return, most likely as a separate add-on offering one-click suggestions, never auto-applied changes.

## 3. The conditions

The readout under the ring shows each condition's rules text as a reminder; the module does not apply these rules.

Pools: Frame = Might, Reactor = Speed, Strain = Intellect in the Cypher System's data.

### 3.1 Temperature
One value per unit, from −3 (Freezing) to +3 (Overheating).

| Value | Name | Reminder |
|---|---|---|
| +3 | Overheating | Reactor and Frame: +3 cost per level of Effort |
| +2 | Hot | Reactor: +1 cost per level of Effort |
| +1 | Warm | none |
| 0 | Normal | none |
| −1 | Chill | none |
| −2 | Cold | Reactor: +1 cost per level of Effort |
| −3 | Freezing | Reactor and Strain: +3 cost per level of Effort |

NPCs and Companions away from Normal take ambient damage instead.

### 3.2 Target Lock
0–10 on the target. Signal attacks against it are eased by the lock, minus the attacker's Jammed level.

### 3.3 Jammed
0–10 on the unit. Signal-reliant tasks are hindered by the level; signals at or below it fail. Against Target Lock: a lock above the jam eases by the difference; otherwise the full jam hinders.

### 3.4 Recoil
0–10 on the unit (cap under review). Each ranged shot adds that weapon's Recoil; a Recoil Control test subtracts its result. Hard Point attacks are hindered by the current Recoil. After a round without firing, the player clears it.

### 3.5 Hacked
A Hack rating on one system (Hard Point, Sensor, or Bay). Using it takes a Reactor test against the rating first. A Cypher Card Sheet linked pair (artifact + attack) is one system: hacking either hacks both.

### 3.5a Hacked on the Cypher Card Sheet
When a character uses the Cypher Card Sheet, each hacked system's card gets an overlay: a hazard hatch and outline in the Hacked colour, and a "HACKED n" stamp across the middle, turned 45 degrees like a rejected stamp on a document. The stamp sits under the card's own text (which has a dark outline), so name and value stay readable; it lets clicks through to the card. Unhacked cards are untouched. Linked cards read the artifact's rating, so both halves of a pair show it. This gives Hacked an obvious home beyond the token's "H1" pip.

### 3.6 Which items are systems
Mount comes from, in order: the item's ETU setting (Settings tab); a Cypher System tag named Hard Point, Sensor(s), or Bay; the item's name. Cypher tags are read, never toggled. Best practice: keep mount tags switched on, because toggling any tag archives items whose tags are all off.

### 3.7 Permissions
Every condition is player-editable on units the player owns, by default. Each can be made GM-only in Module Settings.

### 3.8 GM-defined conditions (next)
The GM adds conditions in Module Settings: name, kind (on/off or a level range), color, icon, and a reminder note. Each gets a slice in the ring (in a "More conditions" ring once there are several), a pip on tokens, and its note in the readout. The five built-ins stay as they are.

## 4. Data model

| Thing | Stored as |
|---|---|
| Unit conditions | One Active Effect per condition on the actor: `statuses: [id]`, `flags.fhl-etu-conditions.level`, core icon hidden |
| Hacked | `flags.fhl-etu-conditions.hack` on the system's host item |
| Mount | `flags.fhl-etu-conditions.mount` on the item (blank = auto) |
| GM conditions | World setting: `[{id, name, min, max, color, icon, note}]` (next) |

## 5. Radial menu

**Opening and closing**
- Right-click a token: the ring unfurls around it when the button is released. A right-drag still pans.
- Shift + right-click: Foundry's Token HUD.
- Click the token in the center, press Esc, or right-click the ring: back up one ring. At the root, the ring furls closed.
- Click outside: the ring furls closed.

**Look** (reviewed by the user and table, 2026-09-30). Two ring styles, per player (Module Settings → Ring style):
- **Classic (default, the table's favourite):** every wedge outlined; wedges that open another ring outlined in the accent colour (gold; mint in high contrast).
- **Mod frame (optional),** after Warframe's mod borders: one metal plate rim around the whole wheel (the Cypher Card Sheet's plate gradient) and a thin plate rim round the centre. Wedges have no outlines of their own.
- **At every wedge break:** a chevron on the frame pointing in, a small tapered tab out of the frame, and one in from the centre rim.
- **Dividers:** one gold gradient line per break, with a bright point that glides from the centre to the rim, staggered round the ring (about 12.8 s per lap).
- **"Opens another ring":** an outward double chevron on the frame over the wedge, in the frame's own colour. Gold highlights were tried and dropped: players read them as "important".
- **Textures:** each wedge carries a faint line icon, or the system's own card art on Hacked. Temperature uses flames and snowflakes that grow more elaborate with distance from Normal.
- **Motion:** opening and drilling down unfurl the wedges outward in sequence; drilling up settles the parent ring back in while the child furls into the centre; paging turns the wedges; closing furls the ring away. Gauge cells sweep in around the arc.
- **Reduced motion** turns off all animation, including the divider glide.

**Contrast** (Module Settings → Ring and pip colours, per player)
- **Standard:** the Cypher Card Sheet's dark theme colours.
- **High contrast:** mint accent in place of gold; colour-blind-friendly Okabe-Ito condition colours, with Temperature's blue-to-orange scale kept apart from the other conditions; the Card Sheet's high-contrast green frame with mint edges and dividers; solid pips with dark text; brighter labels; textures kept.
- Every label, value, pip, and filled gauge cell is checked at WCAG AA (4.5:1) in both palettes by `npm run contrast`. Filled cells pick light or dark text per fill.

**Behavior**
- Root ring: Thermal, Signal (Target Lock, Jammed), Recoil, Hacked (one gauge per system), Clear all, Token (Target, Combat, Hide/Reveal, Foundry HUD).
- At most 8 slices per ring; longer lists page with "More".
- Gauge cells set a level on click; the wheel nudges ±1; keys 1–9 pick slices; ← → step a gauge.
- Changes apply to every selected token.
- The ring keeps a constant size at every zoom and moves inward near screen edges.
- A save that gets no answer (dropped connection) is abandoned after 8 seconds with a warning; the save queue resets on reconnect.

## 6. Foundry v14 integration points

| Point | Status |
|---|---|
| `Token#_onClickRight` is the right-click entry point; a handled click must stop propagation like core, or the canvas starts a right-drag pan | verified in world |
| v14 reports a token right-click on release; the ring handles press or release | verified in world |
| The Cypher System sets `CONFIG.Token.objectClass`; we extend the class at `init` | verified in world |
| `module.json` is read at world launch only; the module loads its stylesheet itself if missing | verified in world |
| Cypher item sheets are AppV1 (`renderCypherItemSheet`); fields named by flag path save through the system's form | proven by the Cypher Card Sheet; not yet tested for this module |

## 7. Open decisions
1. **Recoil cap:** can Recoil exceed 10?
2. **GM conditions:** which icons to offer (a fixed set from the ring's icon style, or any image file).
3. **Armor cost on Reactor:** the system charges armor's extra Effort cost to Speed, which is Reactor here. Keep?
