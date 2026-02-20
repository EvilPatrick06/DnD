// Fix Beholder and Balor to match MM 2025
const fs = require('fs');
const path = require('path');

const monstersPath = path.join(__dirname, '../src/renderer/public/data/5e/monsters.json');
let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

// === FIX BEHOLDER ===
const beholder = monsters.find(m => m.id === 'beholder');
if (beholder) {
  // HP: 190 (20d10+80)
  beholder.hp = 190;
  beholder.hitDice = '20d10+80';

  // Speed: 5 ft., Fly 40 ft. (hover)
  beholder.speed = { walk: 5, fly: 40, hover: true };

  // STR: 10 → 16
  beholder.abilityScores.str = 16;

  // Initiative: +12 (22)
  beholder.initiative = { modifier: 12, score: 22 };

  // Saves: CON +9, WIS +7 only (MM 2025)
  beholder.savingThrows = { con: 9, wis: 7 };

  // Add Legendary Resistance trait if missing
  if (!beholder.traits) beholder.traits = [];
  const hasLR = beholder.traits.some(t => t.name.includes('Legendary Resistance'));
  if (!hasLR) {
    beholder.traits.unshift({
      name: 'Legendary Resistance (3/Day, or 4/Day in Lair)',
      description: 'If the beholder fails a saving throw, it can choose to succeed instead.'
    });
  } else {
    // Update existing
    const lr = beholder.traits.find(t => t.name.includes('Legendary Resistance'));
    lr.name = 'Legendary Resistance (3/Day, or 4/Day in Lair)';
  }

  // Add Multiattack at beginning of actions
  const hasMulti = beholder.actions.some(a => a.name === 'Multiattack');
  if (!hasMulti) {
    beholder.actions.unshift({
      name: 'Multiattack',
      description: 'The beholder uses Eye Rays three times.',
      multiattackActions: ['Eye Rays', 'Eye Rays', 'Eye Rays']
    });
  }

  // Update Bite to match MM 2025 (+8, 3d6+3)
  const bite = beholder.actions.find(a => a.name === 'Bite');
  if (bite) {
    bite.description = 'Melee Attack Roll: +8, reach 5 ft. Hit: 13 (3d6 + 3) Piercing damage.';
    bite.toHit = 8;
    bite.damageDice = '3d6+3';
  }

  // Add Antimagic Cone as Bonus Action
  if (!beholder.bonusActions) beholder.bonusActions = [];
  const hasAntimagic = beholder.bonusActions.some(a => a.name === 'Antimagic Cone');
  if (!hasAntimagic) {
    // Remove from actions/traits if it exists there
    beholder.actions = beholder.actions.filter(a => a.name !== 'Antimagic Cone');
    if (beholder.traits) beholder.traits = beholder.traits.filter(t => t.name !== 'Antimagic Cone');

    beholder.bonusActions.push({
      name: 'Antimagic Cone',
      description: "The beholder's central eye emits an antimagic wave in a 150-foot Cone. Until the start of the beholder's next turn, that area acts as an Antimagic Field spell, and that area works against the beholder's own Eye Rays."
    });
  }

  // Update Legendary Actions: Chomp + Glare
  beholder.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Chomp',
        description: 'The beholder makes two Bite attacks.'
      },
      {
        name: 'Glare',
        description: 'The beholder uses Eye Rays.'
      }
    ]
  };

  // Add lair effects
  beholder.lairActions = {
    initiativeCount: 20,
    actions: []
  };
  beholder.regionalEffects = {
    effects: [
      {
        name: 'Scopophobia',
        description: "Creatures within 1 mile of the lair feel as if they're being watched. Any creature (excluding the beholder and its allies) that finishes a Short Rest while within 1 mile of the lair must succeed on a DC 13 Wisdom saving throw or gain no benefit from that rest."
      },
      {
        name: 'Warping Terrain',
        description: 'Minor warps in reality occur near the lair; any creature (excluding the beholder) within 1 mile of the lair that makes a D20 Test and rolls a 1 has the Prone condition.'
      }
    ],
    endCondition: 'If the beholder dies or moves its lair elsewhere, these effects end immediately.'
  };

  console.log('Fixed Beholder: HP, speed, STR, initiative, saves, traits, multiattack, bite, antimagic cone→bonus, legendary actions, lair');
}

// === FIX BALOR ===
const balor = monsters.find(m => m.id === 'balor');
if (balor) {
  // Add Teleport bonus action
  if (!balor.bonusActions) balor.bonusActions = [];
  const hasTeleport = balor.bonusActions.some(a => a.name === 'Teleport');
  if (!hasTeleport) {
    balor.bonusActions.push({
      name: 'Teleport',
      description: 'The balor teleports itself or a willing demon within 10 feet of itself up to 60 feet to an unoccupied space the balor can see.'
    });
  }

  // Verify Flame Whip description matches MM 2025
  const whip = balor.actions.find(a => a.name === 'Flame Whip');
  if (whip) {
    whip.description = 'Melee Attack Roll: +14, reach 30 ft. Hit: 18 (3d6 + 8) Force damage plus 17 (5d6) Fire damage. If the target is a Huge or smaller creature, the balor pulls the target up to 25 feet straight toward itself, and the target has the Prone condition.';
    whip.reach = 30;
    whip.damageDice = '3d6+8';
    whip.damageType = 'Force';
    whip.additionalDamage = '17 (5d6) Fire damage';
  }

  // Verify Lightning Blade
  const blade = balor.actions.find(a => a.name === 'Lightning Blade');
  if (blade) {
    blade.description = "Melee Attack Roll: +14, reach 10 ft. Hit: 21 (3d8 + 8) Force damage plus 22 (4d10) Lightning damage, and the target can't take Reactions until the start of the balor's next turn.";
    blade.reach = 10;
    blade.damageDice = '3d8+8';
    blade.damageType = 'Force';
    blade.additionalDamage = '22 (4d10) Lightning damage';
  }

  console.log('Fixed Balor: added Teleport bonus action, verified Flame Whip and Lightning Blade');
}

fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
console.log('\nSaved monsters.json');
