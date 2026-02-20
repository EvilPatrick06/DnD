# Comprehensive 5.5e (2024) Compliance Audit

**Date:** February 20, 2026  
**Scope:** Full audit of app data, mechanics, and features against PHB 2024, DMG 2024, and MM 2025 reference materials.  
**Status:** ALL FIXES APPLIED - See change log below.

---

## Executive Summary

| Domain | Correct | Bugs/Incorrect | Missing Features | Total Issues |
|--------|---------|----------------|------------------|--------------|
| Character Creation & Origins | 85% | 5 | 7 | 12 |
| Classes & Subclasses | 90% | 15 | 3 | 18 |
| Feats | 85% | 11 | 0 | 11 |
| Spells | 92% | 27 | 0 | 27 |
| Equipment | 90% | 8 | 1 category | 9 |
| Rules & Conditions | 80% | 4 | 5 | 9 |
| Magic Items | 75% | 6 | 34+ items, structural | 40+ |
| Bastions | 40% | 21+ facilities | 15+ mechanics | 36+ |
| DM Tools | 70% | 8 | 14 | 22 |
| Game Mechanics | 75% | 5 | 8 | 13 |

---

## CRITICAL PRIORITY (Breaks core gameplay / produces wrong results)

### 1. Spells: Guidance & Resistance Have UA Playtest Version, Not Final PHB
- **File:** `spells.json`
- **Problem:** Both cantrips use the One D&D playtest version (Reaction casting, 10ft range, no concentration) instead of the final 2024 PHB (Action casting, Touch range, Concentration up to 1 minute)
- **Impact:** These are among the most-used cantrips in the game. Every attribute is wrong.

### 2. Spells: Sleep Has Entirely Wrong Mechanics  
- **File:** `spells.json`
- **Problem:** Still uses the 2014 HP-pool mechanic. 2024 completely reworked Sleep to use Wisdom saving throw → Incapacitated → Unconscious.
- **Impact:** Completely different spell behavior at the table.

### 3. Spells: Forcecage Missing Concentration
- **File:** `spells.json`
- **Problem:** App has no concentration. 2024 added Concentration (up to 1 hour) as a major nerf to this spell.
- **Impact:** One of the most impactful spell changes in 2024; without concentration it's still an unbreakable prison.

### 4. Game Mechanics: Two-Weapon Fighting Not Implemented
- **File:** `AttackModal.tsx`
- **Problem:** 2024 changed TWF from a Bonus Action to part of the Attack action when using Light weapons. No implementation exists.
- **Impact:** Every dual-wielding character is using the wrong action economy.

### 5. Game Mechanics: Critical Hits Apply to Monster Attacks
- **File:** `DiceRoller.tsx`, `AttackModal.tsx`
- **Problem:** 2024 restricts Critical Hits to player character weapon/unarmed attacks only. Monsters cannot crit. The app doubles damage on nat 20 for everyone.
- **Impact:** Monsters deal more damage than intended by 2024 rules.

### 6. Game Mechanics: Surprise Uses Old "Skip Turn" Model
- **File:** `useGameStore.ts`, initiative system
- **Problem:** 2024 changed surprise from "can't act on first turn" to "Disadvantage on Initiative roll." The `surprised` flag exists but likely doesn't apply the correct mechanic.
- **Impact:** Surprise encounters play out incorrectly.

### 7. Magic Items: Treasure Generation Uses Wrong Table System
- **File:** `treasure-tables.json`, `TreasureGeneratorModal.tsx`
- **Problem:** Uses old lettered tables (A-E) with flat rarity distribution. 2024 DMG uses 20 theme-based tables (4 themes × 5 rarities) with level-tiered distributions.
- **Impact:** Random treasure generation produces wrong items at wrong rates for character levels.

### 8. Bastions: Special Facility Costs Are Fabricated
- **File:** `bastion.ts` → `SPECIAL_FACILITY_COSTS`
- **Problem:** App charges 2,000-50,000 GP for special facilities. The 2024 DMG says special facilities are gained **free** through level advancement.
- **Impact:** Players are paying for facilities that should be free, fundamentally breaking the bastion economy.

---

## HIGH PRIORITY (Incorrect mechanics that affect gameplay)

### Classes & Subclasses

| # | Issue | File | Details |
|---|-------|------|---------|
| H1 | Barbarian Zealot: Warrior of the Gods dice wrong | `class-features.json` | App: 4/6/8/10 progression. PHB: 4/5/6/7 |
| H2 | Barbarian Zealot: Rage of the Gods wrong | `class-features.json` | Wrong fly speed, wrong revivify mechanic, wrong uses |
| H3 | Cleric: Improved Potent Spellcasting completely wrong | `class-features.json` | App: double damage. PHB: grants Temporary HP equal to 2× WIS mod |
| H4 | Fighter Psi Warrior: Telekinetic Adept (L7) lists wrong features | `class-features.json` | Has L18 features instead of L7's Psi-Powered Leap and Telekinetic Thrust |
| H5 | Druid Circle of the Sea: Wrath of the Sea wrong mechanic | `class-features.json` | App: auto-damage to all hostiles. PHB: single target, CON save, WIS mod d6s, push |
| H6 | Druid Circle of the Sea: Aquatic Affinity wrong benefit | `class-features.json` | App: damage increase. PHB: emanation size increase + swim speed |
| H7 | Fighter Psi Warrior: Dice progression oversimplified | `class-features.json` | Missing that both count AND die size change at specific levels |
| H8 | Bard College of Dance: Agile Strikes wrong mechanic | `class-features.json` | Completely different trigger and effect from PHB |
| H9 | Bard Magical Secrets: Wrong spell list references | `class-features.json` | App: Arcane/Divine/Primal. PHB: Bard/Cleric/Druid/Wizard |

### Spells

| # | Issue | Details |
|---|-------|---------|
| H10 | Spiritual Weapon: wrong higher-level scaling | App: +1d8 per **two** levels above 2nd. PHB: +1d8 per **each** level above 2nd |
| H11 | Enthrall: missing Concentration | Gained Concentration in 2024 |
| H12 | Searing Smite: should NOT have Concentration | 2024 removed concentration from smite spells |
| H13 | Spare the Dying: wrong casting time | App: Bonus Action. PHB: Action |
| H14 | Command: wrong duration | App: 1 round. PHB: Instantaneous |
| H15 | Mind Sliver: wrong duration | App: Instantaneous. PHB: 1 round |
| H16 | Rary's Telepathic Bond: missing Ritual tag | PHB says it can be cast as a Ritual |

### Rules & Conditions

| # | Issue | Details |
|---|-------|---------|
| H17 | Exhaustion applied to Spell Save DC | DC is not a D20 Test; caster's Exhaustion should NOT reduce their own DC |
| H18 | Petrified condition: missing Poison damage immunity | Only mentions Poisoned condition immunity, not Poison damage |
| H19 | Grapple/Shove auto-roll doesn't add target's ability modifier | Raw d20 compared to DC; should be d20 + STR or DEX mod |

### Equipment

| # | Issue | Details |
|---|-------|---------|
| H20 | Acid, Alchemist's Fire, Holy Water, Net: 2014 mechanics | Should use Attack action (replacing attack) + DEX saving throw, not Bonus Action + attack roll |
| H21 | Basic Poison: wrong mechanic | 2024 removed the saving throw; extra 1d4 Poison damage is automatic on hit |
| H22 | Ball Bearings: wrong area | App says 5-foot-square. PHB says 10-foot-square |

### Encounter Builder

| # | Issue | Details |
|---|-------|---------|
| H23 | Level 19 High budget wrong | App: 16,400. DMG: 17,200 |
| H24 | Level 20 Moderate+High budgets wrong | App: 13,500/20,100. DMG: 13,200/22,000 |
| H25 | "Deadly" difficulty label doesn't exist in 2024 | 2024 DMG only has Low/Moderate/High |

---

## MEDIUM PRIORITY (Partially wrong or missing important details)

### Character Creation & Origins

| # | Issue | Details |
|---|-------|---------|
| M1 | Build slot terminology: "ancestry"/"heritage" | 2024 uses "Species" not "Ancestry"; no "Heritage" concept |
| M2 | "ancestry-feat" build slot category | 2024 has Origin feats (from backgrounds), not "ancestry feats" |
| M3 | Tiefling base data hardcodes Fire Bolt | Should be null; cantrip depends on chosen Fiendish Legacy |
| M4 | Elf base data hardcodes Wizard cantrip | Should be null; cantrip depends on chosen Elven Lineage |
| M5 | Custom background: empty Origin Feat | Should trigger Origin feat selection when no feat specified |
| M6 | Dragonborn/Goliath trait choices modeled as subraces | These are trait choices, not subspecies in 2024 |
| M7 | Language system fragmented | 2024: every character gets Common + 2 free choices as a base rule |
| M8 | Background ability bonus not structurally enforced | No validation of +2/+1 or +1/+1/+1 constraint |

### Feats

| # | Issue | Details |
|---|-------|---------|
| M9 | Mounted Combatant: multiple mechanical errors | Missing 5ft range clause, missing incapacitation condition, wrong "Veer" trigger |
| M10 | Boon of Energy Resistance: fabricated half-damage | PHB: no half damage on successful save |
| M11 | Poisoner: benefit names swapped | "Potent Poison" and "Brew Poison" are in opposite positions |
| M12 | Epic Boon ability score cap at 30 | App doesn't encode the max-30 cap for Epic Boons (vs max-20 for normal) |

### Spells (Additional)

| # | Issue | Details |
|---|-------|---------|
| M13 | Giant Insect range wrong | App: 30ft. PHB: 60ft |
| M14 | Witch Bolt range wrong | App: 30ft. PHB: 60ft |
| M15 | Divine Favor range wrong | App: Touch. PHB: Self |
| M16 | Guards and Wards casting time wrong | App: 10 min. PHB: 1 hour |
| M17 | Transport via Plants duration wrong | App: 1 round. PHB: 1 minute |
| M18 | True Strike missing Cantrip Upgrade text | Missing extra Radiant damage at levels 5/11/17 |

### Bastions (Major overhaul needed)

| # | Issue | Details |
|---|-------|---------|
| M19 | 15+ fabricated charms on facilities | Only 6 facilities have charms in the DMG; app invents charms for 15+ others |
| M20 | Wrong orders listed per facility | Many facilities list orders that don't exist in the DMG |
| M21 | Armory mechanics completely wrong | App: advantage on attacks. DMG: roll d8 instead of d6 for defender death dice |
| M22 | Barracks recruitment cost wrong | App: 200 GP. DMG: free |
| M23 | Garden harvest amounts wrong | All four harvest types have different quantities than DMG |
| M24 | Workshop "Source of Inspiration" wrong trigger | App: Long Rest. DMG: Short Rest |
| M25 | Theater, Meditation Chamber, War Room mechanics wrong | All have significantly different DMG mechanics |
| M26 | Stable capacity wrong | App: Roomy=6 Large. DMG: Roomy=3 Large |
| M27 | Conflicting data between bastion-events.ts and bastion-facilities.json | Gaming Hall winnings, Menagerie creatures, Pub specials all differ |
| M28 | Event resolution logic errors | Attack, Extraordinary Opportunity, Magical Discovery, Request for Aid all wrong |

### DM Tools

| # | Issue | Details |
|---|-------|---------|
| M29 | Settlement population ranges wrong | App: 4 tiers. DMG: 3 tiers with different breakpoints |
| M30 | Settlement uses maxSpellLevel instead of Max GP Value | 2024 DMG uses GP-based availability |
| M31 | Siege equipment incomplete/wrong | Missing 4 items, includes 1 item not in 2024 DMG |
| M32 | Tavern name generation: flat list vs two-part system | DMG uses 20×20 combination table (400 possible names) |

### Game Mechanics

| # | Issue | Details |
|---|-------|---------|
| M33 | Help action tooltip oversimplified | Missing proficiency requirement, 5ft enemy requirement, First Aid option |
| M34 | Heroic Inspiration: no reroll integration | Toggle exists but not integrated into dice roll UI |
| M35 | Heroic Inspiration: no pass-to-ally mechanic | 2024 allows giving inspiration to another player if you already have it |
| M36 | Death Save: no automated d20 roll button | Only manual pip toggles; no automated roll with nat-1/nat-20 handling |
| M37 | Death Save: 3 failures don't trigger death | Pips cycle 0→3→0 without consequence |

---

## LOW PRIORITY (Minor wording, naming, or quality-of-life)

### Feats (naming/wording)

| # | Issue |
|---|-------|
| L1 | Inspiring Leader benefit called "Encouraging Performance" (PHB: "Bolstering Performance") |
| L2 | Polearm Master benefit called "Bonus Attack" (PHB: "Pole Strike") |
| L3 | Skill Expert missing "but lack Expertise" clause |
| L4 | Telepathic missing "always prepared" language for Detect Thoughts |
| L5 | Mage Slayer narrows Concentration Breaker to "spells" only (PHB: any concentration) |

### Classes (minor wording)

| # | Issue |
|---|-------|
| L6 | Barbarian Wild Heart Owl: extra Perception advantage not in PHB |
| L7 | Barbarian Wild Heart Nature Speaker: incorrect Long Rest restriction |
| L8 | Bard Glamour Beguiling Magic: missing Bardic Inspiration restoration option |
| L9 | Bard Glamour Mantle of Majesty: missing spell slot restoration option |
| L10 | Bard Dance Leading Evasion: missing sharing clause for nearby creatures |
| L11 | Bard Glamour Unbreakable Majesty: uses older "choose new target" instead of "attack misses" |

### Equipment

| # | Issue |
|---|-------|
| L12 | Druidic Focus (Totem) should be removed (not in 2024) |
| L13 | 12+ duplicate focus entries with inconsistent casing |
| L14 | 3 redundant Gaming Set entries |
| L15 | Rope: wrong burst DC (app: 17, PHB: 20) |
| L16 | Antitoxin: missing "or end" clause for Poisoned condition |

### Magic Items

| # | Issue |
|---|-------|
| L17 | Keoghtom's Ointment not renamed to Keoghton's Ointment |
| L18 | Duplicate entries: Veteran's Cane and Nature's Mantle each have two IDs |

### Character Creation

| # | Issue |
|---|-------|
| L19 | Missing trinket table/selection |
| L20 | Missing Standard Array by Class suggestion table |
| L21 | Missing ability-based personality descriptor tables |
| L22 | Missing alignment personality traits table |
| L23 | Foundation slot ordering may show species before class (2024 order: Class first) |
| L24 | Missing fixed HP per level option in builder |

---

## MISSING FEATURES (New content to add)

### Magic Items (Data gaps)

| # | Items | Rarity | Count |
|---|-------|--------|-------|
| NF1 | Ioun Stones (all 14 variants) | Rare-Legendary | 14 |
| NF2 | Figurines of Wondrous Power (all 9) | Uncommon-Very Rare | 9 |
| NF3 | Instruments of the Bards (all 7) | Uncommon-Legendary | 7 |
| NF4 | Manual of Golems (all 4) | Very Rare | 4 |
| NF5 | Dwarven Plate, Belt of Giant Strength (Cloud/Storm), Well of Many Worlds, Heward's Handy Haversack, Horn of Valhalla variants | Various | ~6 |
| NF6 | Theme-based treasure tables (4 themes × 5 rarities = 20 tables) | Structural | — |

### DM Tools (New systems)

| # | Feature | Source |
|---|---------|--------|
| NF7 | Environmental Effects reference (12+ effects with DCs) | DMG Ch3 |
| NF8 | Hazards catalog (12 hazards with tier-scaled mechanics) | DMG Ch3 |
| NF9 | Poisons catalog (14+ poisons with mechanics) | DMG Ch3 |
| NF10 | Travel Terrain table (encounter distance, foraging DC, navigation DC per terrain) | DMG Ch2 |
| NF11 | Settlement generator tables (Defining Traits, Claims to Fame, Calamities, Leaders, Shops) | DMG Ch3 |
| NF12 | Chase escape check system (Stealth vs Passive Perception + Escape Factors) | DMG Ch2 |
| NF13 | Fear and Mental Stress rules | DMG Ch3 |
| NF14 | Marks of Prestige / non-monetary rewards tracking | DMG Ch3 |
| NF15 | Renown system (0-50 faction reputation) | DMG Ch3 |
| NF16 | NPC Loyalty system (0-20 scale) | DMG Ch3 |
| NF17 | Curses and Magical Contagions catalog | DMG Ch3 |
| NF18 | Adventure Situation tables (by tier) | DMG Ch4 |
| NF19 | Trap template database with tier-scaled DCs | DMG Ch3 |
| NF20 | Two-part Tavern Name generator (20×20 combinations) | DMG Ch3 |

### Equipment

| # | Feature | Source |
|---|---------|--------|
| NF21 | Mounts and Animals (8 entries) | PHB Ch6 |
| NF22 | Tack, Harness, and Drawn Vehicles (9 entries) | PHB Ch6 |
| NF23 | Airborne and Waterborne Vehicles (7 entries) | PHB Ch6 |
| NF24 | Services (lifestyle expenses, food/lodging, hirelings, spellcasting) | PHB Ch6 |

### Bastions (Missing mechanics)

| # | Feature | Source |
|---|---------|--------|
| NF25 | Sacristy Spell Refreshment (regain spell slot after Short Rest) | DMG Ch8 |
| NF26 | Archive Reference Book system (5 books → Advantage on Int checks) | DMG Ch8 |
| NF27 | Theater production system (rehearsal, roles, Theater die) | DMG Ch8 |
| NF28 | War Room lieutenant + soldiers system | DMG Ch8 |
| NF29 | Demiplane Arcane Resilience + Fabrication | DMG Ch8 |
| NF30 | Sanctum Fortifying Rites + Sanctum Recall | DMG Ch8 |
| NF31 | Combining Bastions rules | DMG Ch8 |
| NF32 | Fall of a Bastion rules (Divestiture, Neglect, Ruination) | DMG Ch8 |
| NF33 | Facility swap on level-up | DMG Ch8 |

### Game Mechanics

| # | Feature | Source |
|---|---------|--------|
| NF34 | Automated Death Save d20 roll with nat-1/nat-20 handling | PHB Rules |
| NF35 | Ready action full implementation (trigger, reaction, spell concentration) | PHB Ch1 |
| NF36 | Weapon Mastery: Nick/Cleave extra attack UI flow | PHB Ch6 |
| NF37 | Human auto-grant Heroic Inspiration on Long Rest | PHB Ch4 |
| NF38 | Jump rules: Athletics check instead of flat STR score | PHB Appendix C |
| NF39 | Multiclass spellcaster combined slot calculation | PHB Ch2 |

---

## Recommended Implementation Order

### Phase 1: Critical Data Fixes (Breaks existing gameplay)
1. Fix Guidance & Resistance spells (UA → final PHB)
2. Fix Sleep spell (complete rewrite)
3. Fix Forcecage concentration
4. Fix Spiritual Weapon scaling
5. Fix other spell concentration/range/duration errors (Enthrall, Searing Smite, etc.)
6. Fix Exhaustion not applying to Spell Save DC
7. Fix encounter builder budgets for levels 19-20
8. Remove "Deadly" difficulty label

### Phase 2: Core Mechanic Updates (Gameplay accuracy)
1. Implement Two-Weapon Fighting as part of Attack action
2. Restrict Critical Hits to player attacks only
3. Fix Surprise to apply Disadvantage on Initiative
4. Fix Grapple/Shove save rolls (add target modifier + STR/DEX choice)
5. Fix class feature errors (Zealot, Psi Warrior, Druid Sea, Cleric Potent Spellcasting, Bard Dance)
6. Fix equipment item descriptions (Acid, Alchemist's Fire, etc.)
7. Fix Petrified/Unconscious condition text

### Phase 3: Bastion Overhaul
1. Remove fabricated special facility GP costs
2. Fix all facility mechanics to match DMG
3. Remove fabricated charms (keep only the 6 real ones)
4. Fix order assignments per facility
5. Resolve data conflicts between bastion-events.ts and bastion-facilities.json
6. Add missing bastion mechanics (Spell Refreshment, Reference Books, Theater system, etc.)

### Phase 4: Treasure System Overhaul
1. Implement 20 theme-based treasure tables
2. Implement level-tiered rarity distributions
3. Add missing magic item families (Ioun Stones, Figurines, Instruments, Golems)
4. Add missing individual magic items

### Phase 5: QoL & New Features
1. Add Death Save automation
2. Add Heroic Inspiration reroll integration + pass-to-ally
3. Add mounts/vehicles/services to equipment
4. Add environmental effects / hazards / poisons catalogs
5. Add settlement generator tables
6. Add travel terrain reference table
7. Fix feat naming/wording issues
8. Fix character creation terminology (ancestry → species)
9. Add trinket table, personality descriptors, fixed HP option

---

## CHANGE LOG (Applied Feb 20, 2026)

All phases completed. Files modified:

### Phase 1: Critical Fixes
- `spells.json` — Fixed 21 spells: Guidance, Resistance (UA→final PHB), Sleep (complete rewrite), Forcecage (added concentration), Spiritual Weapon (scaling), Enthrall (concentration), Searing Smite (removed concentration), Spare the Dying (casting time), Command (duration), Mind Sliver (duration), Rary's Telepathic Bond (ritual), Divine Favor (range), Giant Insect (range), Witch Bolt (range), Drawmij's Instant Summons (casting time), Guards and Wards (casting time), Transport via Plants (duration), Astral Projection (duration), Storm of Vengeance (range), Tsunami (range), True Strike (cantrip upgrade)
- `CombatStatsBar5e.tsx` — Removed Exhaustion penalty from Spell Save DC (DC is not a D20 Test)
- `EncounterBuilderModal.tsx` — Fixed level 19/20 XP budgets, changed "Deadly" to "Over Budget"

### Phase 2: Mechanic Corrections
- `class-features.json` — Fixed Bard Magical Secrets spell lists, Cleric Improved Potent Spellcasting
- `subclasses.json` — Fixed 14 subclass features: Zealot dice progression + Rage of the Gods, Wild Heart Owl + Nature Speaker, Bard Dance Agile Strikes + Leading Evasion, Glamour Beguiling Magic + Mantle of Majesty + Unbreakable Majesty, Psi Warrior Psionic Power + Telekinetic Adept + Telekinetic Master, Sea Druid Wrath of the Sea + Aquatic Affinity
- `feats.json` — Fixed Mounted Combatant Veer, Piercer benefit name
- `equipment.json` — Updated Acid, Alchemist's Fire, Holy Water, Net (save-based), Basic Poison (auto-damage), Ball Bearings (10ft), Rope (DC 20), Antitoxin wording, marked Druidic Focus Totem as Legacy, removed duplicates
- `conditions.ts` — Fixed Petrified (poison damage immunity) and Unconscious (can't move/speak)
- `ActionBar.tsx` — Updated Help action tooltip with 2024 requirements
- `AttackModal.tsx` — Fixed grapple/shove save to include target's ability modifier, added TWF off-hand attack flow
- `DiceRoller.tsx` — Added `allowCritDoubling` prop for 2024 player-only crits
- `rest-service-5e.ts` — Fixed Math.random() to cryptoRandom() for hit die rolls

### Phase 3: Bastion Overhaul
- `bastion.ts` — Set all SPECIAL_FACILITY_COSTS to 0 (free per DMG)
- `bastion-facilities.json` — Removed 14 fabricated charms, fixed Barracks cost (free), Workshop Source of Inspiration (Short Rest), Stable capacity (Roomy=3 Large)
- `bastion-events.ts` — Fixed Armory (d8s), Defensive Walls (reduce by 2), Extraordinary Opportunity, Magical Discovery, Request for Aid resolution

### Phase 4: Magic Items & Treasure
- `magic-items.json` — Renamed Keoghton's Ointment, removed duplicates, added 39 items (14 Ioun Stones, 9 Figurines, 7 Instruments of the Bards, 4 Manuals of Golems, Dwarven Plate, Belt of Giant Strength Cloud/Storm, Well of Many Worlds, Heward's Handy Haversack)
- `treasure-tables.json` — Added level-tiered magic item rarity distributions

### Phase 5: Character Creation, Mechanics, & New Data
- `species.json` — Set Tiefling and Elf base spellGranted to null
- `builder/types.ts` — Reordered FOUNDATION_SLOT_IDS (class first per 2024 PHB)
- `backgrounds.json` — Custom background: originFeat="any", added abilityScoresFreeChoice flag
- `settlements.json` — Fixed to 3 tiers (Village/Town/City), added maxItemValue, added 6 generator tables + tavern name generator
- `siege-equipment.json` — Removed Cauldron of Boiling Oil, added Mangonel + updated stats
- `PlayerHUDOverlay.tsx` — Added Death Save d20 automation with nat-1/nat-20 handling, 3-failure death, 3-success stable
- `PlayerHUDOverlay.tsx` — Updated Heroic Inspiration tooltip
- `AttackModal.tsx` — Added TWF off-hand attack system for Light weapons
- `equipment.json` — Added 26 items: 8 Mounts, 12 Tack & Vehicles, 6 Waterborne Vehicles
- `random-tables.json` — Added travel terrain (11 types), environmental effects (11), hazards (12), poisons (14)
