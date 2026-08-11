# Aenthan — Oracle CI Totem Tree Refit

**Character:** [Aenthan](https://poe.ninja/poe2/profile/Enin9-6394/runesofaldur/character/Aenthan) · League Runes of Aldur · Level 98  
**Class:** Druid → **Oracle**  
**Defense:** Chaos Inoculation · **~11,004 ES** · Mana 1,123 · Spirit 406 (283 free)  
**Offense identity:** Ancestral Bond cold totems (**Grim Pillars ~296k DPS**) + **Icestorm** off Whispering Ice · 100% crit · 458% crit multi  

Data sources: Scalpel ninja character model API (`model/92`) + decoded `pathOfBuildingExport` + PoB PoE2 `TreeData/0_5`.

---

## What your gear is already doing

Keep the tree honest to this kit — do **not** rebuild around life or armour.

| Slot | Item | Role |
|------|------|------|
| Weapon | **Corpse Bane** Dueling Wand | +5 Cold Spell, Gain as Cold, spell crit, +3 spells (rune) |
| Offhand / spirit | **Victory Call** Shrine Sceptre | Spirit for Ancestral Bond totems, aura-ish ally presence |
| Staff (set / Icestorm) | **The Whispering Ice** | +7 Cold Spells, **2% spell damage per 10 Intelligence**, socketed Icestorm |
| Body | **Loath Keep** Vile Robe | Big ES, +Spirit, ele res |
| Helm | **Foe Dome** Ancestral Tiara | ES + res |
| Gloves | **Brimstone Touch** + Cadigan jewel socket | ES stack |
| Boots | **Pandemonium Span** | MS + ES |
| Amulet | **Phoenix Charm** | +4 all Spell Skills, cast speed, %ES |
| Rings | **Rune Eye** / **Behemoth Spiral** | Cold dmg, cast speed, mana |
| Belt | **Mageblood** | Charm uptime |

Jewels are already correct thematically: **%ES + crit multi + faster ES recharge start**.

---

## The big finding: you are over-invested in crit *chance*

Oracle notable **Forced Outcome — Inevitable Critical Hits** already puts you at **100% crit**.

On the current tree these are mostly **dead weight**:

| Refund candidate | Why it is weak on *this* character |
|------------------|--------------------------------------|
| **Calculated Hunter** | +50% crit chance while you already cap crit; also **−5% skill speed** |
| **Vulgar Methods** | +30% crit chance (wasted) · **−10% max mana** · leftover Strength |
| **Controlling Magic** | +25% spell crit chance (wasted); defensive half is minor |
| **Relentless Vindicator** | Mostly generic; crit-chance line is wasted; only +5 Int is useful |
| Oracle small **Critical Hit Chance** | Same story |
| **Sigil of Lightning** | Only pays if shock is reliable; main DPS is cold Grim Pillars / Icestorm |
| **All Natural** (optional) | +5% all res while Fire/Lightning are **heavily overcapped** (+64 / +69) |
| **Cirel of Tarth's Light** (optional) | Armour→ele / accuracy package on a near-0 armour CI suit |

**Keep** crit-*damage* / multi nodes: **Barbaric Strength**, **Desensitisation**, jewel crit multi.

---

## What to spend the refunded points on (priority order)

### 1. Intelligence (Whispering Ice scaler)
You sit at **161 Int** (req ~157). Whispering Ice is **2% increased Spell Damage per 10 Int**.

Rough math at current Int: `floor(161/10)*2 ≈ 32%` spell damage from the unique line.  
Every **+50 Int** is about **+10%** more spell damage from that line alone, and also helps ES bases / mana.

**Target notables / clusters:**
- **Pure Energy** — 30% max ES · +10 Int  
- **Insightfulness** — 18% max ES · 6% increased Int · mana regen  
- **Snowpiercer** — **15% cold pen** · +10 Int  
- **Mental Alacrity** — cast speed · mana regen · +10 Int  
- **Essence Infusion** — faster ES recharge start · +12 Int  

### 2. Cold damage / pen (your real damage type)
You already have **Glaciation** (18% cold pen + gain as cold) and **Endless Blizzard** (+1 cold skills). Add:
- **Snowpiercer** (above)
- **Cold Nature** — 25% cold damage · chill duration  
- Keep **Sigil of Ice** (chilled enemies) — better than Sigil of Lightning for this kit  
- Keep **Cower Before the First Ones** only if pathing cost stays low (all-damage notable)

### 3. ES pool + recharge (CI survivability)
`EnergyShieldRegenRecovery = 0` in PoB — you live on **recharge start** (jewels already help). Tree should lean harder into:
- **Pure Energy** / **Insightfulness** / **Enhanced Barrier** (keep)  
- **Illuminated Crown** + **Ancient Aegis** (keep — amplify expensive rare ES pieces)  
- **Heavy Buffer** only if you accept **5% damage bypasses ES** for 40% max ES  
- Avoid **Zealot's Oath** unless you rebuild recovery around life regen → ES (you have no life regen)

### 4. Totem package — mostly already correct
**Keep:** Ancestral Bond, Unnamed Heartwood, Supportive Ancestors, Ancestral Conduits / Alacrity / Reach, Rustle of the Leaves, Mighty Trunk, Oracle totem speed.

**Skip / low priority:** **Spirit Bond** (totem life) — Heartwood already covers “totems linger after death.”

---

## Suggested point swap (same gear, no new uniques)

### Refund (~10–16 points depending on pathing)
1. Calculated Hunter (+ travel if it only existed for that notable)  
2. Vulgar Methods  
3. Controlling Magic  
4. Sigil of Lightning  
5. Relentless Vindicator (if path allows)  
6. Trim All Natural / Cirel if you still need points after overcap check  

### Allocate instead
1. **Snowpiercer**  
2. **Pure Energy**  
3. **Insightfulness**  
4. **Cold Nature** *or* deepen the Glaciation / Endless Blizzard wheel if cheaper  
5. **Mental Alacrity** and/or **Essence Infusion**  
6. **Erraticism** only if you want more cast speed and can tolerate −crit chance (you can — Forced Outcome)

### Weapon-set note
PoB shows **23 / 23** weapon-set-specific nodes. Put **totem cast speed / placement** on the **Victory Call (spirit sceptre)** set and **cold / Icestorm / Int** on the **Whispering Ice / wand** set so swap passives match the weapon you actually have out.

---

## Expected outcome (qualitative)

| Axis | Now | After refit |
|------|-----|-------------|
| Crit chance | 100% (Forced Outcome) | Still 100% — stop paying for it |
| Crit multi | Strong (keep Barbaric / jewels) | Same or slightly higher if jewel slots freed conceptually |
| Cold pen | Glaciation 18% | Glaciation + Snowpiercer ≈ much better vs rares/bosses |
| Int / Whispering Ice | 161 Int (~32% from unique line) | Aim 200–230+ Int |
| ES | ~11.0k | Likely **12k–13k+** if Pure Energy + Insightfulness land |
| Mana | Penalized by Vulgar (−10% max mana) | Recover that penalty |
| Totem DPS | Already the engine | Same skeleton, less wasted travel |

This is a **tree efficiency** pass, not a gear rebuild. Mageblood + Whispering Ice + Ancestral Bond stay the identity.

---

## Scalpel / in-game Build Planner file

**Use this one (point-legal):**  
`Aenthan Tree Refit (123pt budget).build`  
in `Documents\My Games\Path of Exile 2\BuildPlanner\`

Same live tree as Aenthan, then:

**Refund (5 notables):** Calculated Hunter, Vulgar Methods, Controlling Magic, Sigil of Lightning, Relentless Vindicator  

**Spend the freed points only on what actually fits (~5 node budget after prune):**
- **Erraticism** (1 pt path)
- **Cold Nature** (3 pt path)
- 1 pt left unspent

**Not in this file** (too expensive from your current graph without a full respec): Snowpiercer (~19), Pure Energy (~7), Insightfulness (~9). Those need a larger path rethink or waiting for more points — the earlier impossible `.build` that pathfinded to all of them has been removed.

## How to apply in Path of Building (PoE2)

1. Open PoB2 → Import → paste the code from `aenthan-pob-code.txt` (exported from ninja).  
2. Tree view → refund the notables listed above.  
3. Path to Pure Energy / Insightfulness / Snowpiercer / Cold Nature.  
4. Compare **TotalDPS** (Grim Pillars socket group) and **EnergyShield**.  
5. Mirror the final tree in-game with Orb of Remembrance / refunds (or load the `.build` above).

Local PoB tree data used for names:  
`PathOfBuilding-PoE2-dev/src/TreeData/0_5/tree.json`

---

## Keep / don’t touch without a plan

- **Chaos Inoculation** + **Ancestral Bond**  
- Oracle: **Forced Outcome**, **The Lesser Harm**, **Unnamed Heartwood**, **The Unseen Path**  
- **Endless Blizzard**, **Glaciation**, **Enhanced Barrier**, **Ancient Aegis**, **Illuminated Crown**  
- Totem speed cluster  
- Jewel mods: %ES / crit multi / faster ES recharge  

---

*Generated from live poe.ninja model for Enin9-6394 / Aenthan. Re-import after gear swaps — Int and ES targets move with rares.*
