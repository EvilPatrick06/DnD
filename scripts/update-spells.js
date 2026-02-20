/**
 * 2024 PHB Spells Chapter Audit — Update Script
 * Adds 47 missing spells, fixes 4 spells, removes 1 spell, updates 2 spells
 */
const fs = require('fs');
const path = require('path');

const SPELLS_PATH = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'spells.json');

const spells = JSON.parse(fs.readFileSync(SPELLS_PATH, 'utf-8'));
console.log(`Loaded ${spells.length} spells`);

// ── Phase 3: Remove non-2024 spells ──
// Bones of the Earth (XGE-only, not in 2024 PHB)
const removeIds = new Set(['bones-of-the-earth']);
const filtered = spells.filter(s => !removeIds.has(s.id));
console.log(`Removed ${spells.length - filtered.length} spells: ${[...removeIds].join(', ')}`);

// ── Phase 2: Fix spells with incorrect data ──

// Fix Conjure Animals — complete rewrite to 2024 version
const conjureAnimals = filtered.find(s => s.id === 'conjure-animals');
if (conjureAnimals) {
  conjureAnimals.description = "You conjure nature spirits that appear as a Large pack of spectral, intangible animals in an unoccupied space you can see within range. The pack lasts for the duration, and you choose the spirits' animal form, such as wolves, serpents, or birds. You have Advantage on Strength saving throws while you're within 5 feet of the pack, and when you move on your turn, you can also move the pack up to 30 feet to an unoccupied space you can see. Whenever the pack moves within 10 feet of a creature you can see and whenever a creature you can see enters a space within 10 feet of the pack or ends its turn there, you can force that creature to make a Dexterity saving throw. On a failed save, the creature takes 3d10 Slashing damage. A creature makes this save only once per turn. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 3.";
  delete conjureAnimals.higherLevels;
  console.log('Fixed: Conjure Animals (2024 rewrite)');
}

// Fix Conjure Fey — complete rewrite to 2024 version
const conjureFey = filtered.find(s => s.id === 'conjure-fey');
if (conjureFey) {
  conjureFey.description = "You conjure a Medium spirit from the Feywild in an unoccupied space you can see within range. The spirit lasts for the duration, and it looks like a Fey creature of your choice. When the spirit appears, you can make one melee spell attack against a creature within 5 feet of it. On a hit, the target takes Psychic damage equal to 3d12 plus your spellcasting ability modifier, and the target has the Frightened condition until the start of your next turn, with both you and the spirit as the source of the fear. As a Bonus Action on your later turns, you can teleport the spirit to an unoccupied space you can see within 30 feet of the space it left and make the attack against a creature within 5 feet of it. Using a Higher-Level Spell Slot. The damage increases by 2d12 for each spell slot level above 6.";
  delete conjureFey.higherLevels;
  console.log('Fixed: Conjure Fey (2024 rewrite)');
}

// Fix Blade Ward — update description + add Wizard to classes (metadata is correct per 2024 PHB)
const bladeWard = filtered.find(s => s.id === 'blade-ward');
if (bladeWard) {
  bladeWard.description = "Whenever a creature makes an attack roll against you before the spell ends, the attacker subtracts 1d4 from the attack roll.";
  if (!bladeWard.classes.includes('wizard')) {
    bladeWard.classes.push('wizard');
    bladeWard.classes.sort();
  }
  console.log('Fixed: Blade Ward (2024 description + added Wizard)');
}

// Fix Chill Touch — update to 2024 version (melee spell attack, 1d10, no undead effect)
const chillTouch = filtered.find(s => s.id === 'chill-touch');
if (chillTouch) {
  chillTouch.description = "Channeling the chill of the grave, make a melee spell attack against a target within reach. On a hit, the target takes 1d10 Necrotic damage, and it can't regain Hit Points until the end of your next turn. Cantrip Upgrade. The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).";
  chillTouch.range = "Touch";
  console.log('Fixed: Chill Touch (2024 update - melee, 1d10)');
}

// Fix Vicious Mockery — damage should be d6 in 2024 (was d4 in 2014)
const viciousMockery = filtered.find(s => s.id === 'vicious-mockery');
if (viciousMockery) {
  viciousMockery.description = "You unleash a string of insults laced with subtle enchantments at one creature you can see within range. The target must succeed on a Wisdom saving throw or take 1d6 Psychic damage and have Disadvantage on the next attack roll it makes before the end of its next turn. Cantrip Upgrade. The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).";
  console.log('Fixed: Vicious Mockery (d4 → d6 damage)');
}

// ── Phase 1: Add 47 missing spells ──

const newSpells = [
  // 1A. New 2024 PHB Spells (5 brand new)
  {
    id: "arcane-vigor",
    name: "Arcane Vigor",
    level: 2,
    school: "Abjuration",
    castingTime: "Bonus Action",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S",
    description: "You tap into your life force to heal yourself. Roll one or two of your unexpended Hit Point Dice, and regain a number of Hit Points equal to the roll's total plus your spellcasting ability modifier. Those dice are then expended. Using a Higher-Level Spell Slot. The number of unexpended Hit Dice you can roll increases by one for each spell slot level above 2.",
    classes: ["sorcerer", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "fount-of-moonlight",
    name: "Fount of Moonlight",
    level: 4,
    school: "Evocation",
    castingTime: "1 action",
    range: "Self",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    ritual: false,
    components: "V, S",
    description: "A cool light wreathes your body for the duration, emitting Bright Light in a 20-foot radius and Dim Light for an additional 20 feet. Until the spell ends, you have Resistance to Radiant damage, and your melee attacks deal an extra 2d6 Radiant damage on a hit. In addition, immediately after you take damage from a creature you can see within 60 feet of yourself, you can take a Reaction to force the creature to make a Constitution saving throw. On a failed save, the creature has the Blinded condition until the end of your next turn.",
    classes: ["bard", "druid"],
    spellList: ["arcane", "primal"]
  },
  {
    id: "jallarzis-storm-of-radiance",
    name: "Jallarzi's Storm of Radiance",
    level: 5,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S, M (a pinch of phosphorus)",
    description: "You unleash a storm of flashing light and raging thunder in a 10-foot-radius, 40-foot-high Cylinder centered on a point you can see within range. While in this area, creatures have the Blinded and Deafened conditions, and they can't cast spells with a Verbal component. When a creature enters the spell's area for the first time on a turn or starts its turn there, it must make a Constitution saving throw, taking 2d10 Radiant damage and 2d10 Thunder damage on a failed save, or half as much damage on a successful one. Using a Higher-Level Spell Slot. The Radiant and Thunder damage each increase by 1d10 for each spell slot level above 5.",
    classes: ["warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "power-word-fortify",
    name: "Power Word Fortify",
    level: 7,
    school: "Enchantment",
    castingTime: "1 action",
    range: "60 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "You speak a word of power that fortifies up to six creatures you can see within range. The spell bestows 120 Temporary Hit Points, which you divide among the targets as you choose.",
    classes: ["bard", "cleric"],
    spellList: ["arcane", "divine"]
  },
  {
    id: "tashas-bubbling-cauldron",
    name: "Tasha's Bubbling Cauldron",
    level: 6,
    school: "Conjuration",
    castingTime: "1 action",
    range: "5 feet",
    duration: "10 minutes",
    concentration: false,
    ritual: false,
    components: "V, S, M (a gilded ladle worth 500+ GP)",
    description: "You conjure a claw-footed cauldron filled with bubbling liquid. The cauldron appears in an unoccupied space on the ground within 5 feet of you and lasts for the duration. The liquid in the cauldron duplicates the properties of a Common or Uncommon potion of your choice (such as a Potion of Healing). As a Bonus Action, you or an ally can reach into the cauldron and withdraw one potion of that kind. The cauldron can produce a number of these potions equal to your spellcasting ability modifier (minimum 1). Once a potion is withdrawn from the cauldron, the potion becomes nonmagical after 1 minute. Using a Higher-Level Spell Slot. When you cast this spell using a level 9 spell slot, the cauldron can produce potions of Rare rarity or lower.",
    classes: ["warlock", "wizard"],
    spellList: ["arcane"]
  },

  // 1B. Missing Paladin Smite/Class Spells (8)
  {
    id: "banishing-smite",
    name: "Banishing Smite",
    level: 5,
    school: "Conjuration",
    castingTime: "Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike",
    range: "Self",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V",
    description: "The target hit by the attack roll takes an extra 5d10 Force damage from the attack. If the attack reduces the target to 50 Hit Points or fewer, the target must succeed on a Charisma saving throw or be transported to a harmless demiplane for the duration. While there, the target has the Incapacitated condition. When the spell ends, the target reappears in the space it left or in the nearest unoccupied space if that space is occupied.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "blinding-smite",
    name: "Blinding Smite",
    level: 3,
    school: "Evocation",
    castingTime: "Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike",
    range: "Self",
    duration: "1 minute",
    concentration: false,
    ritual: false,
    components: "V",
    description: "The target hit by the strike takes an extra 3d8 Radiant damage from the attack, and the target has the Blinded condition until the spell ends. At the end of each of its turns, the Blinded target makes a Constitution saving throw, ending the spell on itself on a success. Using a Higher-Level Spell Slot. The extra damage increases by 1d8 for each spell slot level above 3.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "compelled-duel",
    name: "Compelled Duel",
    level: 1,
    school: "Enchantment",
    castingTime: "Bonus Action",
    range: "30 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V",
    description: "You try to compel a creature into a duel. One creature that you can see within range makes a Wisdom saving throw. On a failed save, the target has Disadvantage on attack rolls against creatures other than you, and it can't willingly move to a space that is more than 30 feet away from you. The spell ends if you make an attack against a creature other than the target, if you cast a spell on an enemy other than the target, if an ally of yours damages the target, or if you end your turn more than 30 feet away from the target.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "crusaders-mantle",
    name: "Crusader's Mantle",
    level: 3,
    school: "Evocation",
    castingTime: "1 action",
    range: "Self",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V",
    description: "You radiate a magical aura in a 30-foot Emanation for the duration. While in the aura, you and your allies each deal an extra 1d4 Radiant damage when hitting with a weapon or an Unarmed Strike.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "destructive-wave",
    name: "Destructive Wave",
    level: 5,
    school: "Evocation",
    castingTime: "1 action",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "Destructive energy ripples outward from you in a 30-foot Emanation. Each creature you choose in the Emanation makes a Constitution saving throw. On a failed save, a target takes 5d6 Thunder damage and 5d6 Radiant or Necrotic damage (your choice) and has the Prone condition. On a successful save, a target takes half as much damage only.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "staggering-smite",
    name: "Staggering Smite",
    level: 4,
    school: "Enchantment",
    castingTime: "Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "The target hit by the strike takes an extra 4d6 Psychic damage from the attack, and the target must succeed on a Wisdom saving throw or have the Stunned condition until the end of your next turn. Using a Higher-Level Spell Slot. The extra damage increases by 1d6 for each spell slot level above 4.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "thunderous-smite",
    name: "Thunderous Smite",
    level: 1,
    school: "Evocation",
    castingTime: "Bonus Action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "Your strike rings with thunder that is audible within 300 feet of you, and the target hit by the strike takes an extra 2d6 Thunder damage from the attack. Additionally, if the target is a creature, it must succeed on a Strength saving throw or be pushed 10 feet away from you and have the Prone condition. Using a Higher-Level Spell Slot. The extra damage increases by 1d6 for each spell slot level above 1.",
    classes: ["paladin"],
    spellList: ["divine"]
  },
  {
    id: "wrathful-smite",
    name: "Wrathful Smite",
    level: 1,
    school: "Necromancy",
    castingTime: "Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike",
    range: "Self",
    duration: "1 minute",
    concentration: false,
    ritual: false,
    components: "V",
    description: "The target hit by the strike takes an extra 1d6 Necrotic damage from the attack, and the target must succeed on a Wisdom saving throw or have the Frightened condition until the spell ends. At the end of each of its turns, the Frightened target repeats the save, ending the spell on itself on a success. Using a Higher-Level Spell Slot. The extra damage increases by 1d6 for each spell slot level above 1.",
    classes: ["paladin"],
    spellList: ["divine"]
  },

  // 1C. Missing Ranger Class Spells (6)
  {
    id: "conjure-barrage",
    name: "Conjure Barrage",
    level: 3,
    school: "Conjuration",
    castingTime: "1 action",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S, M (a Melee or Ranged weapon worth at least 1 CP)",
    description: "You brandish the weapon used to cast the spell and conjure similar spectral weapons (or ammunition appropriate to the weapon) that launch forward and then disappear. Each creature of your choice that you can see in a 60-foot Cone makes a Dexterity saving throw, taking 5d8 Force damage on a failed save or half as much damage on a successful one. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 3.",
    classes: ["ranger"],
    spellList: ["primal"]
  },
  {
    id: "conjure-volley",
    name: "Conjure Volley",
    level: 5,
    school: "Conjuration",
    castingTime: "1 action",
    range: "150 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S, M (a Melee or Ranged weapon worth at least 1 CP)",
    description: "You brandish the weapon used to cast the spell and choose a point within range. Hundreds of similar spectral weapons (or ammunition appropriate to the weapon) fall in a volley and then disappear. Each creature of your choice that you can see in a 40-foot-radius, 20-foot-high Cylinder centered on that point makes a Dexterity saving throw. A creature takes 8d8 Force damage on a failed save or half as much damage on a successful one.",
    classes: ["ranger"],
    spellList: ["primal"]
  },
  {
    id: "cordon-of-arrows",
    name: "Cordon of Arrows",
    level: 2,
    school: "Transmutation",
    castingTime: "1 action",
    range: "Touch",
    duration: "8 hours",
    concentration: false,
    ritual: false,
    components: "V, S, M (an ornamental braid)",
    description: "You touch up to four nonmagical Arrows or Bolts and plant them in the ground in your space. Until the spell ends, the ammunition can't be physically uprooted, and whenever a creature other than you enters a space within 30 feet of the ammunition for the first time on a turn or ends its turn there, one piece of ammunition flies up to strike it. The creature must succeed on a Dexterity saving throw or take 2d4 Piercing damage. The piece of ammunition is then destroyed. The spell ends when none of the ammunition remains planted in the ground. When you cast the spell, you can designate any creatures you choose, and the spell ignores them. Using a Higher-Level Spell Slot. The amount of ammunition that can be affected increases by two for each spell slot level above 2.",
    classes: ["ranger"],
    spellList: ["primal"]
  },
  {
    id: "hail-of-thorns",
    name: "Hail of Thorns",
    level: 1,
    school: "Conjuration",
    castingTime: "Bonus Action, which you take immediately after hitting a creature with a Ranged weapon",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "As you hit the creature, a rain of thorns sprouts from your Ranged weapon or ammunition. The target of the attack and each creature within 5 feet of it must make a Dexterity saving throw. A creature takes 1d10 Piercing damage on a failed save or half as much damage on a successful one. Using a Higher-Level Spell Slot. The damage increases by 1d10 for each spell slot level above 1.",
    classes: ["ranger"],
    spellList: ["primal"]
  },
  {
    id: "lightning-arrow",
    name: "Lightning Arrow",
    level: 3,
    school: "Transmutation",
    castingTime: "Bonus Action, which you take immediately after hitting or missing a creature with a Ranged weapon attack",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S",
    description: "The next time you make a Ranged weapon attack, the weapon's ammunition or the weapon itself transforms into a bolt of lightning. Make the attack roll as normal. The target takes 4d8 Lightning damage on a hit or half as much on a miss, instead of the weapon's normal damage. Whether you hit or miss, each creature within 10 feet of the target must succeed on a Dexterity saving throw or take 2d8 Lightning damage. Using a Higher-Level Spell Slot. The damage for both effects increases by 1d8 for each spell slot level above 3.",
    classes: ["ranger"],
    spellList: ["primal"]
  },
  {
    id: "swift-quiver",
    name: "Swift Quiver",
    level: 5,
    school: "Transmutation",
    castingTime: "Bonus Action",
    range: "Self",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S, M (a quiver worth at least 1 GP)",
    description: "When you cast this spell and as a Bonus Action until the spell ends, you can make two attacks with a weapon that uses ammunition from a quiver. Each time you make such a ranged attack, the quiver magically replaces the piece of ammunition you used with a similar piece of nonmagical ammunition, and any piece of ammunition created by this spell disintegrates when the spell ends. If the quiver leaves your possession, the spell ends.",
    classes: ["ranger"],
    spellList: ["primal"]
  },

  // 1D. Missing Warlock Class Spells (3)
  {
    id: "armor-of-agathys",
    name: "Armor of Agathys",
    level: 1,
    school: "Abjuration",
    castingTime: "Bonus Action",
    range: "Self",
    duration: "1 hour",
    concentration: false,
    ritual: false,
    components: "V, S, M (a shard of blue glass)",
    description: "Protective magical frost surrounds you. You gain 5 Temporary Hit Points. If a creature hits you with a melee attack roll before the spell ends, the creature takes 5 Cold damage. The spell ends early if you have no Temporary Hit Points. Using a Higher-Level Spell Slot. The Temporary Hit Points and the Cold damage both increase by 5 for each spell slot level above 1.",
    classes: ["warlock"],
    spellList: ["arcane"]
  },
  {
    id: "arms-of-hadar",
    name: "Arms of Hadar",
    level: 1,
    school: "Conjuration",
    castingTime: "1 action",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S",
    description: "Invoking Hadar, you cause tendrils to erupt from yourself. Each creature in a 10-foot Emanation originating from you makes a Strength saving throw. On a failed save, a target takes 2d6 Necrotic damage and can't take Reactions until the start of its next turn. On a successful save, a target takes half as much damage only. Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 1.",
    classes: ["warlock"],
    spellList: ["arcane"]
  },
  {
    id: "hunger-of-hadar",
    name: "Hunger of Hadar",
    level: 3,
    school: "Conjuration",
    castingTime: "1 action",
    range: "150 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S, M (a pickled tentacle)",
    description: "You open a gateway to the dark between the stars, a region infested with unknown horrors. A 20-foot-radius Sphere of Darkness appears, centered on a point you choose within range. The Sphere is Difficult Terrain, and the area within it is Heavily Obscured. Any creature that starts its turn in the Sphere takes 2d6 Cold damage. Any creature that ends its turn in the Sphere must succeed on a Dexterity saving throw or take 2d6 Acid damage. Using a Higher-Level Spell Slot. The Cold damage and the Acid damage each increase by 1d6 for each spell slot level above 3.",
    classes: ["warlock"],
    spellList: ["arcane"]
  },

  // 1E. Missing Summon Spells (6)
  {
    id: "summon-aberration",
    name: "Summon Aberration",
    level: 4,
    school: "Conjuration",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "V, S, M (a pickled tentacle and an eyeball in a platinum-inlaid vial worth 400+ GP)",
    description: "You call forth an aberrant spirit. It manifests in an unoccupied space that you can see within range and uses the Aberrant Spirit stat block. When you cast the spell, choose Beholderkin, Slaad, or Star Spawn. The creature resembles an Aberration of that kind, which determines certain details in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your companions. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger. Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block.",
    classes: ["warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "summon-celestial",
    name: "Summon Celestial",
    level: 5,
    school: "Conjuration",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "V, S, M (a golden reliquary worth 500+ GP)",
    description: "You call forth a celestial spirit. It manifests in an angelic form in an unoccupied space that you can see within range and uses the Celestial Spirit stat block. When you cast the spell, choose Avenger or Defender. Your choice determines the creature's attack in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your companions. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger. Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block.",
    classes: ["cleric", "paladin"],
    spellList: ["divine"]
  },
  {
    id: "summon-construct",
    name: "Summon Construct",
    level: 4,
    school: "Conjuration",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "V, S, M (a lockbox worth 400+ GP)",
    description: "You call forth the spirit of a Construct. It manifests in an unoccupied space that you can see within range and uses the Construct Spirit stat block. When you cast the spell, choose a material: Clay, Metal, or Stone. The creature resembles an animate statue made of the chosen material, which determines certain details in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your companions. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger. Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block.",
    classes: ["wizard"],
    spellList: ["arcane"]
  },
  {
    id: "summon-dragon",
    name: "Summon Dragon",
    level: 5,
    school: "Conjuration",
    castingTime: "1 action",
    range: "60 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "V, S, M (an object with the image of a dragon engraved on it worth 500+ GP)",
    description: "You call forth a draconic spirit. It manifests in an unoccupied space that you can see within range and uses the Draconic Spirit stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your companions. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger. Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block.",
    classes: ["wizard"],
    spellList: ["arcane"]
  },
  {
    id: "summon-fiend",
    name: "Summon Fiend",
    level: 6,
    school: "Conjuration",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "V, S, M (a bloody vial worth 600+ GP)",
    description: "You call forth a fiendish spirit. It manifests in an unoccupied space that you can see within range and uses the Fiendish Spirit stat block. When you cast the spell, choose Demon, Devil, or Yugoloth. The creature resembles a Fiend of the chosen type, which determines certain details in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your companions. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger. Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block.",
    classes: ["warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "summon-undead",
    name: "Summon Undead",
    level: 3,
    school: "Necromancy",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "V, S, M (a gilded skull worth 300+ GP)",
    description: "You call forth an undead spirit. It manifests in an unoccupied space that you can see within range and uses the Undead Spirit stat block. When you cast the spell, choose the creature's form: Ghostly, Putrid, or Skeletal. The spirit resembles an Undead creature with the chosen form, which determines certain details in its stat block. The creature disappears when it drops to 0 Hit Points or when the spell ends. The creature is an ally to you and your companions. In combat, the creature shares your Initiative count, but it takes its turn immediately after yours. It obeys your verbal commands (no action required by you). If you don't issue any, it takes the Dodge action and uses its movement to avoid danger. Using a Higher-Level Spell Slot. Use the spell slot's level for the spell's level in the stat block.",
    classes: ["warlock", "wizard"],
    spellList: ["arcane"]
  },

  // 1F. Missing Cleric Spells (5)
  {
    id: "aura-of-purity",
    name: "Aura of Purity",
    level: 4,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Self",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    ritual: false,
    components: "V",
    description: "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have Resistance to Poison damage and Advantage on saving throws to avoid or end effects that include the Blinded, Charmed, Deafened, Frightened, Paralyzed, Poisoned, or Stunned condition.",
    classes: ["cleric", "paladin"],
    spellList: ["divine"]
  },
  {
    id: "circle-of-power",
    name: "Circle of Power",
    level: 5,
    school: "Abjuration",
    castingTime: "1 action",
    range: "Self",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    ritual: false,
    components: "V",
    description: "An aura radiates from you in a 30-foot Emanation for the duration. While in the aura, you and your allies have Advantage on saving throws against spells and other magical effects. When an affected creature makes a saving throw against a spell or magical effect that allows a save to take only half damage, it takes no damage if it succeeds on the save.",
    classes: ["cleric", "paladin", "wizard"],
    spellList: ["arcane", "divine"]
  },
  {
    id: "conjure-celestial",
    name: "Conjure Celestial",
    level: 7,
    school: "Conjuration",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    ritual: false,
    components: "V, S",
    description: "You conjure a spirit from the Upper Planes, which manifests as a pillar of light in a 10-foot-radius, 40-foot-high Cylinder centered on a point within range. For each creature you can see in the Cylinder, choose which of these lights shines on it: Healing Light (the target regains Hit Points equal to 4d12 plus your spellcasting ability modifier) or Searing Light (the target makes a Dexterity saving throw, taking 6d12 Radiant damage on a failed save or half as much damage on a successful one). Until the spell ends, Bright Light fills the Cylinder, and when you move on your turn, you can also move the Cylinder up to 30 feet. Whenever the Cylinder moves into the space of a creature you can see and whenever a creature you can see enters the Cylinder or ends its turn there, you can bathe it in one of the lights. A creature can be affected by this spell only once per turn. Using a Higher-Level Spell Slot. The healing and damage increase by 1d12 for each spell slot level above 7.",
    classes: ["cleric"],
    spellList: ["divine"]
  },
  {
    id: "word-of-radiance",
    name: "Word of Radiance",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "Self",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, M (a Holy Symbol)",
    description: "You utter a word of power that burns with radiance. Each creature of your choice that you can see within 5 feet of you must succeed on a Constitution saving throw or take 1d6 Radiant damage. Cantrip Upgrade. The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).",
    classes: ["cleric"],
    spellList: ["divine"]
  },
  {
    id: "word-of-recall",
    name: "Word of Recall",
    level: 6,
    school: "Conjuration",
    castingTime: "1 action",
    range: "5 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "You and up to five willing creatures within 5 feet of you instantly teleport to a previously designated sanctuary. You and any creatures that teleport with you appear in the nearest unoccupied space to the spot you designated when you prepared your sanctuary. If you cast this spell without first preparing a sanctuary, the spell has no effect. You must designate a sanctuary by casting this spell within a location, such as a temple, dedicated to or strongly linked to your deity. If you attempt to cast the spell in this manner in an area that isn't dedicated to your deity, the spell has no effect.",
    classes: ["cleric"],
    spellList: ["divine"]
  },

  // 1G. Missing Cantrips (3)
  {
    id: "friends",
    name: "Friends",
    level: 0,
    school: "Enchantment",
    castingTime: "1 action",
    range: "10 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "S, M (some makeup)",
    description: "You magically emanate a sense of friendship toward one creature you can see within range. The target must succeed on a Wisdom saving throw or have the Charmed condition for the duration. The target succeeds automatically if it isn't a Humanoid, if you're fighting it, or if you have cast this spell on it within the past 24 hours. The spell ends early if the target takes damage or if you make an attack roll, deal damage, or force anyone to make a saving throw. When the spell ends, the target knows it was Charmed by you.",
    classes: ["bard", "sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "mind-sliver",
    name: "Mind Sliver",
    level: 0,
    school: "Enchantment",
    castingTime: "1 action",
    range: "60 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V",
    description: "You drive a disorienting spike of psychic energy into the mind of one creature you can see within range. The target must succeed on an Intelligence saving throw or take 1d6 Psychic damage and subtract 1d4 from the next saving throw it makes before the end of your next turn. Cantrip Upgrade. The damage increases by 1d6 when you reach levels 5 (2d6), 11 (3d6), and 17 (4d6).",
    classes: ["sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "toll-the-dead",
    name: "Toll the Dead",
    level: 0,
    school: "Necromancy",
    castingTime: "1 action",
    range: "60 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S",
    description: "You point at one creature you can see within range, and the sound of a dolorous bell fills the area around it for a moment. The target must succeed on a Wisdom saving throw or take 1d8 Necrotic damage. If the target is missing any of its Hit Points, it instead takes 1d12 Necrotic damage. Cantrip Upgrade. The damage increases by one die when you reach levels 5 (2d8 or 2d12), 11 (3d8 or 3d12), and 17 (4d8 or 4d12).",
    classes: ["cleric", "warlock", "wizard"],
    spellList: ["arcane", "divine"]
  },

  // 1H. Other Missing Spells (11)
  {
    id: "arcane-gate",
    name: "Arcane Gate",
    level: 6,
    school: "Conjuration",
    castingTime: "1 action",
    range: "500 feet",
    duration: "Concentration, up to 10 minutes",
    concentration: true,
    ritual: false,
    components: "V, S",
    description: "You create linked teleportation portals. Choose two Large, unoccupied spaces on the ground that you can see, one space within range and the other one within 10 feet of you. A circular portal opens in each of those spaces and remains for the duration. The portals are two-dimensional glowing rings filled with mist that blocks sight. They hover inches from the ground and are perpendicular to it. A portal is open on only one side (you choose which). Anything entering the open side of a portal exits from the open side of the other portal as if the two were adjacent to each other. As a Bonus Action, you can change the facing of the open sides.",
    classes: ["sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "chromatic-orb",
    name: "Chromatic Orb",
    level: 1,
    school: "Evocation",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S, M (a diamond worth 50+ GP)",
    description: "You hurl an orb of energy at a target within range. Choose Acid, Cold, Fire, Lightning, Poison, or Thunder for the type of orb you create, and then make a ranged spell attack against the target. On a hit, the target takes 3d8 damage of the chosen type. If you roll the same number on two or more of the d8s, the orb leaps to a different target of your choice within 30 feet of the target. Make an attack roll against the new target, and make a new damage roll. The orb can't leap again unless you cast the spell with a level 2+ spell slot. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 1. The orb can leap a maximum number of times equal to the level of the slot expended, and a creature can be targeted only once by each casting of this spell.",
    classes: ["sorcerer", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "cloud-of-daggers",
    name: "Cloud of Daggers",
    level: 2,
    school: "Conjuration",
    castingTime: "1 action",
    range: "60 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S, M (a sliver of glass)",
    description: "You conjure spinning daggers in a 5-foot Cube centered on a point within range. Each creature in that area takes 4d4 Slashing damage. A creature also takes this damage if it enters the Cube or ends its turn there. A creature takes this damage only once per turn. On your later turns, you can take a Magic action to teleport the Cube up to 30 feet. Using a Higher-Level Spell Slot. The damage increases by 2d4 for each spell slot level above 2.",
    classes: ["sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "crown-of-madness",
    name: "Crown of Madness",
    level: 2,
    school: "Enchantment",
    castingTime: "1 action",
    range: "120 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S",
    description: "One creature you can see within range must succeed on a Wisdom saving throw or have the Charmed condition for the duration. The creature succeeds automatically if it isn't a Humanoid. A spectral crown appears on the Charmed target's head, and it must use its action before moving on each of its turns to make a melee attack against a creature other than itself that you mentally choose. The target can act normally on its turn if you choose no creature or if no creature is within its reach. On your later turns, you must take the Magic action to maintain control of the target, or the spell ends.",
    classes: ["bard", "sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "feign-death",
    name: "Feign Death",
    level: 3,
    school: "Necromancy",
    castingTime: "1 action or Ritual",
    range: "Touch",
    duration: "1 hour",
    concentration: false,
    ritual: true,
    components: "V, S, M (a pinch of graveyard dirt)",
    description: "You touch a willing creature and put it into a cataleptic state that is indistinguishable from death. For the duration, the target appears dead to outward inspection and to spells used to determine the target's status. The target has the Blinded and Incapacitated conditions, and its Speed is 0. The target also has Resistance to all damage except Psychic damage, and it has Immunity to the Poisoned condition.",
    classes: ["bard", "cleric", "druid", "wizard"],
    spellList: ["arcane", "divine", "primal"]
  },
  {
    id: "melfs-acid-arrow",
    name: "Melf's Acid Arrow",
    level: 2,
    school: "Evocation",
    castingTime: "1 action",
    range: "90 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S, M (powdered rhubarb leaf)",
    description: "A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. Make a ranged spell attack against the target. On a hit, the target takes 4d4 Acid damage and 2d4 Acid damage at the end of its next turn. On a miss, the arrow splashes the target with acid for half as much of the initial damage only. Using a Higher-Level Spell Slot. The damage (both initial and later) increases by 1d4 for each spell slot level above 2.",
    classes: ["wizard"],
    spellList: ["arcane"]
  },
  {
    id: "mind-spike",
    name: "Mind Spike",
    level: 2,
    school: "Divination",
    castingTime: "1 action",
    range: "120 feet",
    duration: "Concentration, up to 1 hour",
    concentration: true,
    ritual: false,
    components: "S",
    description: "You reach into the mind of one creature you can see within range. The target makes a Wisdom saving throw, taking 3d8 Psychic damage on a failed save or half as much damage on a successful one. On a failed save, you also always know the target's location until the spell ends, but only while the two of you are on the same plane of existence. While you have this knowledge, the target can't become hidden from you, and if it has the Invisible condition, it gains no benefit from that condition against you. Using a Higher-Level Spell Slot. The damage increases by 1d8 for each spell slot level above 2.",
    classes: ["sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "otilukes-resilient-sphere",
    name: "Otiluke's Resilient Sphere",
    level: 4,
    school: "Evocation",
    castingTime: "1 action",
    range: "30 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S, M (a hemispherical piece of clear crystal)",
    description: "A sphere of shimmering force encloses a Large or smaller creature or object within range. An unwilling creature must make a Dexterity saving throw. On a failed save, the creature is enclosed for the duration. Nothing—not physical objects, energy, or other spell effects—can pass through the barrier, in or out, though a creature in the Sphere can breathe there. The Sphere is immune to all damage, and a creature or object inside can't be damaged by attacks or effects originating from outside, nor can a creature inside the Sphere damage anything outside it. The Sphere is weightless. The Sphere can be picked up and moved by other creatures. A Disintegrate spell targeting the globe destroys it without harming anything inside.",
    classes: ["wizard"],
    spellList: ["arcane"]
  },
  {
    id: "synaptic-static",
    name: "Synaptic Static",
    level: 5,
    school: "Enchantment",
    castingTime: "1 action",
    range: "120 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    components: "V, S",
    description: "You choose a point within range and cause psychic energy to explode there. Each creature in a 20-foot-radius Sphere centered on that point makes an Intelligence saving throw, taking 8d6 Psychic damage on a failed save or half as much damage on a successful one. On a failed save, a target also has muddled thoughts for 1 minute. During that time, it rolls a d6 and subtracts the number rolled from all its attack rolls and ability checks, as well as its Constitution saving throws to maintain Concentration. The target repeats the save at the end of each of its turns, ending the effect on itself on a success.",
    classes: ["bard", "sorcerer", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "tashas-hideous-laughter",
    name: "Tasha's Hideous Laughter",
    level: 1,
    school: "Enchantment",
    castingTime: "1 action",
    range: "30 feet",
    duration: "Concentration, up to 1 minute",
    concentration: true,
    ritual: false,
    components: "V, S, M (a tart and a feather)",
    description: "One creature of your choice that you can see within range makes a Wisdom saving throw. On a failed save, the target has the Prone and Incapacitated conditions for the duration. A creature with an Intelligence score of 4 or lower isn't affected. At the end of each of its turns and each time it takes damage, the target repeats the save, ending the spell on itself on a success.",
    classes: ["bard", "warlock", "wizard"],
    spellList: ["arcane"]
  },
  {
    id: "telepathy",
    name: "Telepathy",
    level: 8,
    school: "Divination",
    castingTime: "1 action",
    range: "Unlimited",
    duration: "24 hours",
    concentration: false,
    ritual: false,
    components: "V, S, M (a pair of linked silver rings)",
    description: "You create a telepathic link between yourself and a willing creature with which you are familiar. The creature can be anywhere on the same plane of existence as you. The spell ends if you or the target are no longer on the same plane. Until the spell ends, you and the target can instantaneously share words, images, sounds, and other sensory messages with one another through the link, and the target recognizes you as the creature it is communicating with. The spell enables a creature with an Intelligence score of at least 1 to understand the meaning of your words and take in the scope of any sensory messages you send to it.",
    classes: ["wizard"],
    spellList: ["arcane"]
  }
];

// ── Merge and sort ──
const existingIds = new Set(filtered.map(s => s.id));
let added = 0;
let skipped = 0;

for (const spell of newSpells) {
  if (existingIds.has(spell.id)) {
    console.log(`Skipping duplicate: ${spell.name} (${spell.id})`);
    skipped++;
  } else {
    filtered.push(spell);
    added++;
  }
}

// Sort by id (alphabetical)
filtered.sort((a, b) => a.id.localeCompare(b.id));

console.log(`\nAdded ${added} new spells (${skipped} skipped as duplicates)`);
console.log(`Final spell count: ${filtered.length}`);

// Write back
fs.writeFileSync(SPELLS_PATH, JSON.stringify(filtered, null, 2) + '\n', 'utf-8');
console.log(`Wrote ${SPELLS_PATH}`);
