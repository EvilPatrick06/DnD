export interface SkillDescription {
  name: string
  ability: string
  description: string
  uses: string
}

export const SKILLS_5E: SkillDescription[] = [
  {
    name: 'Acrobatics',
    ability: 'DEX',
    description:
      'Balance, tumble, and aerial maneuvers. Used to stay on your feet in tricky situations or perform acrobatic stunts.',
    uses: 'Balance on ice or tightrope (DC 10-15), stay upright on a rocking ship (DC 12), tumble through enemy space (contested), land safely from a fall (DC 15), perform acrobatic stunts (DC varies)'
  },
  {
    name: 'Animal Handling',
    ability: 'WIS',
    description:
      "Calm, control, or intuit an animal's intentions. Covers domesticated and wild animals when diplomacy or training is needed.",
    uses: "Calm a spooked mount (DC 10), sense an animal's intentions (DC 15), control your mount during a risky maneuver (DC 15), train a wild animal (DC 20+, extended), keep a pack animal steady in danger (DC 12)"
  },
  {
    name: 'Arcana',
    ability: 'INT',
    description:
      'Recall lore about spells, magic items, eldritch symbols, magical traditions, planes of existence, and the inhabitants of those planes.',
    uses: 'Identify a spell being cast (DC 15 + spell level), recall info about a magic item (DC varies), know about outer planes (DC 15-20), recognize arcane symbols (DC 10-15), identify magical effects or residue (DC 12-18)'
  },
  {
    name: 'Athletics',
    ability: 'STR',
    description: 'Climb, jump, swim, and other feats of raw physical power. Covers grappling and shoving in combat.',
    uses: 'Climb a cliff with handholds (DC 10), climb slippery surface (DC 15), jump across a chasm (high/long jump rules), swim against a strong current (DC 15), grapple a creature (contested), shove a creature (contested), break free from restraints (DC 20)'
  },
  {
    name: 'Deception',
    ability: 'CHA',
    description: 'Lie convincingly, disguise your intentions, or mislead others through ambiguity. Opposed by Insight.',
    uses: 'Fast-talk a guard (contested vs Insight), con a merchant on price (DC 15), maintain a disguise with conversation (contested), feint in combat (contested), forge a document with false information (DC 15-20), create a convincing alias (DC varies)'
  },
  {
    name: 'History',
    ability: 'INT',
    description:
      'Recall lore about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.',
    uses: "Know about a recent war (DC 10), identify a noble's heraldry (DC 12), recall ancient kingdom lore (DC 15-20), recognize historical significance of a ruin (DC 15), know about a famous historical figure (DC 10-15), date an artifact (DC 15)"
  },
  {
    name: 'Insight',
    ability: 'WIS',
    description:
      "Determine the true intentions of a creature, read body language, detect lies, or predict someone's next move. The counter to Deception.",
    uses: "Sense if someone is lying (contested vs Deception), read body language for nervousness (DC 12), predict someone's likely next action (DC 15), detect hidden motives in a conversation (DC 15), sense an ambush by reading tension (DC varies)"
  },
  {
    name: 'Intimidation',
    ability: 'CHA',
    description:
      'Influence someone through overt threats, hostile actions, or physical menace. Can use STR in some situations (DM discretion).',
    uses: 'Pry information from a prisoner (contested), convince thugs to back down (DC 15), use menacing presence to get through a door (DC varies), demoralize an enemy before combat (contested), threaten someone into compliance (DC 15-20)'
  },
  {
    name: 'Investigation',
    ability: 'INT',
    description:
      'Search for clues, make deductions from evidence, and piece together information. More active and analytical than Perception.',
    uses: "Find a hidden compartment in a desk (DC 15), deduce a creature's weakness from clues (DC 15), determine cause of death (DC 12), locate a secret door by searching the area (DC 15-20), piece together a mystery from scattered evidence (DC varies)"
  },
  {
    name: 'Medicine',
    ability: 'WIS',
    description:
      "Diagnose illness, stabilize the dying, and provide medical care. Essential when healing magic isn't available.",
    uses: 'Stabilize a dying creature (DC 10), diagnose a disease (DC 12-15), determine cause of death (DC 10), treat a wound to prevent infection (DC 12), identify a poison (DC 15), provide long-term care during rest (DC 15, doubles Hit Point Dice healing)'
  },
  {
    name: 'Nature',
    ability: 'INT',
    description:
      'Recall lore about terrain, plants, animals, weather patterns, and natural cycles. Complements Survival for wilderness knowledge.',
    uses: 'Identify a plant or animal (DC 10), recall info about terrain type (DC 12), predict weather patterns (DC 15), know if local water is safe to drink (DC 10), identify natural hazards (DC 12-15), recognize unnatural phenomena in nature (DC 15)'
  },
  {
    name: 'Perception',
    ability: 'WIS',
    description:
      'Spot, hear, or otherwise detect the presence of something. General awareness of your surroundings. Often used passively (10 + modifier).',
    uses: 'Hear a conversation through a door (DC 15), spot a hidden creature (contested vs Stealth), notice a trap trigger (DC varies), detect an illusion (DC varies), find a hidden object in a room (DC 15), notice someone following you (contested)'
  },
  {
    name: 'Performance',
    ability: 'CHA',
    description: 'Delight an audience with music, dance, acting, storytelling, or some other form of entertainment.',
    uses: 'Play an instrument at a tavern (DC 10-15), tell a compelling story to distract (DC 12), act convincingly in a play (DC 15), earn income as a performer (DC varies), captivate a noble audience (DC 18), create a diversion with a performance (DC 15)'
  },
  {
    name: 'Persuasion',
    ability: 'CHA',
    description:
      "Influence others with tact, social graces, and good nature. For making friends and requests, not threats (that's Intimidation) or lies (that's Deception).",
    uses: 'Negotiate peace between factions (DC 15-20), convince a noble to grant an audience (DC 15), inspire a crowd with a speech (DC 12), haggle for a better price (DC 15), request a favor from an NPC (DC varies), defuse a tense social situation (DC 15)'
  },
  {
    name: 'Religion',
    ability: 'INT',
    description:
      'Recall lore about deities, rites, prayers, religious hierarchies, holy symbols, and the practices of secret cults.',
    uses: 'Identify a religious symbol (DC 10), recall a prayer or religious rite (DC 12), know about a specific deity (DC 10-15), identify undead or fiend weaknesses (DC 15), recognize signs of cult activity (DC 15), know the significance of a holy site (DC 12)'
  },
  {
    name: 'Sleight of Hand',
    ability: 'DEX',
    description:
      'Manual trickery: pickpocketing, concealing objects on your person, or performing legerdemain. Opposed by Perception.',
    uses: 'Plant something on someone (contested vs Perception), pick a pocket (contested), conceal a weapon (DC 12-15), perform a card trick (DC 10-15), swap one small item for another unnoticed (DC 15), palm a key off a table (DC 12)'
  },
  {
    name: 'Stealth',
    ability: 'DEX',
    description:
      'Conceal yourself from enemies, slink past guards, slip away without being noticed, and sneak up on someone. Opposed by Perception.',
    uses: 'Sneak past guards (contested vs Perception), hide in shadows (DC varies by light), set up an ambush (contested), move silently across a creaky floor (DC 15), follow someone without being noticed (contested), blend into a crowd (DC 12-15)'
  },
  {
    name: 'Survival',
    ability: 'WIS',
    description:
      'Follow tracks, hunt wild game, navigate wilderness, identify signs of nearby creatures, predict weather, and avoid natural hazards.',
    uses: 'Follow tracks on soft ground (DC 10), follow tracks on hard ground (DC 15-20), hunt game for food (DC 12), navigate without a map (DC 15), predict weather (DC 12), find shelter in the wild (DC 10), avoid quicksand or similar hazards (DC 15)'
  }
]

export function getSkillDescription(skillName: string): SkillDescription | undefined {
  return SKILLS_5E.find((s) => s.name === skillName)
}
