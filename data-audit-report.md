# Comprehensive Data Audit Report
Generated: 2026-02-27T21:00:55.003Z

## Summary
| Metric | Count |
|--------|-------|
| Total JSON files | 2857 |
| Valid (parseable with data) | 2854 |
| Empty / placeholder | 0 |
| Invalid JSON (parse errors) | 0 |
| Truncated (<20 bytes) | 1 |
| Error objects (ITEM_NOT_FOUND) | 2 |
| Total directories | 620 |
| Empty directories | 63 |
| Schema inconsistencies | 707 |
| **Errors** | **3** |
| **Warnings** | **0** |

## Files by Domain
| Domain | Count |
|--------|-------|
| monster | 806 |
| magic-item | 692 |
| spell | 387 |
| equipment | 332 |
| rules | 223 |
| world | 139 |
| feats | 76 |
| class | 60 |
| environment | 52 |
| origins | 36 |
| hazards | 20 |
| condition | 16 |
| character | 15 |
| dm | 3 |

## Missing Data Summary
| Category | Missing Count | Status |
|----------|---------------|--------|
| Monsters (MM) | 191 | ❌ Need extraction |
| Beasts/Creatures (MM Appendix) | 30 | ❌ Need extraction |
| Species (PHB) | 0 | ❌ Need extraction |
| Backgrounds (PHB) | 0 | ❌ Need extraction |
| Languages (PHB) | 0 | ❌ Need extraction |
| Magic Item Error Objects | 2 | ❌ Need re-extraction |

## Empty Directories

### 🔴 Critical — Missing Source Data (17)
| Directory | Source |
|-----------|--------|
| `dm/adventures/encounters/combat` | DMG Ch3 — Combat Encounter Templates |
| `dm/adventures/encounters/puzzles` | DMG Ch3 — Puzzle Templates |
| `dm/adventures/encounters/social` | DMG Ch3 — Social Encounter Templates |
| `dm/loot-tables` | DMG Ch7 — Treasure Tables |
| `dm/npcs/sentient-items` | DMG Ch7 — Sentient Magic Items |
| `dm/npcs/townsfolk` | MM NPCs.md — Commoner, Guard, etc. |
| `dm/rewards/marks-of-prestige` | DMG Ch3 — Marks of Prestige |
| `dm/shops` | DMG Ch3 — Random Shops |
| `equipment/weapons/masteries` | PHB Ch6 — Weapon Masteries |
| `hazards/diseases` | DMG Ch3 — Diseases |
| `rules/chases` | DMG Ch3 — Chase Rules |
| `rules/damage-types` | PHB Ch1 — Damage Types |
| `rules/time` | PHB Ch1 — Time Tracking |
| `rules/tool-properties` | PHB Ch6 — Tool Descriptions |
| `rules/weapon-properties` | PHB Ch6 — Weapon Properties |
| `world/factions` | DMG Ch5 — Factions |
| `world/scripts` | PHB Ch2 — Writing Scripts |

### 🟡 Expected — Related Source Data (7)
- `hazards/traps/magical/effects` — Related to DMG Ch3 — Magical Traps
- `hazards/traps/mechanical/effects` — Related to DMG Ch3 — Mechanical Traps
- `origins/species/lineages` — Related to PHB Ch4 — Species (Aasimar, Dragonborn, Dwarf, etc.)
- `rules/afflictions/curses` — Related to DMG Ch3 — Curses
- `rules/downtime/bastions/facilities/basic` — Related to DMG Ch3/Ch8 — Downtime Activities
- `rules/downtime/bastions/facilities/special` — Related to DMG Ch3/Ch8 — Downtime Activities
- `world/deities/pantheons` — Related to DMG Ch3/Appendix A — Deity Pantheons

### 🟢 Homebrew — Intentionally Empty (39)
- `classes/subclasses`
- `dm/adventures/encounters/lairs`
- `dm/adventures/one-shots`
- `dm/npcs/custom-monsters`
- `dm/npcs/monsters/complex-traps`
- `dm/npcs/monsters/elementals/genies`
- `dm/npcs/monsters/swarms`
- `equipment/items/ammunition`
- `equipment/items/poisons/contact`
- `equipment/items/poisons/ingested`
- `equipment/items/poisons/inhaled`
- `equipment/items/poisons/injury`
- `equipment/items/spell-components`
- `equipment/items/spellcasting-foci`
- `equipment/magic-items/artifacts`
- `equipment/magic-items/consumables/potions`
- `equipment/magic-items/consumables/scrolls`
- `equipment/magic-items/cursed-items`
- `equipment/magic-items/permanent/rings`
- `equipment/magic-items/permanent/rods`
- `equipment/magic-items/permanent/staffs`
- `equipment/magic-items/permanent/wands`
- `equipment/magic-items/sentient-items`
- `equipment/recipes`
- `equipment/vehicles/mounts`
- `equipment/vehicles/waterborne/ships`
- `equipment/vehicles/waterborne/simple`
- `equipment/weapons/explosives/futuristic`
- `equipment/weapons/explosives/modern`
- `equipment/weapons/explosives/renaissance`
- `equipment/weapons/firearms/futuristic`
- `equipment/weapons/firearms/modern`
- `equipment/weapons/firearms/renaissance`
- `equipment/weapons/siege`
- `game/ai`
- `hazards/traps/effects`
- `rules/status-effects/buffs`
- `rules/status-effects/madness`
- `world/languages/secret`

---
## Missing Monsters (191)
These creatures are listed in the MM Monsters-by-CR index but have no JSON file:

- Baboon
- Badger
- Bat
- Commoner
- Crab
- Deer
- Eagle
- Frog
- Giant Fire Beetle
- Goat
- Hawk
- Hyena
- Octopus
- Piranha
- Raven
- Scorpion
- Seahorse
- Vulture
- Weasel
- Bandit
- Blood Hawk
- Camel
- Cultist
- Flying Snake
- Giant Crab
- Giant Rat
- Giant Weasel
- Goblin Minion
- Kobold Warrior
- Mastiff
- Mule
- Noble
- Pony
- Venomous Snake
- Warrior Infantry
- Animated Broom
- Animated Flying Sword
- Bullywug Warrior
- Constrictor Snake
- Draft Horse
- Elk
- Giant Badger
- Giant Bat
- Giant Centipede
- Giant Frog
- Giant Lizard
- Giant Owl
- Giant Venomous Snake
- Giant Wolf Spider
- Goblin Warrior
- Panther
- Priest Acolyte
- Pteranodon
- Riding Horse
- Swarm of Bats
- Swarm of Rats
- Swarm of Ravens
- Winged Kobold
- Ape
- Black Bear
- Giant Goat
- Giant Seahorse
- Giant Wasp
- Gnoll Warrior
- Hobgoblin Warrior
- Performer
- Reef Shark
- Scout
- Swarm of Insects
- Tough
- Warhorse
- Warhorse Skeleton
- Animated Armor
- Brown Bear
- Bugbear Warrior
- Dire Wolf
- Empyrean Iota
- Faerie Dragon Youth
- Giant Eagle
- Giant Hyena
- Giant Octopus
- Giant Spider
- Giant Toad
- Giant Vulture
- Goblin Boss
- Lacedon Ghoul
- Lion
- Ogrillon Ogre
- Pirate
- Psychic Gray Ooze
- Salamander Fire Snake
- Spy
- Swarm of Piranhas
- Allosaurus
- Animated Rug of Smothering
- Azer Sentinel
- Bandit Captain
- Berserker
- Bulette Pup
- Centaur Trooper
- Cultist Fanatic
- Druid
- Faerie Dragon Adult
- Giant Boar
- Giant Constrictor Snake
- Giant Elk
- Gnoll Pack Lord
- Hunter Shark
- Mage Apprentice
- Minotaur Skeleton
- Ogre Zombie
- Plesiosaurus
- Polar Bear
- Priest
- Rhinoceros
- Saber-Toothed Tiger
- Swarm of Venomous Snakes
- Will-o'-Wisp
- Ankylosaurus
- Bugbear Stalker
- Flaming Skeleton
- Giant Scorpion
- Goblin Hexer
- Hobgoblin Captain
- Killer Whale
- Mummy
- Quaggoth Thonot
- Scout Captain
- Vampire Familiar
- Warrior Veteran
- Archelon
- Bullywug Bog Sage
- Elephant
- Gnoll Fang of Yeenoghu
- Guard Captain
- Hippopotamus
- Tough Boss
- Beholder Zombie
- Giant Axe Beak
- Giant Shark
- Gladiator
- Pixie Wonderbringer
- Triceratops
- Vampire Spawn
- Young Remorhaz
- Azer Pyromancer
- Cyclops Sentry
- Ghast Gravecaller
- Giant Squid
- Hobgoblin Warlord
- Mage
- Mammoth
- Performer Maestro
- Pirate Captain
- Satyr Revelmaster
- Bandit Deceiver
- Centaur Warden
- Giant Ape
- Graveyard Revenant
- Grick Ancient
- Primeval Owlbear
- Tree Blight
- Aberrant Cultist
- Assassin
- Berserker Commander
- Cockatrice Regent
- Death Cultist
- Elemental Cultist
- Fiend Cultist
- Tyrannosaurus Rex
- Vampire Nightbringer
- Brazen Gorgon
- Cultist Hierophant
- Cyclops Oracle
- Dire Worg
- Haunting Revenant
- Noble Prodigy
- Performer Legend
- Spy Master
- Warrior Commander
- Bandit Crime Lord
- Death Knight Aspirant
- Archmage
- Archpriest
- Pirate Admiral
- Questing Knight
- Beholder
- Mummy Lord
- Salamander Inferno Master
- Vampire Umbral Lord
- Gulthias Blight

---
## Missing Creatures/Beasts (30)
These beasts are in MM Appendix A (Creatures.md) but have no JSON file:

- Allosaurus
- Ankylosaurus
- Archelon
- Baboon
- Deer
- Eagle
- Flying Snake
- Giant Centipede
- Giant Eagle
- Giant Fire Beetle
- Giant Hyena
- Giant Shark
- Giant Squid
- Giant Toad
- Giant Vulture
- Giant Wasp
- Hippopotamus
- Hunter Shark
- Hyena
- Killer Whale
- Mammoth
- Piranha
- Plesiosaurus
- Polar Bear
- Pteranodon
- Rhinoceros
- Swarm of Insects
- Swarm of Piranhas
- Tyrannosaurus Rex
- Vulture

---
## Schema Inconsistencies (707)
| Domain | File | Issue |
|--------|------|-------|
| class | `classes/barbarian-subclasses/path-of-the-berserker.json` | Missing hitDie/hitDice field |
| class | `classes/barbarian-subclasses/path-of-the-wild-heart.json` | Missing hitDie/hitDice field |
| class | `classes/barbarian-subclasses/path-of-the-world-tree.json` | Missing hitDie/hitDice field |
| class | `classes/barbarian-subclasses/path-of-the-zealot.json` | Missing hitDie/hitDice field |
| class | `classes/barbarian.json` | Missing hitDie/hitDice field |
| class | `classes/bard-subclasses/college-of-dance.json` | Missing hitDie/hitDice field |
| class | `classes/bard-subclasses/college-of-glamour.json` | Missing hitDie/hitDice field |
| class | `classes/bard-subclasses/college-of-lore.json` | Missing hitDie/hitDice field |
| class | `classes/bard-subclasses/college-of-valor.json` | Missing hitDie/hitDice field |
| class | `classes/bard.json` | Missing hitDie/hitDice field |
| class | `classes/cleric-subclasses/life-domain.json` | Missing hitDie/hitDice field |
| class | `classes/cleric-subclasses/light-domain.json` | Missing hitDie/hitDice field |
| class | `classes/cleric-subclasses/trickery-domain.json` | Missing hitDie/hitDice field |
| class | `classes/cleric-subclasses/war-domain.json` | Missing hitDie/hitDice field |
| class | `classes/cleric.json` | Missing hitDie/hitDice field |
| class | `classes/druid-subclasses/circle-of-the-land.json` | Missing hitDie/hitDice field |
| class | `classes/druid-subclasses/circle-of-the-moon.json` | Missing hitDie/hitDice field |
| class | `classes/druid-subclasses/circle-of-the-sea.json` | Missing hitDie/hitDice field |
| class | `classes/druid-subclasses/circle-of-the-stars.json` | Missing hitDie/hitDice field |
| class | `classes/druid.json` | Missing hitDie/hitDice field |
| class | `classes/fighter-subclasses/battle-master.json` | Missing hitDie/hitDice field |
| class | `classes/fighter-subclasses/champion.json` | Missing hitDie/hitDice field |
| class | `classes/fighter-subclasses/eldritch-knight.json` | Missing hitDie/hitDice field |
| class | `classes/fighter-subclasses/psi-warrior.json` | Missing hitDie/hitDice field |
| class | `classes/fighter.json` | Missing hitDie/hitDice field |
| class | `classes/monk-subclasses/warrior-of-mercy.json` | Missing hitDie/hitDice field |
| class | `classes/monk-subclasses/warrior-of-shadow.json` | Missing hitDie/hitDice field |
| class | `classes/monk-subclasses/warrior-of-the-elements.json` | Missing hitDie/hitDice field |
| class | `classes/monk-subclasses/warrior-of-the-open-hand.json` | Missing hitDie/hitDice field |
| class | `classes/monk.json` | Missing hitDie/hitDice field |
| class | `classes/paladin-subclasses/oath-of-devotion.json` | Missing hitDie/hitDice field |
| class | `classes/paladin-subclasses/oath-of-glory.json` | Missing hitDie/hitDice field |
| class | `classes/paladin-subclasses/oath-of-the-ancients.json` | Missing hitDie/hitDice field |
| class | `classes/paladin-subclasses/oath-of-vengeance.json` | Missing hitDie/hitDice field |
| class | `classes/ranger-subclasses/beast-master.json` | Missing hitDie/hitDice field |
| class | `classes/ranger-subclasses/fey-wanderer.json` | Missing hitDie/hitDice field |
| class | `classes/ranger-subclasses/gloom-stalker.json` | Missing hitDie/hitDice field |
| class | `classes/ranger-subclasses/hunter.json` | Missing hitDie/hitDice field |
| class | `classes/ranger.json` | Missing hitDie/hitDice field |
| class | `classes/rogue-subclasses/arcane-trickster.json` | Missing hitDie/hitDice field |
| class | `classes/rogue-subclasses/assassin.json` | Missing hitDie/hitDice field |
| class | `classes/rogue-subclasses/soulknife.json` | Missing hitDie/hitDice field |
| class | `classes/rogue-subclasses/thief.json` | Missing hitDie/hitDice field |
| class | `classes/rogue.json` | Missing hitDie/hitDice field |
| class | `classes/sorcerer-subclasses/aberrant-sorcery.json` | Missing hitDie/hitDice field |
| class | `classes/sorcerer-subclasses/clockwork-sorcery.json` | Missing hitDie/hitDice field |
| class | `classes/sorcerer-subclasses/draconic-sorcery.json` | Missing hitDie/hitDice field |
| class | `classes/sorcerer-subclasses/wild-magic-sorcery.json` | Missing hitDie/hitDice field |
| class | `classes/sorcerer.json` | Missing hitDie/hitDice field |
| class | `classes/warlock-subclasses/archfey-patron.json` | Missing hitDie/hitDice field |
| ... | ... | +657 more |

---
## Errors (3)
| File | Issue |
|------|-------|
| `classes/paladin.json` | Truncated (6 bytes) |
| `world/lore/adventures-with-gith.json` | Error object: EXTRACTION_NOT_POSSIBLE |
| `world/lore/history-of-the-gith.json` | Error object: EXTRACTION_NOT_APPLICABLE |
