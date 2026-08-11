# Best route with your gear — from poe2db Oracle + Skill Gems

Sources: [Oracle](https://poe2db.tw/us/Oracle) · [Skill Gems](https://poe2db.tw/us/Skill_Gems) · [Grim Pillars](https://poe2db.tw/us/Grim_Pillars) · [Spell Totem](https://poe2db.tw/us/Spell_Totem) · [Cast on Critical](https://poe2db.tw/us/Cast_on_Critical) · [Spark](https://poe2db.tw/us/Spark) · [Comet](https://poe2db.tw/us/Comet) · live Aenthan export.

---

## Verdict (one line)

**Best route on your gear: stay Grim Pillars Spell Totem + Entangle shatter CI Oracle.**  
Spark totems are a valid *map-feel* alternate. Spark→CoC Comet is a **different build** that fights your spirit budget and keystones.

---

## poe2db facts that settle the argument

### Oracle ([poe2db](https://poe2db.tw/us/Oracle))
You already run the right package for this kit:

| Node (from DB) | Effect | Your use |
|----------------|--------|----------|
| Paths Not Taken / Unseen Path | Oracle-only tree nodes | Taken |
| Entwined Realities | Allocate notables near keystones without connection | Available |
| Inevitable crit path (Forced Outcome) | Guaranteed crits | Taken — feeds totem hits **and** would feed CoC |
| Lesser Harm | Enemy hit/crit Unlucky | Taken |
| **+1 max totems; totems die 6s after life = 0** | Heartwood | Taken — **totem-only value** |
| Totem cast/attack speed smalls | Totem DPS | Taken |
| Harmony Within | Mana before Life if Mana > Life; 15% less Life & Mana | **Skip on CI** (Life is 1; not your defense plan) |

Oracle does **not** pick Spark vs Pillars. Heartwood does: you paid an ascendancy notable for totems.

### Spell Totem ([poe2db](https://poe2db.tw/us/Spell_Totem))
- Raises a totem that casts **socketed spells**
- **Cannot use skills with cooldowns**
- Normally needs Power/Endurance charges (Ancestral Bond removes that)
- Socketed skills: **25% less Cast Speed** (DB text; some clients show tooltip bugs)

### Grim Pillars ([poe2db](https://poe2db.tw/us/Grim_Pillars))
- Cost: **Runic Ward** (not mana) when *you* cast it
- Creates **8 Ice-Crystal spears**; destroy → **Cold explosion**
- Tags include **Totemable** + **Triggerable**
- Quality: more pillars / radius

**Why totems are the intended abuse:** the Ward cost is paid by the totem’s casting rules / bypassed in practice when the totem casts — you keep Ward as defense and still get crystals. That is a gem-rules interaction, not flavor.

### Cast on Critical ([poe2db](https://poe2db.tw/us/Cast_on_Critical))
- **Reserves 100 Spirit** while active
- Gains Energy when **you** Critically Hit (not “your totems hit”)
- Energy scales with hit power vs ailment threshold (low-level spam was nerfed for energy)
- Socketed spells deal **20% less Damage**
- Energy threshold scales with socketed cast times (Comet is slow → higher energy needed)

### Spark / Comet ([poe2db](https://poe2db.tw/us/Spark) · [Comet](https://poe2db.tw/us/Comet))
- **Spark:** fast projectiles, mana cost, great for hit count / clear; CoC energy machine if *you* cast it
- **Comet:** fat cold hit, **1.0s + 1s** cast time, jump-back if aimed close — strong payload, bad as spam clear; fine as CoC payload or slow totem spell

---

## Spirit budget on *your* character (the hard gate)

Live: **~406 Spirit**, Ancestral Bond (**75 Spirit per placed totem**).

| Setup | Spirit math | Fits? |
|-------|-------------|-------|
| 5 Bond totems | 5 × 75 = 375 | Yes (your current lane) |
| 6 Bond totems | 450 | Needs reservation efficiency (Efficient Inscriptions etc.) |
| CoC alone | **100 reserved** | Yes — but only if totems aren’t also reserving |
| CoC + 4 Bond totems | 100 + 300 = 400 | Barely — weaker totem count |
| CoC + 5 Bond totems | 100 + 375 = 475 | **No** — over your pool |
| CoC + Archmage-style extras | 100 + more | Needs Bond **gone** |

So “just add CoC Comet” while keeping Bond is either illegal or forces fewer totems. CoC also needs **you** to be the crit engine — your main DPS today is **totem casts**.

---

## Scored routes (with your items)

Score = how much of Mageblood / Whispering Ice / Victory Call / Corpse Bane (+5 cold) / Bond / Heartwood / Forced Outcome / CI ES stack stays productive.

### 1) Best — Grim Pillars Spell Totem + Entangle shatter — **KEEP / TUNE**
**Score: 10/10 for this gear**

| Piece | Job |
|-------|-----|
| Spell Totem → Grim Pillars | Ward bypass + ice crystals |
| Entangle + freeze-consume (Mórrigan / Biting Frost) | Shatter explosions = real clear/boss |
| Victory Call + Bond | Spirit → totem count |
| Heartwood | Totems don’t vanish on death |
| Forced Outcome | 100% crit on pillar hits |
| Cold wand / Whispering Ice | +cold levels, Icestorm swap |
| Mageblood + CI ES | Mapping defense |

**Gem tune only:** Entangle level 1; Efficiency over Living Lightning if mana hurts; optional Convalescence (ES recharge).

### 2) Strong alternate — Spark Spell Totem — **TRY**
**Score: 7/10**

Same chassis (Bond, Heartwood, sceptre, tree). Socket **Spark** instead of (or as second totem skill where allowed).  
**Gain:** one-button clear, projectile coverage.  
**Lose:** crystal shatter multiplier; Rakiata/cold-pillar supports look worse — retune lightning/proj.  
Use for maps if Entangle feels annoying; swap Pillars back for bosses.

### 3) Situational — Comet Spell Totem — **BOSS SOCKET**
**Score: 6/10**

DB: Comet is a heavy, slow cold nuke. Fine as a boss totem spell; worse clear than Spark or Pillars+shatter.

### 4) Not best *with this gear* — Self-cast Spark + CoC → Comet — **REBUILD**
**Score: 3/10 on Aenthan as currently geared · higher if regeared**

poe2db requirements you fail today:
1. CoC needs **your** crits → stop relying on totem DPS  
2. CoC **100 Spirit** + Bond totems don’t stack cleanly on 406 Spirit  
3. Heartwood becomes a wasted ascendancy notable  
4. Victory Call’s job changes (no longer Bond battery)  
5. Comet in CoC pays **20% less** from the meta gem + high energy threshold from long cast time  
6. Frostbolt CoC variants want **Snakepit** (you don’t have it)

Forced Outcome makes CoC *good in the abstract*. Your keystones make CoC *expensive to install*.

### 5) Trap — Bond totems + CoC “on the side”
**Score: 2/10**

Spirit collision + wrong crit source. Looks clever on paper; poe2db CoC text (“when **you** Critically Hit”) kills it.

---

## Best route checklist (do this)

1. **Ascendancy:** Unseen Path → Lesser Harm → Forced Outcome → Heartwood (keep). Do not take Harmony Within for CI.  
2. **Keystones:** Ancestral Bond + CI (keep).  
3. **Main link:** Spell Totem (lvl ~14) → Grim Pillars (max) → Urgent Totems III → Vorana’s Siege → Rakiata’s Flow → Cold Mastery.  
4. **Detonator:** Entangle lvl 1 → Mórrigan’s Insight → Branching Fissures II → Mag Area → Rapid Cast → Efficiency II.  
5. **Utility:** Mana Tempest (Advancing Storm), Heart of Ice, Purity on sceptre with free spirit supports, Icestorm on Whispering Ice.  
6. **Tree:** only the legal ~5-point refund of wasted crit-*chance* (Forced Outcome already caps crit); Erraticism + Cold Nature.  
7. **Optional experiment:** Spark totems for clear — one gem swap, no respec.  
8. **Do not** pivot to CoC Comet until you plan to drop Bond/Heartwood and rebuild spirit around CoC’s 100 reservation.

---

## Why this is “proper” vs earlier advice

Earlier answers leaned on guide consensus. **poe2db adds the mechanical locks:**

- Grim Pillars = Ward + Ice Crystals + Totemable → totem is the correct delivery  
- CoC = 100 Spirit + **your** crits + 20% less on payload → conflicts with Bond  
- Heartwood on Oracle ascendancy = you already paid for totems  
- Spark/Comet are legal totem or CoC tools — but only Spark-as-totem reuses your gear without a divorce

That’s the best route **with your gear**.
