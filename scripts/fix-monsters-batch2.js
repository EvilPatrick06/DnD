// Fix 10 monsters to match MM 2025 stat blocks (batch 2)
// Rakshasa, Ancient Red Dragon, Death Knight, Vampire, Hydra, Aboleth, Chuul, Storm Giant, Solar, Kraken
const fs = require('fs');
const path = require('path');

const monstersPath = path.join(__dirname, '../src/renderer/public/data/5e/monsters.json');
let monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

// === 1. RAKSHASA ===
const rakshasa = monsters.find(m => m.id === 'rakshasa');
if (rakshasa) {
  rakshasa.ac = 17;
  delete rakshasa.acType;
  rakshasa.hp = 221;
  rakshasa.hitDice = '26d8+104';
  rakshasa.speed = { walk: 40 };
  rakshasa.initiative = { modifier: 8, score: 18 };
  rakshasa.abilityScores = { str: 14, dex: 17, con: 18, int: 13, wis: 16, cha: 20 };
  rakshasa.savingThrows = {};
  rakshasa.skills = { Deception: 10, Insight: 8, Perception: 8 };
  rakshasa.conditionImmunities = ['charmed', 'frightened'];
  delete rakshasa.resistances;
  delete rakshasa.damageImmunities;
  rakshasa.senses = { truesight: 60, passivePerception: 18 };
  rakshasa.languages = ['Common', 'Infernal'];
  rakshasa.cr = 13;
  rakshasa.xp = 10000;
  rakshasa.proficiencyBonus = 5;

  rakshasa.traits = [
    {
      name: 'Greater Magic Resistance',
      description: "The rakshasa automatically succeeds on saving throws against spells and other magical effects, and the attack rolls of spells automatically miss it. Without the rakshasa's permission, no spell can observe the rakshasa remotely or detect its thoughts, creature type, or alignment."
    },
    {
      name: 'Fiendish Restoration',
      description: "If the rakshasa dies outside the Nine Hells, its body turns to ichor, and it gains a new body instantly, reviving with all its Hit Points somewhere in the Nine Hells."
    }
  ];

  rakshasa.actions = [
    {
      name: 'Multiattack',
      description: 'The rakshasa makes three Cursed Touch attacks.',
      multiattackActions: ['Cursed Touch', 'Cursed Touch', 'Cursed Touch']
    },
    {
      name: 'Cursed Touch',
      description: "Melee Attack Roll: +10, reach 5 ft. Hit: 12 (2d6 + 5) Slashing damage plus 19 (3d12) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short or Long Rest.",
      attackType: 'melee',
      toHit: 10,
      reach: 5,
      targets: 1,
      damageDice: '2d6+5',
      damageType: 'Slashing',
      additionalDamage: '19 (3d12) Necrotic damage'
    },
    {
      name: 'Baleful Command (Recharge 5-6)',
      description: "Wisdom Saving Throw: DC 18, each enemy in a 30-foot Emanation originating from the rakshasa. Failure: 28 (8d6) Psychic damage, and the target has the Frightened and Incapacitated conditions until the start of the rakshasa's next turn.",
      saveDC: 18,
      saveAbility: 'WIS'
    },
    {
      name: 'Spellcasting',
      description: "The rakshasa casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): At Will: Detect Magic, Detect Thoughts, Disguise Self, Mage Hand, Minor Illusion. 1/Day Each: Fly, Invisibility, Major Image, Plane Shift."
    }
  ];

  delete rakshasa.bonusActions;
  delete rakshasa.reactions;
  delete rakshasa.legendaryActions;
  delete rakshasa.spellcasting;

  console.log('Fixed Rakshasa: AC 17, HP 221, speed 40, Greater Magic Resistance, Cursed Touch, Baleful Command');
}

// === 2. ANCIENT RED DRAGON ===
const ard = monsters.find(m => m.id === 'ancient-red-dragon');
if (ard) {
  ard.hp = 507;
  ard.hitDice = '26d20+234';
  ard.speed = { walk: 40, climb: 40, fly: 80 };
  ard.initiative = { modifier: 14, score: 24 };
  ard.abilityScores = { str: 30, dex: 10, con: 29, int: 18, wis: 15, cha: 27 };
  ard.savingThrows = { dex: 7, con: 9, wis: 9 };
  ard.skills = { Perception: 16, Stealth: 7 };
  ard.damageImmunities = ['fire'];
  delete ard.resistances;
  delete ard.conditionImmunities;
  ard.senses = { blindsight: 60, darkvision: 120, passivePerception: 26 };
  ard.languages = ['Common', 'Draconic'];
  ard.cr = 24;
  ard.xp = 62000;
  ard.proficiencyBonus = 7;

  ard.traits = [
    {
      name: 'Legendary Resistance (4/Day, or 5/Day in Lair)',
      description: 'If the dragon fails a saving throw, it can choose to succeed instead.'
    }
  ];

  ard.actions = [
    {
      name: 'Multiattack',
      description: 'The dragon makes three Rend attacks. It can replace one attack with a use of Spellcasting to cast Scorching Ray (level 3 version).',
      multiattackActions: ['Rend', 'Rend', 'Rend']
    },
    {
      name: 'Rend',
      description: 'Melee Attack Roll: +17, reach 15 ft. Hit: 19 (2d8 + 10) Slashing damage plus 10 (3d6) Fire damage.',
      attackType: 'melee',
      toHit: 17,
      reach: 15,
      targets: 1,
      damageDice: '2d8+10',
      damageType: 'Slashing',
      additionalDamage: '10 (3d6) Fire damage'
    },
    {
      name: 'Fire Breath (Recharge 5-6)',
      description: 'Dexterity Saving Throw: DC 24, each creature in a 90-foot Cone. Failure: 91 (26d6) Fire damage. Success: Half damage.',
      saveDC: 24,
      saveAbility: 'DEX'
    },
    {
      name: 'Spellcasting',
      description: "The dragon casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 23, +15 to hit with spell attacks): At Will: Command (level 2 version), Detect Magic, Scorching Ray (level 3 version). 1/Day: Fireball (level 6 version), Scrying."
    }
  ];

  ard.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Commanding Presence',
        description: "The dragon uses Spellcasting to cast Command (level 2 version). The dragon can't take this action again until the start of its next turn."
      },
      {
        name: 'Fiery Rays',
        description: "The dragon uses Spellcasting to cast Scorching Ray (level 3 version). The dragon can't take this action again until the start of its next turn."
      },
      {
        name: 'Pounce',
        description: 'The dragon moves up to half its Speed, and it makes one Rend attack.'
      }
    ]
  };

  ard.regionalEffects = {
    effects: [
      {
        name: 'Burning Heat',
        description: "The area within 1 mile of the lair is an area of extreme heat. A burning creature or object takes an additional 1d4 Fire damage at the start of each of its turns."
      },
      {
        name: 'Smoldering Haze',
        description: "The area within 1 mile of the lair is Lightly Obscured with clouds of ash. Whenever a creature other than the dragon or one of its allies finishes a Long Rest in that area, that creature must succeed on a DC 15 Constitution saving throw or have the Poisoned condition for 1 hour."
      }
    ],
    endCondition: 'If the dragon dies or moves its lair elsewhere, these effects end immediately.'
  };

  delete ard.bonusActions;
  delete ard.reactions;
  delete ard.lairActions;
  delete ard.spellcasting;

  console.log('Fixed Ancient Red Dragon: HP 507, initiative +14, Rend attacks, spellcasting, legendary actions');
}

// === 3. DEATH KNIGHT ===
const dk = monsters.find(m => m.id === 'death-knight');
if (dk) {
  dk.ac = 20;
  delete dk.acType;
  dk.hp = 199;
  dk.hitDice = '21d8+105';
  dk.speed = { walk: 30 };
  dk.initiative = { modifier: 12, score: 22 };
  dk.abilityScores = { str: 20, dex: 11, con: 20, int: 12, wis: 16, cha: 18 };
  dk.savingThrows = { dex: 6, wis: 9 };
  delete dk.skills;
  dk.damageImmunities = ['necrotic', 'poison'];
  dk.conditionImmunities = ['exhaustion', 'frightened', 'poisoned'];
  delete dk.resistances;
  dk.senses = { darkvision: 120, passivePerception: 13 };
  dk.languages = ['Abyssal', 'Common'];
  dk.cr = 17;
  dk.xp = 18000;
  dk.proficiencyBonus = 6;

  dk.traits = [
    {
      name: 'Legendary Resistance (3/Day)',
      description: 'If the death knight fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Magic Resistance',
      description: 'The death knight has Advantage on saving throws against spells and other magical effects.'
    },
    {
      name: 'Marshal Undead',
      description: "Undead creatures of the death knight's choice (excluding itself) in a 60-foot Emanation originating from it have Advantage on attack rolls and saving throws. It can't use this trait if it has the Incapacitated condition."
    },
    {
      name: 'Undead Restoration',
      description: "If the death knight is destroyed before it atones for its evil, it gains a new body in 1d10 days, reviving with all its Hit Points. The new body appears in a location significant to the death knight."
    }
  ];

  dk.actions = [
    {
      name: 'Multiattack',
      description: 'The death knight makes three Dread Blade attacks.',
      multiattackActions: ['Dread Blade', 'Dread Blade', 'Dread Blade']
    },
    {
      name: 'Dread Blade',
      description: 'Melee Attack Roll: +11, reach 5 ft. Hit: 12 (2d6 + 5) Slashing damage plus 13 (3d8) Necrotic damage.',
      attackType: 'melee',
      toHit: 11,
      reach: 5,
      targets: 1,
      damageDice: '2d6+5',
      damageType: 'Slashing',
      additionalDamage: '13 (3d8) Necrotic damage'
    },
    {
      name: 'Hellfire Orb (Recharge 5-6)',
      description: "Dexterity Saving Throw: DC 18, each creature in a 20-foot-radius Sphere centered on a point the death knight can see within 120 feet. Failure: 35 (10d6) Fire damage plus 35 (10d6) Necrotic damage. Success: Half damage.",
      saveDC: 18,
      saveAbility: 'DEX'
    },
    {
      name: 'Spellcasting',
      description: "The death knight casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 18): At Will: Command, Phantom Steed. 2/Day: Destructive Wave (Necrotic), Dispel Magic."
    }
  ];

  dk.reactions = [
    {
      name: 'Parry',
      description: "Trigger: The death knight is hit by a melee attack roll while holding a weapon. Response: The death knight adds 6 to its AC against that attack, possibly causing it to miss."
    }
  ];

  dk.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Dread Authority',
        description: "The death knight uses Spellcasting to cast Command. The death knight can't take this action again until the start of its next turn."
      },
      {
        name: 'Fell Word',
        description: "Constitution Saving Throw: DC 18, one creature the death knight can see within 120 feet. Failure: 17 (5d6) Necrotic damage, and the target's Hit Point maximum decreases by an amount equal to the damage taken. The death knight can't take this action again until the start of its next turn.",
        saveDC: 18,
        saveAbility: 'CON'
      },
      {
        name: 'Lunge',
        description: 'The death knight moves up to half its Speed, and it makes one Dread Blade attack.'
      }
    ]
  };

  delete dk.bonusActions;
  delete dk.spellcasting;
  delete dk.lairActions;
  delete dk.regionalEffects;

  console.log('Fixed Death Knight: HP 199, initiative +12, Legendary Resistance, Magic Resistance, Dread Blade, Hellfire Orb');
}

// === 4. VAMPIRE ===
const vamp = monsters.find(m => m.id === 'vampire');
if (vamp) {
  vamp.ac = 16;
  delete vamp.acType;
  vamp.hp = 195;
  vamp.hitDice = '23d8+92';
  vamp.speed = { walk: 40, climb: 40 };
  vamp.initiative = { modifier: 14, score: 24 };
  vamp.abilityScores = { str: 18, dex: 18, con: 18, int: 17, wis: 15, cha: 18 };
  vamp.savingThrows = { dex: 9, con: 9, wis: 7, cha: 9 };
  vamp.skills = { Perception: 7, Stealth: 9 };
  vamp.resistances = ['necrotic'];
  delete vamp.damageImmunities;
  delete vamp.conditionImmunities;
  vamp.senses = { darkvision: 120, passivePerception: 17 };
  vamp.languages = ['Common plus two other languages'];

  vamp.traits = [
    {
      name: 'Legendary Resistance (3/Day, or 4/Day in Lair)',
      description: 'If the vampire fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Misty Escape',
      description: "If the vampire drops to 0 Hit Points outside its resting place, the vampire uses Shape-Shift to become mist (no action required). If it can't use Shape-Shift, it is destroyed. While it has 0 Hit Points in mist form, it can't return to its vampire form, and it must reach its resting place within 2 hours or be destroyed. Once in its resting place, it returns to its vampire form and has the Paralyzed condition until it regains any Hit Points, and it regains 1 Hit Point after spending 1 hour there."
    },
    {
      name: 'Spider Climb',
      description: "The vampire can climb difficult surfaces, including along ceilings, without needing to make an ability check."
    },
    {
      name: 'Vampire Weakness',
      description: "The vampire has these weaknesses: Forbiddance (can't enter a residence without invitation), Running Water (takes 20 Acid damage if it ends its turn in running water), Stake to the Heart (Paralyzed while weapon is in heart while Incapacitated in resting place), Sunlight (takes 20 Radiant damage at start of turn in sunlight, Disadvantage on attack rolls and ability checks)."
    }
  ];

  vamp.actions = [
    {
      name: 'Multiattack',
      description: 'The vampire makes two Grave Strike attacks and uses Bite.',
      multiattackActions: ['Grave Strike', 'Grave Strike', 'Bite']
    },
    {
      name: 'Grave Strike',
      description: "Melee Attack Roll: +9, reach 5 ft. Hit: 8 (1d8 + 4) Bludgeoning damage plus 7 (2d6) Necrotic damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two hands.",
      attackType: 'melee',
      toHit: 9,
      reach: 5,
      targets: 1,
      damageDice: '1d8+4',
      damageType: 'Bludgeoning',
      additionalDamage: '7 (2d6) Necrotic damage'
    },
    {
      name: 'Bite',
      description: "Constitution Saving Throw: DC 17, one creature within 5 feet that is willing or that has the Grappled, Incapacitated, or Restrained condition. Failure: 6 (1d4 + 4) Piercing damage plus 13 (3d8) Necrotic damage. The target's Hit Point maximum decreases by an amount equal to the Necrotic damage taken, and the vampire regains Hit Points equal to that amount.",
      saveDC: 17,
      saveAbility: 'CON'
    }
  ];

  vamp.bonusActions = [
    {
      name: 'Charm (Recharge 5-6)',
      description: "The vampire casts Charm Person, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 17), and the duration is 24 hours. The Charmed target is a willing recipient of the vampire's Bite. When the spell ends, the target is unaware it was Charmed by the vampire."
    },
    {
      name: 'Shape-Shift',
      description: "If the vampire isn't in sunlight or running water, it shape-shifts into a Tiny bat (Speed 5 ft., Fly Speed 30 ft.) or a Medium cloud of mist (Speed 5 ft., Fly Speed 20 ft. [hover]), or it returns to its vampire form. While in bat form, the vampire can't speak. While in mist form, the vampire can't take any actions, speak, or manipulate objects. It has Resistance to all damage, except the damage it takes from sunlight."
    }
  ];

  vamp.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Beguile',
        description: "The vampire casts Command, requiring no spell components and using Charisma as the spellcasting ability (spell save DC 17). The vampire can't take this action again until the start of its next turn."
      },
      {
        name: 'Deathless Strike',
        description: 'The vampire moves up to half its Speed, and it makes one Grave Strike attack.'
      }
    ]
  };

  vamp.lairActions = {
    initiativeCount: 20,
    actions: []
  };
  vamp.regionalEffects = {
    effects: [
      {
        name: 'Children of the Night',
        description: 'From dusk until dawn, Medium or smaller Beasts have the Charmed condition while within 1 mile of the lair.'
      },
      {
        name: 'Looming Shadows',
        description: "Shadows within 1 mile seem to move as if alive. Any creature (excluding the vampire and its allies) that finishes a Short Rest within 1 mile must succeed on a DC 15 Wisdom saving throw or gain no benefit from that rest."
      },
      {
        name: 'Mists',
        description: 'The area within 1 mile is Lightly Obscured by persistent, creeping fog. The vampire and any creatures of its choice are unaffected.'
      }
    ],
    endCondition: 'These lair effects end immediately if the vampire dies or moves its lair elsewhere.'
  };

  delete vamp.reactions;
  delete vamp.spellcasting;

  console.log('Fixed Vampire: HP 195, initiative +14, Legendary Resistance, Grave Strike, Charm, Shape-Shift, lair effects');
}

// === 5. HYDRA ===
const hydra = monsters.find(m => m.id === 'hydra');
if (hydra) {
  hydra.hp = 184;
  hydra.hitDice = '16d12+80';
  delete hydra.acType;
  hydra.speed = { walk: 40, swim: 40 };
  hydra.initiative = { modifier: 4, score: 14 };
  hydra.abilityScores = { str: 20, dex: 12, con: 20, int: 2, wis: 10, cha: 7 };
  delete hydra.savingThrows;
  hydra.skills = { Perception: 6 };
  hydra.conditionImmunities = ['blinded', 'charmed', 'deafened', 'frightened', 'stunned', 'unconscious'];
  delete hydra.resistances;
  delete hydra.damageImmunities;
  hydra.senses = { darkvision: 60, passivePerception: 16 };
  hydra.cr = 8;
  hydra.xp = 3900;
  hydra.proficiencyBonus = 3;

  hydra.traits = [
    {
      name: 'Hold Breath',
      description: 'The hydra can hold its breath for 1 hour.'
    },
    {
      name: 'Multiple Heads',
      description: "The hydra has five heads. Whenever the hydra takes 25 damage or more on a single turn, one of its heads dies. The hydra dies if all its heads are dead. At the end of each of its turns when it has at least one living head, the hydra grows two heads for each of its heads that died since its last turn, unless it has taken Fire damage since its last turn. The hydra regains 20 Hit Points when it grows new heads."
    },
    {
      name: 'Reactive Heads',
      description: 'For each head the hydra has beyond one, it gets an extra Reaction that can be used only for Opportunity Attacks.'
    }
  ];

  hydra.actions = [
    {
      name: 'Multiattack',
      description: 'The hydra makes as many Bite attacks as it has heads.',
      multiattackActions: ['Bite', 'Bite', 'Bite', 'Bite', 'Bite']
    },
    {
      name: 'Bite',
      description: 'Melee Attack Roll: +8, reach 10 ft. Hit: 10 (1d10 + 5) Piercing damage.',
      attackType: 'melee',
      toHit: 8,
      reach: 10,
      targets: 1,
      damageDice: '1d10+5',
      damageType: 'Piercing'
    }
  ];

  delete hydra.bonusActions;
  delete hydra.reactions;
  delete hydra.legendaryActions;

  console.log('Fixed Hydra: HP 184, speed 40/swim 40, 6 condition immunities, head regrowth heals 20');
}

// === 6. ABOLETH ===
const aboleth = monsters.find(m => m.id === 'aboleth');
if (aboleth) {
  aboleth.ac = 17;
  delete aboleth.acType;
  aboleth.hp = 150;
  aboleth.hitDice = '20d10+40';
  aboleth.speed = { walk: 10, swim: 40 };
  aboleth.initiative = { modifier: 7, score: 17 };
  aboleth.abilityScores = { str: 21, dex: 9, con: 15, int: 18, wis: 15, cha: 18 };
  aboleth.savingThrows = { dex: 3, con: 6, int: 8, wis: 6 };
  aboleth.skills = { History: 12, Perception: 10 };
  delete aboleth.resistances;
  delete aboleth.damageImmunities;
  delete aboleth.conditionImmunities;
  aboleth.senses = { darkvision: 120, passivePerception: 20 };
  aboleth.languages = ['Deep Speech', 'telepathy 120 ft.'];
  aboleth.cr = 10;
  aboleth.xp = 5900;
  aboleth.proficiencyBonus = 4;

  aboleth.traits = [
    {
      name: 'Amphibious',
      description: 'The aboleth can breathe air and water.'
    },
    {
      name: 'Eldritch Restoration',
      description: "If destroyed, the aboleth gains a new body in 5d10 days, reviving with all its Hit Points in the Far Realm or another location chosen by the DM."
    },
    {
      name: 'Legendary Resistance (3/Day, or 4/Day in Lair)',
      description: 'If the aboleth fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Mucus Cloud',
      description: "While underwater, the aboleth is surrounded by mucus. Constitution Saving Throw: DC 14, each creature in a 5-foot Emanation originating from the aboleth at the end of the aboleth's turn. Failure: The target is cursed. Until the curse ends, the target's skin becomes slimy, the target can breathe air and water, and it can't regain Hit Points unless it is underwater. While the cursed creature is outside a body of water, the creature takes 6 (1d12) Acid damage at the end of every 10 minutes unless moisture is applied to its skin before those minutes have passed."
    },
    {
      name: 'Probing Telepathy',
      description: "If a creature the aboleth can see communicates telepathically with the aboleth, the aboleth learns the creature's greatest desires."
    }
  ];

  aboleth.actions = [
    {
      name: 'Multiattack',
      description: 'The aboleth makes two Tentacle attacks and uses either Consume Memories or Dominate Mind if available.',
      multiattackActions: ['Tentacle', 'Tentacle']
    },
    {
      name: 'Tentacle',
      description: 'Melee Attack Roll: +9, reach 15 ft. Hit: 12 (2d6 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of four tentacles.',
      attackType: 'melee',
      toHit: 9,
      reach: 15,
      targets: 1,
      damageDice: '2d6+5',
      damageType: 'Bludgeoning'
    },
    {
      name: 'Consume Memories',
      description: "Intelligence Saving Throw: DC 16, one creature within 30 feet that is Charmed or Grappled by the aboleth. Failure: 10 (3d6) Psychic damage. Success: Half damage.",
      saveDC: 16,
      saveAbility: 'INT'
    },
    {
      name: 'Dominate Mind (2/Day)',
      description: "Wisdom Saving Throw: DC 16, one creature the aboleth can see within 30 feet. Failure: The target has the Charmed condition until the aboleth dies or is on a different plane of existence from the target. While Charmed, the target acts as an ally to the aboleth and is under its control while within 60 feet of it. The target repeats the save whenever it takes damage as well as after every 24 hours it spends at least 1 mile away from the aboleth, ending the effect on itself on a success.",
      saveDC: 16,
      saveAbility: 'WIS'
    }
  ];

  aboleth.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Lash',
        description: 'The aboleth makes one Tentacle attack.'
      },
      {
        name: 'Psychic Drain',
        description: 'If the aboleth has at least one creature Charmed or Grappled, it uses Consume Memories and regains 5 (1d10) Hit Points.'
      }
    ]
  };

  aboleth.lairActions = {
    initiativeCount: 20,
    actions: [
      {
        name: 'Foul Water',
        description: "Water sources within 1 mile of the lair are supernaturally fouled. Creatures other than the aboleth and its allies that drink such water must succeed on a DC 15 Constitution saving throw or have the Poisoned condition for 1 hour."
      },
      {
        name: 'Psionic Projection',
        description: "While in its lair, the aboleth can cast Project Image, requiring no spell components and using Intelligence as the spellcasting ability (spell save DC 16). When casting the spell this way, the spell's range is 1 mile, and the aboleth can use its telepathy as if it were in the illusion's space."
      }
    ]
  };

  delete aboleth.regionalEffects;
  delete aboleth.bonusActions;
  delete aboleth.reactions;
  delete aboleth.spellcasting;

  console.log('Fixed Aboleth: HP 150, initiative +7, Legendary Resistance, Eldritch Restoration, Dominate Mind, lair actions');
}

// === 7. CHUUL ===
const chuul = monsters.find(m => m.id === 'chuul');
if (chuul) {
  chuul.hp = 76;
  chuul.hitDice = '9d10+27';
  delete chuul.acType;
  chuul.speed = { walk: 30, swim: 30 };
  chuul.initiative = { modifier: 0, score: 10 };
  chuul.abilityScores = { str: 19, dex: 10, con: 16, int: 5, wis: 11, cha: 5 };
  delete chuul.savingThrows;
  chuul.skills = { Perception: 4 };
  chuul.damageImmunities = ['poison'];
  chuul.conditionImmunities = ['poisoned'];
  delete chuul.resistances;
  chuul.senses = { darkvision: 60, passivePerception: 14 };
  chuul.languages = ['Understands Deep Speech but cannot speak'];
  chuul.cr = 4;
  chuul.xp = 1100;
  chuul.proficiencyBonus = 2;

  chuul.traits = [
    {
      name: 'Amphibious',
      description: 'The chuul can breathe air and water.'
    },
    {
      name: 'Sense Magic',
      description: "The chuul senses magic within 120 feet of itself. This trait otherwise works like the Detect Magic spell but isn't itself magical."
    }
  ];

  chuul.actions = [
    {
      name: 'Multiattack',
      description: 'The chuul makes two Pincer attacks and uses Paralyzing Tentacles.',
      multiattackActions: ['Pincer', 'Pincer', 'Paralyzing Tentacles']
    },
    {
      name: 'Pincer',
      description: 'Melee Attack Roll: +6, reach 10 ft. Hit: 9 (1d10 + 4) Bludgeoning damage. If the target is a Large or smaller creature, it has the Grappled condition (escape DC 14) from one of two pincers.',
      attackType: 'melee',
      toHit: 6,
      reach: 10,
      targets: 1,
      damageDice: '1d10+4',
      damageType: 'Bludgeoning'
    },
    {
      name: 'Paralyzing Tentacles',
      description: "Constitution Saving Throw: DC 13, one creature Grappled by the chuul. Failure: The target has the Poisoned condition and repeats the save at the end of each of its turns, ending the effect on itself on a success. After 1 minute, it succeeds automatically. While Poisoned, the target has the Paralyzed condition.",
      saveDC: 13,
      saveAbility: 'CON'
    }
  ];

  delete chuul.bonusActions;
  delete chuul.reactions;
  delete chuul.legendaryActions;

  console.log('Fixed Chuul: HP 76, Poison immunity, Pincer + Paralyzing Tentacles');
}

// === 8. STORM GIANT ===
const sg = monsters.find(m => m.id === 'storm-giant');
if (sg) {
  sg.hp = 230;
  sg.hitDice = '20d12+100';
  delete sg.acType;
  sg.speed = { walk: 50, fly: 25, hover: true, swim: 50 };
  sg.initiative = { modifier: 7, score: 17 };
  sg.abilityScores = { str: 29, dex: 14, con: 20, int: 16, wis: 20, cha: 18 };
  sg.savingThrows = { str: 14, con: 10, wis: 10, cha: 9 };
  sg.skills = { Arcana: 8, Athletics: 14, History: 8, Perception: 10 };
  sg.resistances = ['cold'];
  sg.damageImmunities = ['lightning', 'thunder'];
  delete sg.conditionImmunities;
  sg.senses = { darkvision: 120, truesight: 30, passivePerception: 20 };
  sg.languages = ['Common', 'Giant'];

  sg.traits = [
    {
      name: 'Amphibious',
      description: 'The giant can breathe air and water.'
    }
  ];

  sg.actions = [
    {
      name: 'Multiattack',
      description: 'The giant makes two attacks, using Storm Sword or Thunderbolt in any combination.',
      multiattackActions: ['Storm Sword', 'Storm Sword']
    },
    {
      name: 'Storm Sword',
      description: 'Melee Attack Roll: +14, reach 10 ft. Hit: 23 (4d6 + 9) Slashing damage plus 13 (3d8) Lightning damage.',
      attackType: 'melee',
      toHit: 14,
      reach: 10,
      targets: 1,
      damageDice: '4d6+9',
      damageType: 'Slashing',
      additionalDamage: '13 (3d8) Lightning damage'
    },
    {
      name: 'Thunderbolt',
      description: "Ranged Attack Roll: +14, range 500 ft. Hit: 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn.",
      attackType: 'ranged',
      toHit: 14,
      rangeNormal: 500,
      targets: 1,
      damageDice: '2d12+9',
      damageType: 'Lightning'
    },
    {
      name: 'Lightning Storm (Recharge 5-6)',
      description: 'Dexterity Saving Throw: DC 18, each creature in a 10-foot-radius, 40-foot-high Cylinder originating from a point the giant can see within 500 feet. Failure: 55 (10d10) Lightning damage. Success: Half damage.',
      saveDC: 18,
      saveAbility: 'DEX'
    },
    {
      name: 'Spellcasting',
      description: "The giant casts one of the following spells, requiring no Material components and using Wisdom as the spellcasting ability (spell save DC 18): At Will: Detect Magic, Light. 1/Day: Control Weather."
    }
  ];

  delete sg.bonusActions;
  delete sg.reactions;
  delete sg.legendaryActions;
  delete sg.lairActions;
  delete sg.regionalEffects;
  delete sg.spellcasting;

  console.log('Fixed Storm Giant: HP 230, fly 25 hover, Truesight 30, Storm Sword + Thunderbolt + Lightning Storm');
}

// === 9. SOLAR ===
const solar = monsters.find(m => m.id === 'solar');
if (solar) {
  solar.ac = 21;
  delete solar.acType;
  solar.hp = 297;
  solar.hitDice = '22d10+176';
  solar.speed = { walk: 50, fly: 150, hover: true };
  solar.initiative = { modifier: 20, score: 30 };
  solar.abilityScores = { str: 26, dex: 22, con: 26, int: 25, wis: 25, cha: 30 };
  solar.savingThrows = {};
  delete solar.skills;
  solar.skills = { Perception: 14 };
  solar.damageImmunities = ['poison', 'radiant'];
  solar.conditionImmunities = ['charmed', 'exhaustion', 'frightened', 'poisoned'];
  delete solar.resistances;
  solar.senses = { truesight: 120, passivePerception: 24 };
  solar.languages = ['All', 'telepathy 120 ft.'];
  solar.cr = 21;
  solar.xp = 33000;
  solar.proficiencyBonus = 7;

  solar.traits = [
    {
      name: 'Divine Awareness',
      description: 'The solar knows if it hears a lie.'
    },
    {
      name: 'Exalted Restoration',
      description: "If the solar dies outside Mount Celestia, its body disappears, and it gains a new body instantly, reviving with all its Hit Points somewhere in Mount Celestia."
    },
    {
      name: 'Legendary Resistance (4/Day)',
      description: 'If the solar fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Magic Resistance',
      description: 'The solar has Advantage on saving throws against spells and other magical effects.'
    }
  ];

  solar.actions = [
    {
      name: 'Multiattack',
      description: 'The solar makes two Flying Sword attacks. It can replace one attack with a use of Slaying Bow.',
      multiattackActions: ['Flying Sword', 'Flying Sword']
    },
    {
      name: 'Flying Sword',
      description: 'Melee or Ranged Attack Roll: +15, reach 10 ft. or range 120 ft. Hit: 22 (4d6 + 8) Slashing damage plus 36 (8d8) Radiant damage. Hit or Miss: The sword magically returns to the solar.',
      attackType: 'melee-or-ranged',
      toHit: 15,
      reach: 10,
      rangeNormal: 120,
      targets: 1,
      damageDice: '4d6+8',
      damageType: 'Slashing',
      additionalDamage: '36 (8d8) Radiant damage'
    },
    {
      name: 'Slaying Bow',
      description: 'Dexterity Saving Throw: DC 21, one creature the solar can see within 600 feet. Failure: If the creature has 100 Hit Points or fewer, it dies. It otherwise takes 24 (4d8 + 6) Piercing damage plus 36 (8d8) Radiant damage.',
      saveDC: 21,
      saveAbility: 'DEX'
    },
    {
      name: 'Spellcasting',
      description: "The solar casts one of the following spells, requiring no Material components and using Charisma as the spellcasting ability (spell save DC 25): At Will: Detect Evil and Good. 1/Day Each: Commune, Control Weather, Dispel Evil and Good, Resurrection."
    }
  ];

  solar.bonusActions = [
    {
      name: 'Divine Aid (3/Day)',
      description: "The solar casts Cure Wounds (level 2 version), Lesser Restoration, or Remove Curse, using the same spellcasting ability as Spellcasting."
    }
  ];

  solar.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Blinding Gaze',
        description: "Constitution Saving Throw: DC 25, one creature the solar can see within 120 feet. Failure: The target has the Blinded condition for 1 minute. The solar can't take this action again until the start of its next turn.",
        saveDC: 25,
        saveAbility: 'CON'
      },
      {
        name: 'Radiant Teleport',
        description: 'The solar teleports up to 60 feet to an unoccupied space it can see. Dexterity Saving Throw: DC 25, each creature in a 10-foot Emanation originating from the solar at its destination space. Failure: 11 (2d10) Radiant damage. Success: Half damage.',
        saveDC: 25,
        saveAbility: 'DEX'
      }
    ]
  };

  delete solar.reactions;
  delete solar.spellcasting;

  console.log('Fixed Solar: HP 297, initiative +20, Legendary Resistance 4/Day, Flying Sword, Slaying Bow, Divine Aid');
}

// === 10. KRAKEN ===
const kraken = monsters.find(m => m.id === 'kraken');
if (kraken) {
  kraken.hp = 481;
  kraken.hitDice = '26d20+208';
  delete kraken.acType;
  kraken.speed = { walk: 30, swim: 120 };
  kraken.initiative = { modifier: 14, score: 24 };
  kraken.abilityScores = { str: 30, dex: 11, con: 26, int: 22, wis: 18, cha: 20 };
  kraken.savingThrows = { str: 17, dex: 7, con: 15, wis: 11 };
  kraken.skills = { History: 13, Perception: 11 };
  kraken.damageImmunities = ['cold', 'lightning'];
  kraken.conditionImmunities = ['frightened', 'grappled', 'paralyzed', 'restrained'];
  delete kraken.resistances;
  kraken.senses = { truesight: 120, passivePerception: 21 };
  kraken.languages = ['Understands Abyssal, Celestial, Infernal, and Primordial but cannot speak', 'telepathy 120 ft.'];
  kraken.cr = 23;
  kraken.xp = 50000;
  kraken.proficiencyBonus = 7;

  kraken.traits = [
    {
      name: 'Amphibious',
      description: 'The kraken can breathe air and water.'
    },
    {
      name: 'Legendary Resistance (4/Day, or 5/Day in Lair)',
      description: 'If the kraken fails a saving throw, it can choose to succeed instead.'
    },
    {
      name: 'Siege Monster',
      description: 'The kraken deals double damage to objects and structures.'
    }
  ];

  kraken.actions = [
    {
      name: 'Multiattack',
      description: 'The kraken makes two Tentacle attacks and uses Fling, Lightning Strike, or Swallow.',
      multiattackActions: ['Tentacle', 'Tentacle']
    },
    {
      name: 'Tentacle',
      description: 'Melee Attack Roll: +17, reach 30 ft. Hit: 24 (4d6 + 10) Bludgeoning damage. The target has the Grappled condition (escape DC 20) from one of ten tentacles, and it has the Restrained condition until the grapple ends.',
      attackType: 'melee',
      toHit: 17,
      reach: 30,
      targets: 1,
      damageDice: '4d6+10',
      damageType: 'Bludgeoning'
    },
    {
      name: 'Fling',
      description: "The kraken throws a Large creature Grappled by it to a space it can see within 60 feet of itself that isn't in the air. Dexterity Saving Throw: DC 25, the creature thrown and each creature in the destination space. Failure: 18 (4d8) Bludgeoning damage, and the target has the Prone condition. Success: Half damage only.",
      saveDC: 25,
      saveAbility: 'DEX'
    },
    {
      name: 'Lightning Strike',
      description: 'Dexterity Saving Throw: DC 23, one creature the kraken can see within 120 feet. Failure: 33 (6d10) Lightning damage. Success: Half damage.',
      saveDC: 23,
      saveAbility: 'DEX'
    },
    {
      name: 'Swallow',
      description: "Dexterity Saving Throw: DC 25, one creature Grappled by the kraken (it can have up to four creatures swallowed at a time). Failure: 23 (3d8 + 10) Piercing damage. If the target is Large or smaller, it is swallowed and no longer Grappled. A swallowed creature has the Restrained condition, has Total Cover against attacks and other effects outside the kraken, and takes 24 (7d6) Acid damage at the start of each of its turns. If the kraken takes 50 damage or more on a single turn from a creature inside it, the kraken must succeed on a DC 25 Constitution saving throw at the end of that turn or regurgitate all swallowed creatures, each of which falls in a space within 10 feet of the kraken with the Prone condition.",
      saveDC: 25,
      saveAbility: 'DEX'
    }
  ];

  kraken.legendaryActions = {
    uses: 3,
    actions: [
      {
        name: 'Storm Bolt',
        description: 'The kraken uses Lightning Strike.'
      },
      {
        name: 'Toxic Ink',
        description: "Constitution Saving Throw: DC 23, each creature in a 15-foot Emanation originating from the kraken while it is underwater. Failure: The target has the Blinded and Poisoned conditions until the end of the kraken's next turn. The kraken then moves up to its Speed. The kraken can't take this action again until the start of its next turn.",
        saveDC: 23,
        saveAbility: 'CON'
      }
    ]
  };

  kraken.lairActions = {
    initiativeCount: 20,
    actions: []
  };
  kraken.regionalEffects = {
    effects: [
      {
        name: 'Ocean Tyrant',
        description: 'The kraken exerts its dominance over animals in its domain. All Beasts within 1 mile of the lair have the Charmed condition while in that area.'
      },
      {
        name: 'Sea and Storms',
        description: 'While in its lair, the kraken can cast Control Weather, requiring no spell components and using Intelligence as the spellcasting ability.'
      }
    ],
    endCondition: 'If the kraken dies or moves its lair elsewhere, these effects end immediately.'
  };

  delete kraken.bonusActions;
  delete kraken.reactions;
  delete kraken.spellcasting;

  console.log('Fixed Kraken: HP 481, swim 120, Cold+Lightning immunity, 4 condition immunities, Legendary Resistance 4/Day');
}

// Write back
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n');
console.log('\nSaved monsters.json with all 10 monster fixes');
