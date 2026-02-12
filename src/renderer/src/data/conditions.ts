export interface ConditionDef {
  name: string
  description: string
  system: 'dnd5e' | 'pf2e' | 'both'
  hasValue?: boolean // PF2e conditions with levels (Clumsy 1-4, etc.)
  maxValue?: number
}

export const CONDITIONS_5E: ConditionDef[] = [
  {
    name: 'Blinded',
    description:
      'A blinded creature can\'t see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
    system: 'dnd5e'
  },
  {
    name: 'Charmed',
    description:
      'A charmed creature can\'t attack the charmer or target them with harmful abilities or magical effects. The charmer has advantage on any ability check to interact socially with the creature.',
    system: 'dnd5e'
  },
  {
    name: 'Deafened',
    description: 'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
    system: 'dnd5e'
  },
  {
    name: 'Frightened',
    description:
      'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can\'t willingly move closer to the source of its fear.',
    system: 'dnd5e'
  },
  {
    name: 'Grappled',
    description:
      'A grappled creature\'s speed becomes 0 and it can\'t benefit from any bonus to its speed. The condition ends if the grappler is incapacitated or if an effect removes the grappled creature from the grappler\'s reach.',
    system: 'dnd5e'
  },
  {
    name: 'Incapacitated',
    description: 'An incapacitated creature can\'t take actions or reactions.',
    system: 'dnd5e'
  },
  {
    name: 'Invisible',
    description:
      'An invisible creature is impossible to see without the aid of magic or a special sense. The creature is heavily obscured for the purpose of hiding. Attacks against the creature have disadvantage, and the creature\'s attacks have advantage.',
    system: 'dnd5e'
  },
  {
    name: 'Paralyzed',
    description:
      'A paralyzed creature is incapacitated and can\'t move or speak. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage. Any attack that hits the creature is a critical hit if the attacker is within 5 feet.',
    system: 'dnd5e'
  },
  {
    name: 'Petrified',
    description:
      'A petrified creature is transformed into a solid inanimate substance (usually stone). Its weight increases by a factor of 10, and it ceases aging. The creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. It has resistance to all damage and is immune to poison and disease.',
    system: 'dnd5e'
  },
  {
    name: 'Poisoned',
    description: 'A poisoned creature has disadvantage on attack rolls and ability checks.',
    system: 'dnd5e'
  },
  {
    name: 'Prone',
    description:
      'A prone creature\'s only movement option is to crawl (costs 1 extra foot per foot of movement), unless it stands up (costs half its speed). The creature has disadvantage on attack rolls. An attack roll against the creature has advantage if the attacker is within 5 feet, otherwise disadvantage.',
    system: 'dnd5e'
  },
  {
    name: 'Restrained',
    description:
      'A restrained creature\'s speed becomes 0. Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage. The creature has disadvantage on Dexterity saving throws.',
    system: 'dnd5e'
  },
  {
    name: 'Stunned',
    description:
      'A stunned creature is incapacitated, can\'t move, and can speak only falteringly. The creature automatically fails Strength and Dexterity saving throws. Attack rolls against the creature have advantage.',
    system: 'dnd5e'
  },
  {
    name: 'Unconscious',
    description:
      'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings. The creature drops whatever it\'s holding and falls prone. Attack rolls against the creature have advantage. Any attack that hits is a critical hit if the attacker is within 5 feet. The creature fails Strength and Dexterity saving throws.',
    system: 'dnd5e'
  },
  {
    name: 'Exhaustion',
    description:
      'Cumulative levels (1-6). Level 1: Disadvantage on ability checks. Level 2: Speed halved. Level 3: Disadvantage on attack rolls and saving throws. Level 4: Hit point maximum halved. Level 5: Speed reduced to 0. Level 6: Death. Finishing a long rest reduces exhaustion by 1 level (if you have food and water).',
    system: 'dnd5e',
    hasValue: true,
    maxValue: 6
  }
]

// Include key PF2e conditions (with value tracking)
export const CONDITIONS_PF2E: ConditionDef[] = [
  {
    name: 'Blinded',
    description:
      'You can\'t see. All terrain is difficult terrain to you. You can\'t detect anything using vision. You automatically critically fail Perception checks that require sight. You take a -4 status penalty to Perception checks. You are immune to visual effects. You are flat-footed.',
    system: 'pf2e'
  },
  {
    name: 'Clumsy',
    description: 'Your movements become clumsy and uncoordinated. You take a status penalty equal to the condition value to Dexterity-based checks and DCs, including AC, Reflex saves, and ranged attack rolls.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Confused',
    description:
      'You don\'t have your wits about you and attack wildly. You can\'t use reactions, must use all your actions to Strike or cast offensive cantrips (determined randomly), and you don\'t treat anyone as an ally. At the end of each turn, you can attempt a DC 11 flat check to end the condition.',
    system: 'pf2e'
  },
  {
    name: 'Concealed',
    description: 'You are difficult to see due to fog, darkness, or other obscuring effects. Creatures must succeed at a DC 5 flat check when targeting you with an attack, spell, or other effect. On a failure, the attack misses, the spell fizzles, or the effect has no effect on you.',
    system: 'pf2e'
  },
  {
    name: 'Dazzled',
    description: 'Your eyes are overstimulated. Everything is concealed to you (DC 5 flat check to target).',
    system: 'pf2e'
  },
  {
    name: 'Deafened',
    description:
      'You can\'t hear. You automatically critically fail Perception checks that require hearing. You take a -2 status penalty to Perception checks. You are immune to auditory effects.',
    system: 'pf2e'
  },
  {
    name: 'Doomed',
    description: 'Your life is ebbing away, bringing you closer to death. Your dying condition maximum is reduced by your doomed value (normally dying 4 kills you, but doomed 2 means dying 2 kills you). Doomed decreases by 1 each time you get a full night\'s rest.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 3
  },
  {
    name: 'Drained',
    description: 'Your vitality has been sapped. You take a status penalty equal to your drained value to Constitution-based checks (including Fortitude saves and HP gained per level). Your maximum Hit Points are reduced by your level times the drained value. Drained decreases by 1 each time you get a full night\'s rest.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Dying',
    description:
      'You are unconscious and near death. You must attempt a recovery check (DC 10 + dying value) at the start of each turn: critical success reduces dying by 2, success by 1, failure increases by 1, critical failure by 2. If dying reaches your maximum (4, or less if doomed), you die. Gaining HP while dying sets you to 0 HP and removes dying.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Encumbered',
    description: 'You are carrying more than you can easily manage. You are clumsy 1 and take a -10-foot status penalty to your Speed (minimum 5 feet).',
    system: 'pf2e'
  },
  {
    name: 'Enfeebled',
    description: 'You are physically weakened. You take a status penalty equal to the condition value to Strength-based checks and DCs, including melee attack rolls, damage rolls, and Athletics checks.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Fatigued',
    description: 'You are tired and can\'t focus. You take a -1 status penalty to AC and saving throws. During exploration, you can\'t choose an exploration activity. You recover from fatigue after a full night\'s rest.',
    system: 'pf2e'
  },
  {
    name: 'Flat-Footed',
    description: 'You are distracted or off balance, taking a -2 circumstance penalty to AC. Flat-footed can be applied by flanking, surprise, certain spells, the Grab condition, and many other effects.',
    system: 'pf2e'
  },
  {
    name: 'Fleeing',
    description: 'You are compelled to run away. You must spend each of your actions to move away from the source of the fleeing condition as quickly as possible (using the most direct route). You can\'t Delay or Ready while fleeing.',
    system: 'pf2e'
  },
  {
    name: 'Frightened',
    description:
      'You are gripped by fear. You take a status penalty equal to the condition value to all checks and DCs. At the end of each of your turns, the frightened value decreases by 1. You can\'t willingly move closer to the source of your fear (if any).',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Grabbed',
    description: 'You are held in place by another creature. You are immobilized and flat-footed. If you attempt a manipulate action, you must succeed at a DC 5 flat check or the action is lost. The grab ends if the grabber takes an action requiring both hands.',
    system: 'pf2e'
  },
  {
    name: 'Hidden',
    description:
      'The creature knows your general area (the space you\'re in) but can\'t see you. When targeting you, the creature must attempt a DC 11 flat check. On a failure, the attack misses. You remain hidden until you do something to reveal yourself.',
    system: 'pf2e'
  },
  {
    name: 'Immobilized',
    description: 'You can\'t use any action with the move trait. If an effect forces you to move, the effect moves you but you don\'t use any actions. You can still take other actions normally.',
    system: 'pf2e'
  },
  {
    name: 'Paralyzed',
    description: 'You are frozen in place. You have the flat-footed condition and can\'t act except to Recall Knowledge and use mental actions that don\'t require physical actions. Your senses still work. A melee attack that hits you is automatically a critical hit.',
    system: 'pf2e'
  },
  {
    name: 'Persistent Damage',
    description:
      'You take the specified damage at the start of each of your turns, with no effect on anyone else. At the end of each turn, you can attempt a DC 15 flat check to end the persistent damage. Receiving healing assistance or being doused (for fire) gives you a new flat check at +2.',
    system: 'pf2e'
  },
  {
    name: 'Prone',
    description: 'You are lying on the ground. You are flat-footed and take a -2 circumstance penalty to attack rolls. The only move actions you can use are Crawl and Stand (which uses an action). Ranged attacks against you take a -2 penalty while melee attacks gain +2.',
    system: 'pf2e'
  },
  {
    name: 'Quickened',
    description:
      'You gain 1 additional action at the start of your turn each round. Many effects that make you quickened specify what the extra action can be used for (e.g., Stride or Strike only). If multiple effects quicken you, you still gain only 1 extra action.',
    system: 'pf2e'
  },
  {
    name: 'Restrained',
    description: 'You are tied up, pinned, or otherwise immobilized more severely than grabbed. You are immobilized and flat-footed, and you gain the clumsy 1 condition. You can\'t take any actions with the attack or manipulate trait except to attempt to Escape.',
    system: 'pf2e'
  },
  {
    name: 'Sickened',
    description:
      'You feel ill. You take a status penalty equal to the condition value to all checks and DCs. You can\'t willingly ingest anything. Each time you finish an action, you can spend an action to attempt a Fortitude save against the originating DC to reduce sickened by 1 (or 2 on a critical success).',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Slowed',
    description: 'You have fewer actions. When you regain your actions at the start of your turn, reduce the number of actions by your slowed value. You still get a minimum of 0 actions.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 3
  },
  {
    name: 'Stunned',
    description: 'You\'ve become senseless. You can\'t act. Stunned overrides slowed. When you regain actions, reduce the number by your stunned value, then reduce the stunned value by the number of actions lost. If stunned has a duration instead of a value, you lose all actions for that duration.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Stupefied',
    description:
      'Your thoughts and instincts are clouded. You take a status penalty equal to the condition value to checks and DCs based on Intelligence, Wisdom, or Charisma. Any time you attempt to Cast a Spell while stupefied, the spell is disrupted unless you succeed at a flat check (DC 5 + stupefied value).',
    system: 'pf2e',
    hasValue: true,
    maxValue: 4
  },
  {
    name: 'Unconscious',
    description:
      'You are sleeping or have been knocked out. You can\'t act. You take a -4 status penalty to AC, Perception, and Reflex saves, and you have the blinded and flat-footed conditions. You fall prone and drop items. If unconscious from HP damage, you gain the dying condition.',
    system: 'pf2e'
  },
  {
    name: 'Wounded',
    description:
      'You\'ve been seriously hurt and are more vulnerable to death. When you gain the dying condition while wounded, increase your dying value by your wounded value. You become wounded 1 the first time you recover from dying, and your wounded value increases by 1 each subsequent time. Wounded is removed by being restored to full HP or receiving the Treat Wounds action.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 3
  }
]

export const BUFFS_5E: ConditionDef[] = [
  {
    name: 'Blessed',
    description: 'Whenever you make an attack roll or saving throw within 30 feet of the caster, you can add 1d4 to the roll. Concentration, up to 1 minute (Bless spell, 1st level).',
    system: 'dnd5e'
  },
  {
    name: 'Hasted',
    description: 'Speed doubled, +2 bonus to AC, advantage on Dexterity saving throws, and an additional action each turn (Attack [one only], Dash, Disengage, Hide, or Use an Object). When the spell ends, you can\'t move or take actions until after your next turn. Concentration, up to 1 minute (Haste, 3rd level).',
    system: 'dnd5e'
  },
  {
    name: 'Shield of Faith',
    description: '+2 bonus to AC from a shimmering magical field. Concentration, up to 10 minutes (Shield of Faith, 1st level).',
    system: 'dnd5e'
  },
  {
    name: 'Bardic Inspiration',
    description: 'Within the next 10 minutes, you can add the Bardic Inspiration die (d6/d8/d10/d12 based on bard level) to one ability check, attack roll, or saving throw. The die is rolled after the d20 but before the DM says whether the roll succeeds.',
    system: 'dnd5e',
    hasValue: true,
    maxValue: 12
  },
  {
    name: 'Enlarged',
    description: 'Size doubles in all dimensions, weight multiplied by 8. Advantage on Strength checks and Strength saving throws. Weapon attacks deal +1d4 damage. Concentration, up to 1 minute (Enlarge/Reduce, 2nd level).',
    system: 'dnd5e'
  },
  {
    name: 'Raging',
    description: 'Advantage on Strength checks and Strength saving throws. Bonus melee damage (+2/+3/+4 based on barbarian level). Resistance to bludgeoning, piercing, and slashing damage. Cannot cast or concentrate on spells. Lasts 1 minute, ends early if knocked unconscious or if turn ends without attacking/taking damage.',
    system: 'dnd5e'
  },
  {
    name: 'Concentrating',
    description: 'Maintaining concentration on a spell. Only one concentration spell at a time. When you take damage, make a Constitution saving throw (DC 10 or half damage, whichever is higher) or lose the spell. Also lost if incapacitated or killed.',
    system: 'dnd5e'
  },
  {
    name: 'Heroism',
    description: 'The creature is immune to being frightened and gains temporary hit points equal to the spellcasting ability modifier at the start of each of its turns. Concentration, up to 1 minute (Heroism, 1st level).',
    system: 'dnd5e'
  },
  {
    name: 'Mage Armor',
    description: 'Target\'s base AC becomes 13 + Dexterity modifier for 8 hours. Doesn\'t work with other armor.',
    system: 'dnd5e'
  },
  {
    name: 'Aid',
    description: 'Increases hit point maximum and current hit points by 5 for 8 hours. Upcast: +5 per level above 2nd.',
    system: 'dnd5e'
  },
  {
    name: 'Protection from Evil and Good',
    description: 'Aberrations, celestials, elementals, fey, fiends, and undead have disadvantage on attacks against you. You can\'t be charmed, frightened, or possessed by them.',
    system: 'dnd5e'
  },
  {
    name: 'Guidance',
    description: 'Add 1d4 to one ability check within the next minute.',
    system: 'dnd5e'
  },
  {
    name: 'Resistance',
    description: 'Add 1d4 to one saving throw within the next minute.',
    system: 'dnd5e'
  },
  {
    name: 'Sanctuary',
    description: 'Creatures must make a Wisdom save to target the warded creature. Ends if the warded creature attacks or casts a harmful spell.',
    system: 'dnd5e'
  },
  {
    name: 'Hex',
    description: 'Deal an extra 1d6 necrotic damage to the hexed target. The target has disadvantage on one chosen ability check.',
    system: 'dnd5e'
  },
  {
    name: 'Hunter\'s Mark',
    description: 'Deal an extra 1d6 damage to the marked target. You have advantage on Perception and Survival checks to find it.',
    system: 'dnd5e'
  },
  {
    name: 'Death Ward',
    description: 'The first time the target drops to 0 HP, it drops to 1 HP instead. Also negates instant-death effects. Lasts 8 hours.',
    system: 'dnd5e'
  },
  {
    name: 'Freedom of Movement',
    description: 'Target\'s movement is unaffected by difficult terrain, and spells/effects can\'t reduce speed or cause paralysis/restraint.',
    system: 'dnd5e'
  }
]

export const BUFFS_PF2E: ConditionDef[] = [
  {
    name: 'Quickened',
    description: 'You gain 1 extra action at the start of your turn each round. Most effects specify what the extra action can be used for (e.g., only Stride or Strike).',
    system: 'pf2e'
  },
  {
    name: 'Concealed',
    description: 'You are difficult to see. Creatures must succeed at a DC 5 flat check when targeting you with attacks, spells, or other effects.',
    system: 'pf2e'
  },
  {
    name: 'Invisible',
    description: 'You can\'t be seen except by special senses. You are undetected to most creatures. Creatures that can sense you are still flat-footed against your attacks. You gain a +2 status bonus to Stealth checks to Sneak.',
    system: 'pf2e'
  },
  {
    name: 'Heroism',
    description: 'A status bonus to attack rolls, Perception checks, saving throws, and skill checks. The bonus equals the spell level: +1 (3rd), +2 (6th), or +3 (9th). Duration 1 minute.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 3
  },
  {
    name: 'Haste',
    description: 'You are quickened. The extra action can only be used to Stride or Strike. Duration: 1 minute, concentration (Haste, 3rd-level arcane/occult spell).',
    system: 'pf2e'
  },
  {
    name: 'Inspired',
    description: 'You gain a status bonus from a bardic composition or similar inspirational effect. The bonus value depends on the composition (+1 to +3). Typically applies to attack rolls, damage rolls, and saves against fear.',
    system: 'pf2e',
    hasValue: true,
    maxValue: 3
  },
  {
    name: 'Shield',
    description: 'Gain a +1 circumstance bonus to AC. Can use Shield Block reaction to reduce damage by the shield\'s hardness.',
    system: 'pf2e'
  },
  {
    name: 'Bless',
    description: 'Allies in a 15-foot emanation gain a +1 status bonus to attack rolls.',
    system: 'pf2e'
  },
  {
    name: 'Fly',
    description: 'Target gains a fly speed of 60 feet for 5 minutes.',
    system: 'pf2e'
  },
  {
    name: 'True Strike',
    description: 'Gain a +1 status bonus to your next attack roll and ignore concealment.',
    system: 'pf2e'
  },
  {
    name: 'Stoneskin',
    description: 'Target gains resistance 5 to physical damage (except adamantine).',
    system: 'pf2e'
  }
]

export function getConditionsForSystem(system: 'dnd5e' | 'pf2e'): ConditionDef[] {
  return system === 'dnd5e' ? CONDITIONS_5E : CONDITIONS_PF2E
}
