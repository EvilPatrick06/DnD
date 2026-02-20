// Fix all DMG 2024 data file discrepancies
// Cross-referenced against DMG 2024 official content
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../src/renderer/public/data/5e');

// ============================================================
// 1. POISONS
// ============================================================
console.log('=== POISONS ===');
const poisonsPath = path.join(dataDir, 'poisons.json');
const poisons = JSON.parse(fs.readFileSync(poisonsPath, 'utf8'));

// Lolth's Sting: DC 13 → DC 15 per DMG 2024
const lolths = poisons.find(p => p.id === 'lolths-sting');
if (lolths) {
  lolths.saveDC = 15;
  lolths.effect = "The creature must succeed on a DC 15 Constitution saving throw or become Poisoned for 1 hour. If the saving throw fails by 5 or more, the creature also has the Unconscious condition while Poisoned in this way. The creature wakes up if it takes damage or if another creature takes an action to shake it awake.";
  console.log("  Fixed Lolth's Sting: DC 13 → 15");
}

fs.writeFileSync(poisonsPath, JSON.stringify(poisons, null, 2) + '\n');
console.log('  Saved poisons.json\n');

// ============================================================
// 2. TRAPS
// ============================================================
console.log('=== TRAPS ===');
const trapsPath = path.join(dataDir, 'traps.json');
const traps = JSON.parse(fs.readFileSync(trapsPath, 'utf8'));

// Spiked Pit: nuisance → deadly, fix damage to match DMG 2024
const spikedPit = traps.find(t => t.id === 'spiked-pit');
if (spikedPit) {
  spikedPit.level = 'deadly';
  spikedPit.effect = "The creature falls 10 feet into a pit lined with iron spikes, taking 11 (2d10) Bludgeoning damage from the fall plus 5 (1d10) Piercing damage from the spikes.";
  spikedPit.damage = "11 (2d10) Bludgeoning + 5 (1d10) Piercing";
  spikedPit.detection = "DC 15 Intelligence (Investigation) to spot the trapdoor";
  spikedPit.scaling = {
    "5-10": { depth: 30, damage: "10 (3d6) Bludgeoning + 13 (3d8) Piercing" },
    "11-16": { depth: 60, damage: "21 (6d6) Bludgeoning + 36 (8d8) Piercing" },
    "17-20": { depth: 120, damage: "42 (12d6) Bludgeoning + 57 (13d8) Piercing" }
  };
  console.log('  Fixed Spiked Pit: nuisance → deadly, corrected damage dice, added scaling');
}

// Poisoned Darts: nuisance → deadly
const poisonedDarts = traps.find(t => t.id === 'poisoned-darts');
if (poisonedDarts) {
  poisonedDarts.level = 'deadly';
  poisonedDarts.effect = "Each creature in the trap's area must succeed on a DC 13 Dexterity saving throw or be struck by 1d4 darts, each dealing 3 (1d6) Poison damage.";
  poisonedDarts.damage = "1d4 x 3 (1d6) Poison";
  poisonedDarts.scaling = {
    "5-10": { damagePerDart: "7 (2d6) Poison" },
    "11-16": { damagePerDart: "14 (4d6) Poison" },
    "17-20": { damagePerDart: "24 (7d6) Poison" }
  };
  console.log('  Fixed Poisoned Darts: nuisance → deadly, added scaling');
}

// Fire-Casting Statue: nuisance → deadly, fix detection
const fireStatue = traps.find(t => t.id === 'fire-casting-statue');
if (fireStatue) {
  fireStatue.level = 'deadly';
  fireStatue.detection = "Detect Magic reveals Evocation aura on statue; DC 10 Wisdom (Perception) to find glyph; DC 15 Intelligence (Arcana) to understand it";
  fireStatue.disarm = "Deface the glyph or wedge Iron Spike under pressure plate";
  fireStatue.scaling = {
    "5-10": { saveDC: 17, damage: "22 (4d10) Fire", cone: "30-foot" },
    "11-16": { saveDC: 19, damage: "55 (10d10) Fire", cone: "60-foot" },
    "17-20": { saveDC: 21, damage: "99 (18d10) Fire", cone: "120-foot" }
  };
  console.log('  Fixed Fire-Casting Statue: nuisance → deadly, updated detection, added scaling');
}

// Collapsing Roof (trap): nuisance → deadly, fix detection DC
const collapsingRoofTrap = traps.find(t => t.id === 'collapsing-roof');
if (collapsingRoofTrap) {
  collapsingRoofTrap.level = 'deadly';
  collapsingRoofTrap.detection = "DC 11 Wisdom (Perception) to spot the trip wire";
  collapsingRoofTrap.disarm = "Cut trip wire (no check required) after detection";
  collapsingRoofTrap.scaling = {
    "5-10": { saveDC: 15, damage: "22 (4d10) Bludgeoning" },
    "11-16": { saveDC: 17, damage: "55 (10d10) Bludgeoning" },
    "17-20": { saveDC: 19, damage: "99 (18d10) Bludgeoning" }
  };
  console.log('  Fixed Collapsing Roof (trap): nuisance → deadly, detection DC 15 → 11, added scaling');
}

// Hidden Pit: fix detection type
const hiddenPit = traps.find(t => t.id === 'hidden-pit');
if (hiddenPit) {
  hiddenPit.detection = "DC 15 Intelligence (Investigation) to spot the pit lid";
  hiddenPit.disarm = "Wedge Iron Spike under lid or use Arcane Lock";
  hiddenPit.scaling = {
    "5-10": { depth: 30, damage: "10 (3d6) Bludgeoning" },
    "11-16": { depth: 60, damage: "21 (6d6) Bludgeoning" },
    "17-20": { depth: 120, damage: "42 (12d6) Bludgeoning" }
  };
  console.log('  Fixed Hidden Pit: detection Perception → Investigation, added scaling');
}

// Falling Net: fix detection DC
const fallingNet = traps.find(t => t.id === 'falling-net');
if (fallingNet) {
  fallingNet.detection = "DC 11 Wisdom (Perception) to spot the trip wire";
  fallingNet.scaling = {
    "5-10": { escapeDC: 12 },
    "11-16": { escapeDC: 14 },
    "17-20": { escapeDC: 16 }
  };
  console.log('  Fixed Falling Net: detection DC 10 → 11, added scaling');
}

// Poisoned Needle: fix detection DC and disarm method
const poisonedNeedle = traps.find(t => t.id === 'poisoned-needle');
if (poisonedNeedle) {
  poisonedNeedle.detection = "DC 15 Wisdom (Perception) to spot the needle mechanism";
  poisonedNeedle.disarm = "DC 15 Dexterity (Sleight of Hand) to remove the needle before picking the lock";
  poisonedNeedle.scaling = {
    "5-10": { saveDC: 13, damage: "1 Piercing + 11 (2d10) Poison" },
    "11-16": { saveDC: 15, damage: "1 Piercing + 22 (4d10) Poison" },
    "17-20": { saveDC: 17, damage: "1 Piercing + 55 (10d10) Poison" }
  };
  console.log('  Fixed Poisoned Needle: detection DC 20 → 15, disarm Thieves\' Tools → Sleight of Hand, added scaling');
}

// Rolling Stone: fix damage model (ongoing per round, not one-time)
const rollingStone = traps.find(t => t.id === 'rolling-stone');
if (rollingStone) {
  rollingStone.effect = "A 5-foot-radius stone sphere rolls on Initiative 10, moving 60 feet per turn. Any creature in the sphere's space must succeed on a DC 15 Dexterity saving throw or take 5 (1d10) Bludgeoning damage. The sphere can move through creatures' spaces and continues until it hits a wall or falls into a pit.";
  rollingStone.damage = "5 (1d10) Bludgeoning per round";
  console.log('  Fixed Rolling Stone: damage 10d10 one-shot → 1d10 per round (ongoing)');
}

fs.writeFileSync(trapsPath, JSON.stringify(traps, null, 2) + '\n');
console.log('  Saved traps.json\n');

// ============================================================
// 3. DISEASES
// ============================================================
console.log('=== DISEASES ===');
const diseasesPath = path.join(dataDir, 'diseases.json');
const diseases = JSON.parse(fs.readFileSync(diseasesPath, 'utf8'));

// Cackle Fever: incubation 1d4 hours → 1d4 days, add initial Exhaustion
const cackleFever = diseases.find(d => d.id === 'cackle-fever');
if (cackleFever) {
  cackleFever.incubation = '1d4 days';
  cackleFever.effect = "After the incubation period, the infected creature gains 1 level of Exhaustion. While Exhausted, any event that causes the infected creature great stress—including entering combat, taking damage, experiencing fear, or having a nightmare—forces the creature to make a DC 13 Constitution saving throw. On a failed save, the creature takes 5 (1d10) Psychic damage and is Incapacitated with mad laughter for 1 minute. The creature can repeat the saving throw at the end of each of its turns, ending the mad laughter on a success. Any Humanoid creature that starts its turn within a 10-foot Emanation of an infected creature in the throes of mad laughter must succeed on a DC 10 Constitution saving throw or also become infected with the disease.";
  cackleFever.mechanicalEffect = "1 Exhaustion level gained. Stress triggers DC 13 CON save or 1d10 Psychic damage + Incapacitated (mad laughter) for 1 minute. Contagious: DC 10 CON within 10-ft Emanation.";
  cackleFever.cure = "The infected creature must succeed on three DC 13 Constitution saving throws, one at the end of each Long Rest, to recover from the disease. Each success reduces Exhaustion by 1; cured when Exhaustion drops below 1. A Greater Restoration spell or similar magic also cures the disease.";
  console.log('  Fixed Cackle Fever: incubation 1d4 hours → 1d4 days, added Exhaustion level, updated to 2024 wording');
}

// Sight Rot: update cure to include Herbalism Kit detail
const sightRot = diseases.find(d => d.id === 'sight-rot');
if (sightRot) {
  sightRot.cure = "A Lesser Restoration spell or similar magic ends the contagion. Applying an ointment crafted with an Herbalism Kit to the eyes before finishing a Long Rest also ends the contagion (requires 3 separate applications over 3 Long Rests).";
  console.log('  Fixed Sight Rot: updated cure to include Herbalism Kit 3-application detail');
}

fs.writeFileSync(diseasesPath, JSON.stringify(diseases, null, 2) + '\n');
console.log('  Saved diseases.json\n');

// ============================================================
// 4. HAZARDS
// ============================================================
console.log('=== HAZARDS ===');
const hazardsPath = path.join(dataDir, 'hazards.json');
const hazards = JSON.parse(fs.readFileSync(hazardsPath, 'utf8'));

// River Styx: damage 8d8 → 8d12, duration 1d4 days → 30 days
const riverStyx = hazards.find(h => h.id === 'river-styx');
if (riverStyx) {
  riverStyx.effect = "A creature that drinks from the Styx, enters the river, or starts its turn in the river makes a DC 20 Intelligence saving throw. On a failed save, the creature takes 19 (8d12) Psychic damage and can't cast spells or take the Magic action for 30 days. An affected creature can drink from and swim in the Styx without additional effects. The effect can be ended only by Greater Restoration, Heal, or Wish. If not ended after 30 days, the effect becomes permanent and the creature loses all its memories.";
  riverStyx.damage = "19 (8d12) Psychic";
  console.log('  Fixed River Styx: damage 8d8 → 8d12 Psychic, duration 1d4 days → 30 days');
}

// Yellow Mold: add ongoing damage per turn while Poisoned
const yellowMold = hazards.find(h => h.id === 'yellow-mold');
if (yellowMold) {
  yellowMold.effect = "When touched or disturbed, yellow mold ejects a cloud of spores in a 10-foot Cube. Each creature in the area must succeed on a DC 15 Constitution saving throw or take 11 (2d10) Poison damage and become Poisoned for 1 minute. While Poisoned in this way, the creature takes 5 (1d10) Poison damage at the start of each of its turns. The creature can repeat the saving throw at the end of each of its turns, ending the effect on a success.";
  yellowMold.damage = "11 (2d10) Poison + 5 (1d10) per turn while Poisoned";
  console.log('  Fixed Yellow Mold: added 1d10 ongoing damage per turn while Poisoned');
}

// Rockslide: add Restrained/buried mechanic
const rockslide = hazards.find(h => h.id === 'rockslide');
if (rockslide) {
  rockslide.effect = "Each creature in areas covered by the rockslide must make a DC 15 Dexterity saving throw, taking 11 (2d10) Bludgeoning damage on a failure or half on a success. On a failure, the creature is also knocked Prone and Restrained (buried under rubble). A DC 15 Strength (Athletics) check frees a buried creature. Scaling: 22 (4d10) at levels 5-10, 55 (10d10) at levels 11-16, 99 (18d10) at levels 17-20.";
  rockslide.damage = "11 (2d10) Bludgeoning (levels 1-4)";
  console.log('  Fixed Rockslide: added Restrained/buried mechanic, corrected base damage');
}

// Inferno: add Burning condition
const inferno = hazards.find(h => h.id === 'inferno');
if (inferno) {
  inferno.effect = "An inferno consists of at least four contiguous 10-foot Cubes of fire. Each 10-foot Cube can be doused with 10 gallons of water. A strong wind for 1 minute causes it to grow, adding 1d4 new 10-foot Cubes. Deprived of fuel it burns out after 1d10 minutes. It damages unattended vegetation/objects for 22 (4d10) Fire damage immediately and again each minute. A creature that enters the inferno for the first time on a turn or starts its turn there takes 22 (4d10) Fire damage and has the Burning condition.";
  console.log('  Fixed Inferno: added Burning condition');
}

// Collapsing Roof (hazard): update damage to match DMG 2024
const collapsingRoofHazard = hazards.find(h => h.id === 'collapsing-roof');
if (collapsingRoofHazard) {
  collapsingRoofHazard.effect = "Each creature in the area must make a DC 15 Dexterity saving throw, taking 22 (4d10) Bludgeoning damage on a failure or half on a success. On a failure, the creature is also Restrained (buried under rubble). A DC 15 Strength (Athletics) check frees a buried creature. Scaling: 44 (8d10) at levels 5-10, 110 (20d10) at levels 11-16, 176 (32d10) at levels 17-20.";
  collapsingRoofHazard.damage = "22 (4d10) Bludgeoning";
  console.log('  Fixed Collapsing Roof (hazard): added Restrained/buried mechanic, added scaling note');
}

fs.writeFileSync(hazardsPath, JSON.stringify(hazards, null, 2) + '\n');
console.log('  Saved hazards.json\n');

// ============================================================
// 5. ENVIRONMENTAL EFFECTS
// ============================================================
console.log('=== ENVIRONMENTAL EFFECTS ===');
const envPath = path.join(dataDir, 'environmental-effects.json');
const envEffects = JSON.parse(fs.readFileSync(envPath, 'utf8'));

// Wild Magic Zone: d20 roll of 1 → 20
const wildMagic = envEffects.find(e => e.id === 'wild-magic-zone');
if (wildMagic) {
  wildMagic.effect = "Whenever a creature casts a spell of 1st level or higher in a wild magic zone, the DM rolls a d20. On a 20, the caster rolls on the Wild Magic Surge table. Additionally, any spell with a duration of 1 minute or longer has a 50% chance of ending early (check each round).";
  wildMagic.mechanicalEffect = "Spells may trigger Wild Magic Surge on d20 roll of 20; duration spells may end early";
  console.log('  Fixed Wild Magic Zone: surge trigger d20 roll of 1 → 20');
}

// Blessed Beneficence: add Fiend/Undead exclusion
const blessed = envEffects.find(e => e.id === 'blessed-beneficence');
if (blessed) {
  blessed.effect = "Creatures in this area that are not Fiends or Undead gain the benefit of the Bless spell. Additionally, finishing a Long Rest in this area grants the benefit of a Lesser Restoration spell.";
  blessed.mechanicalEffect = "Bless effect on non-Fiend/non-Undead creatures; Long Rest grants Lesser Restoration";
  console.log('  Fixed Blessed Beneficence: added Fiend/Undead exclusion');
}

// Thin Ice: update to weight-based mechanic per DMG 2024
const thinIce = envEffects.find(e => e.id === 'thin-ice');
if (thinIce) {
  thinIce.effect = "Thin ice has a weight tolerance of 5d10 × 10 pounds per 10-foot square. When the total weight on a 10-foot square exceeds the tolerance, the ice breaks and creatures on it fall through into frigid water below. A creature on thin ice can move at half speed to distribute weight. Crawling distributes weight and prevents breakage.";
  thinIce.mechanicalEffect = "Weight tolerance: 5d10 × 10 lbs per 10-ft square; ice breaks when exceeded";
  console.log('  Fixed Thin Ice: updated to weight-based mechanic per DMG 2024');
}

fs.writeFileSync(envPath, JSON.stringify(envEffects, null, 2) + '\n');
console.log('  Saved environmental-effects.json\n');

// ============================================================
// 6. BASTION FACILITIES
// ============================================================
console.log('=== BASTION FACILITIES ===');
const bastionPath = path.join(dataDir, 'bastion-facilities.json');
const bastion = JSON.parse(fs.readFileSync(bastionPath, 'utf8'));

const special = bastion.specialFacilities;

// War Room: defaultSpace roomy → vast
const warRoom = special.find(f => f.type === 'war-room');
if (warRoom) {
  warRoom.defaultSpace = 'vast';
  console.log('  Fixed War Room: defaultSpace roomy → vast');
}

// Sanctum: defaultSpace vast → roomy
const sanctum = special.find(f => f.type === 'sanctum');
if (sanctum) {
  sanctum.defaultSpace = 'roomy';
  console.log('  Fixed Sanctum: defaultSpace vast → roomy');
}

// Demiplane: hirelingCount 0 → 1
const demiplane = special.find(f => f.type === 'demiplane');
if (demiplane) {
  demiplane.hirelingCount = 1;
  console.log('  Fixed Demiplane: hirelingCount 0 → 1');
}

// Trophy Room: hirelingCount 0 → 1, order empower → research
const trophyRoom = special.find(f => f.type === 'trophy-room');
if (trophyRoom) {
  trophyRoom.hirelingCount = 1;
  trophyRoom.orders = ['research'];
  // Update order options to match
  trophyRoom.orderOptions = [
    {
      order: 'research',
      name: 'Research: Lore',
      description: 'Commission the facility to research a topic related to a trophy on display. The hireling provides an answer to one question about the trophy\'s origin, history, or significance.',
      daysRequired: 7,
      cost: 0
    },
    {
      order: 'research',
      name: 'Research: Trinket Trophy',
      description: 'Roll on the Implements table for a chance to discover a magical trinket among the collection.',
      daysRequired: 7,
      cost: 0
    }
  ];
  console.log('  Fixed Trophy Room: hirelingCount 0 → 1, order empower → research');
}

// Meditation Chamber: hirelingCount 0 → 1
const medChamber = special.find(f => f.type === 'meditation-chamber');
if (medChamber) {
  medChamber.hirelingCount = 1;
  console.log('  Fixed Meditation Chamber: hirelingCount 0 → 1');
}

// Teleportation Circle: hirelingCount 0 → 1
const teleCircle = special.find(f => f.type === 'teleportation-circle');
if (teleCircle) {
  teleCircle.hirelingCount = 1;
  teleCircle.orders = ['recruit'];
  teleCircle.orderOptions = [
    {
      order: 'recruit',
      name: 'Recruit: Spellcaster',
      description: 'The NPC spellcaster can cast a Wizard spell of level 4 or lower (or level 8 if you are level 17+). The spellcaster stays for 14 days or until a spell is cast.',
      daysRequired: 14,
      cost: 0
    }
  ];
  console.log('  Fixed Teleportation Circle: hirelingCount 0 → 1, added Recruit order with spellcaster');
}

// Pub: replace homebrew beverages with DMG 2024 official beverages
const pub = special.find(f => f.type === 'pub');
if (pub) {
  pub.tables = {
    specials: [
      {
        name: "Bigby's Burden",
        effect: "For 24 hours, the drinker is affected as if by the Enlarge/Reduce spell (Enlarge option, no concentration)."
      },
      {
        name: "Kiss of the Spider Queen",
        effect: "For 24 hours, the drinker gains the benefits of Spider Climb (can climb difficult surfaces, including ceilings, without needing an ability check)."
      },
      {
        name: "Moonlight Serenade",
        effect: "For 24 hours, the drinker gains Darkvision out to 60 feet."
      },
      {
        name: "Positive Reinforcement",
        effect: "For 24 hours, the drinker has Resistance to Necrotic damage."
      },
      {
        name: "Sterner Stuff",
        effect: "For 24 hours, the drinker automatically succeeds on saving throws against the Frightened condition."
      }
    ]
  };
  console.log('  Fixed Pub: replaced homebrew beverages with DMG 2024 official beverages');
}

// Workshop: add Source of Inspiration feature
const workshop = special.find(f => f.type === 'workshop');
if (workshop) {
  workshop.permanentBenefit = "Source of Inspiration: After finishing a Long Rest in the Workshop, you gain Heroic Inspiration. This benefit lasts until you finish another Long Rest.";
  console.log('  Fixed Workshop: added Source of Inspiration permanent benefit');
}

fs.writeFileSync(bastionPath, JSON.stringify(bastion, null, 2) + '\n');
console.log('  Saved bastion-facilities.json\n');

console.log('=== ALL DMG 2024 DATA FIXES COMPLETE ===');
console.log('Files updated: poisons.json, traps.json, diseases.json, hazards.json, environmental-effects.json, bastion-facilities.json');
