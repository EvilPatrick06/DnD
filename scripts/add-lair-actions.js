/**
 * Script to add lairActions and regionalEffects to all legendary creatures in monsters.json
 */

const fs = require('fs');
const path = require('path');

const monstersPath = path.join(__dirname, '..', 'src', 'renderer', 'public', 'data', '5e', 'monsters.json');

const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf-8'));

// --- Define lair/regional data by creature ID ---

const blackDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Darkness", description: "Pools of water the dragon can see within 120 feet surge outward in a grasping tide. Each creature on the ground within 20 feet of such a pool must succeed on a DC 15 Strength saving throw or be pulled up to 20 feet into the water and knocked prone." },
      { name: "Insects", description: "A cloud of swarming insects fills a 20-foot-radius sphere centered on a point the dragon chooses within 120 feet. The cloud spreads around corners and remains until the dragon dismisses it, uses this lair action again, or dies. The cloud is lightly obscured. Any creature in the cloud when it appears must make a DC 15 Constitution saving throw, taking 10 (3d6) piercing damage on a failed save, or half as much on a success." },
      { name: "Fog", description: "Magical darkness spreads from a point the dragon chooses within 60 feet, filling a 15-foot-radius sphere. Darkvision can't penetrate this darkness. It lasts until the dragon uses this action again or dies." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Foul Water", description: "Water sources within 1 mile are supernaturally fouled. Enemies of the dragon that drink such water regurgitate it within minutes." },
      { name: "Persistent Fog", description: "Fog lightly obscures the land within 6 miles of the lair." },
      { name: "Wildlife Flees", description: "The land within 6 miles of the lair takes twice as long as normal to traverse since the foliage grows thick and grasping, and swamps become soggy and unsafe." }
    ],
    endCondition: "If the dragon dies, these effects fade over 1d10 days."
  }
};

const blueDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Thunderclap", description: "Part of the ceiling in the lair collapses. Each creature within a 20-foot-radius of a point the dragon chooses within 120 feet must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) bludgeoning damage and be knocked prone." },
      { name: "Sand Vortex", description: "A cloud of sand swirls about in a 20-foot-radius sphere centered on a point the dragon chooses within 120 feet. The cloud spreads around corners. Each creature in the cloud must succeed on a DC 15 Constitution saving throw or be blinded for 1 minute. A creature can repeat the save at the end of each of its turns, ending the blindness on a success." },
      { name: "Lightning Arc", description: "Lightning arcs, forming a 5-foot-wide line between two points the dragon can see within 120 feet. Each creature in the line must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) lightning damage." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Thunderstorms", description: "Thunderstorms rage within 6 miles of the lair." },
      { name: "Dust Devils", description: "Dust devils scour the land within 6 miles of the lair. A dust devil has the statistics of an air elemental, but it can't fly, has Intelligence and Charisma of 1, and doesn't have the Whirlwind action." },
      { name: "Hidden Sinkholes", description: "Hidden sinkholes form in the lair's area. A creature on the ground that traverses the area must succeed on a DC 15 Wisdom (Perception) check or sink 1d6 feet into the sinkhole." }
    ],
    endCondition: "If the dragon dies, the dust devils disappear immediately, and thunderstorms abate within 1d10 days."
  }
};

const greenDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Grasping Roots", description: "Grasping roots and vines erupt in a 20-foot radius centered on a point on the ground the dragon can see within 120 feet. That area becomes difficult terrain, and each creature there must succeed on a DC 15 Strength saving throw or be restrained by the roots and vines until the dragon uses this action again or dies." },
      { name: "Charming Fog", description: "A wall of tangled brush bristling with thorns springs into existence on a solid surface within 120 feet. The wall is up to 60 feet long, 10 feet high, and 5 feet thick, and it blocks line of sight. Each creature in the wall's space must make a DC 15 Dexterity saving throw, taking 18 (4d8) piercing damage on a failed save, or half as much on a success." },
      { name: "Magical Fog", description: "Magical fog billows around one creature the dragon can see within 120 feet. The creature must succeed on a DC 15 Wisdom saving throw or be charmed by the dragon until initiative count 20 on the next round." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Thickets", description: "Thickets form labyrinthine passages within 1 mile of the lair. The thickets act as 10-foot-high, 10-foot-thick walls that block line of sight." },
      { name: "Plant Growth", description: "Within 1 mile of its lair, the dragon can communicate with beasts and plants as if they shared a language." },
      { name: "Mind Fog", description: "Rodents and birds within 1 mile of the lair serve as the dragon's eyes and ears." }
    ],
    endCondition: "If the dragon dies, the thickets remain but are no longer considered difficult terrain, and other effects fade over 1d10 days."
  }
};

const redDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Magma Eruption", description: "Magma erupts from a point the dragon can see within 120 feet, creating a 20-foot-high, 5-foot-radius geyser. Each creature in the geyser's area must make a DC 15 Dexterity saving throw, taking 21 (6d6) fire damage on a failed save, or half as much on a success." },
      { name: "Tremor", description: "A tremor shakes the lair in a 60-foot radius around the dragon. Each creature other than the dragon on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone." },
      { name: "Volcanic Gases", description: "Volcanic gases form a cloud in a 20-foot-radius sphere centered on a point the dragon can see within 120 feet. The sphere spreads around corners, and its area is lightly obscured. Each creature in the cloud when it appears must succeed on a DC 13 Constitution saving throw or be poisoned until the end of its next turn." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Rocky Fissures", description: "Small earthquakes are common within 6 miles of the lair." },
      { name: "Water Sources Warm", description: "Water sources within 1 mile of the lair are supernaturally warm and tainted by sulfur." },
      { name: "Rocky Outcroppings", description: "Rocky fissures emit smoke and small flames within 1 mile of the lair, lightly obscuring the area." }
    ],
    endCondition: "If the dragon dies, these effects fade over 1d10 days."
  }
};

const whiteDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Freezing Fog", description: "Freezing fog fills a 20-foot-radius sphere centered on a point the dragon can see within 120 feet. The fog spreads around corners, and its area is heavily obscured. Each creature in the fog when it appears must make a DC 10 Constitution saving throw, taking 10 (3d6) cold damage on a failed save, or half as much on a success. Moving through the fog costs 2 extra feet for every 1 foot moved." },
      { name: "Ice Wall", description: "Jagged ice erupts from a solid surface within 120 feet of the dragon, forming a wall. The wall is up to 30 feet long, 10 feet high, and 5 feet thick. Each creature in the wall's space is pushed to the outside and must succeed on a DC 15 Dexterity saving throw or take 18 (4d8) cold damage." },
      { name: "Ice Slick", description: "The dragon creates an opaque wall of ice on a solid surface it can see within 120 feet. The wall is up to 30 feet long, 1 foot thick, and 10 feet high. Each creature in the wall's space is pushed to either side (dragon's choice). A creature can make a DC 15 Strength check to break through the wall." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Chilling Fog", description: "Freezing precipitation falls within 1 mile of the lair, sometimes forming blizzard conditions." },
      { name: "Icy Surfaces", description: "Icy walls and floors are found within the lair. Floors are difficult terrain, and creatures that fall prone on them must succeed on a DC 10 Dexterity (Acrobatics) check or spend their whole turn trying to stand up." },
      { name: "Frigid Water", description: "Frigid water within 1 mile of the lair is supernaturally cold. A creature without Cold resistance that enters the water takes 5 (1d10) cold damage." }
    ],
    endCondition: "If the dragon dies, these effects fade over 1d10 days."
  }
};

const brassDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Sleep Sand", description: "A strong wind blows around the dragon. Each creature within 60 feet must succeed on a DC 15 Strength saving throw or be pushed 15 feet away from the dragon and knocked prone." },
      { name: "Heat Wave", description: "Sand erupts in a 20-foot-radius sphere at a point the dragon can see within 120 feet. Each creature in the sphere must succeed on a DC 15 Dexterity saving throw or be blinded until the end of its next turn." },
      { name: "Sand Wall", description: "A wall of sand erupts from a surface the dragon can see within 120 feet, forming a line up to 30 feet long, 10 feet high, and 5 feet thick. It blocks line of sight." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Dust Storms", description: "Dust storms frequently occur in the area within 6 miles of the lair." },
      { name: "Mirages", description: "Mirages appear in the desert within 6 miles of the lair, confusing travelers. Navigation checks are made with disadvantage." },
      { name: "Warm Winds", description: "Warm, gentle winds blow within 6 miles of the lair, keeping the temperature comfortable despite the desert setting." }
    ],
    endCondition: "If the dragon dies, these effects fade over 1d10 days."
  }
};

const bronzeDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Fog Cloud", description: "The dragon creates fog as if it had cast the Fog Cloud spell. The fog lasts until initiative count 20 on the next round." },
      { name: "Thunderclap", description: "A thunderclap originates at a point the dragon can see within 120 feet. Each creature within a 20-foot radius must succeed on a DC 15 Constitution saving throw or take 5 (1d10) thunder damage and be deafened until the end of its next turn." },
      { name: "Tidal Wave", description: "A 10-foot-wide, 20-foot-long, 10-foot-tall wave of water crashes down on a point the dragon can see within 120 feet. Each creature in that area must succeed on a DC 15 Dexterity saving throw or take 7 (2d6) bludgeoning damage and be knocked prone." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Underwater Currents", description: "Once per day, the dragon can alter the weather in a 6-mile radius centered on its lair, as if it had cast the Control Weather spell." },
      { name: "Safe Harbor", description: "Underwater plants within 6 miles of the lair take on dazzlingly brilliant hues." },
      { name: "Sea Life", description: "Within its lair, the dragon can set illusory sounds, such as soft music and strange echoes, originating from a point it can perceive within 120 feet." }
    ],
    endCondition: "If the dragon dies, changed weather reverts to normal, and other effects fade over 1d10 days."
  }
};

const copperDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Mud Slick", description: "The dragon chooses a point on the ground that it can see within 120 feet. Stone spikes erupt, creating a 20-foot-radius area of difficult terrain. Each creature in that area must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) piercing damage." },
      { name: "Rockfall", description: "The dragon causes a section of cliff or ceiling to collapse above a creature that it can see within 120 feet. The creature must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) bludgeoning damage and be knocked prone and buried. A buried creature is restrained and must succeed on a DC 15 Athletics check to dig itself free." },
      { name: "Stone Spikes", description: "The dragon chooses a 10-foot-square area on the ground that it can see within 120 feet. The ground turns to mud 3 feet deep. Each creature on the ground in that area must succeed on a DC 15 Dexterity saving throw or sink and be restrained. A creature can use its action to try to free itself with a DC 15 Strength (Athletics) check." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Talking Animals", description: "Intelligent beings within 1 mile of the dragon's lair are prone to fits of giggling or uncontrollable laughter." },
      { name: "Fool's Gold", description: "Small gems and veins of precious metal appear in rock formations within 6 miles of the lair, but they are illusory." },
      { name: "Tunnels", description: "The land within 6 miles of the lair is riddled with natural tunnels and passages created by the dragon's burrowing." }
    ],
    endCondition: "If the dragon dies, these effects fade over 1d10 days."
  }
};

const goldDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Banishment", description: "The dragon glimpses the future, so it has advantage on attack rolls, ability checks, and saving throws until initiative count 20 on the next round." },
      { name: "Lava Burst", description: "One creature the dragon can see within 120 feet must succeed on a DC 15 Charisma saving throw or be banished to a dream plane, a different plane of existence the dragon has visited. To escape, the creature must use its action to make a DC 15 Charisma check. On a success, the creature escapes the dream plane." },
      { name: "Healing Aura", description: "The dragon creates a shimmering wall of golden light. The wall is 40 feet long, 10 feet high, and 1 foot thick and appears in a space the dragon can see within 120 feet. Nonmagical flames in the wall's space are extinguished. A creature that enters the wall for the first time on a turn or starts its turn there takes 18 (4d8) radiant damage." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Gentle Mist", description: "Whenever a creature that can understand a language sleeps or enters a state of trance or reverie within 6 miles of the lair, the dragon can establish telepathic contact with that creature and converse." },
      { name: "Precious Gems", description: "Banks of beautiful, opalescent mist manifest within 6 miles of the lair. The mist doesn't obscure anything. It takes eerie shapes when evil creatures are near the dragon or its allies." },
      { name: "Luck", description: "Gems and pearls within 1 mile of the lair sparkle and gleam, shedding dim light in a 5-foot radius." }
    ],
    endCondition: "If the dragon dies, these effects end immediately."
  }
};

const silverDragonLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Fog", description: "The dragon creates fog as though it had cast the Fog Cloud spell. The fog lasts until initiative count 20 on the next round." },
      { name: "Icy Wind", description: "A blisteringly cold wind blasts through the lair. Each creature within 120 feet of the dragon must succeed on a DC 15 Constitution saving throw or take 5 (1d10) cold damage. Gases and vapors are dispersed, and unprotected flames are extinguished." },
      { name: "Wall of Ice", description: "A wall of ice springs from a surface within 120 feet. The wall is 60 feet long, 10 feet high, and 5 feet thick. Breaking through requires a DC 15 Strength check. A creature takes 10 (3d6) cold damage from touching the wall." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Peaceful Aura", description: "Within 1 mile of the lair, winds buoy non-evil creatures that fall due to no act of the dragon or its allies. Such creatures descend at a rate of 60 feet per round and take no falling damage." },
      { name: "Winter Weather", description: "Once per day, the dragon can alter the weather in a 6-mile radius, as if it had cast Control Weather." },
      { name: "Safe Shelter", description: "Within its lair, the dragon can set illusory sounds, such as soft music and strange echoes." }
    ],
    endCondition: "If the dragon dies, changed weather reverts to normal, and other effects fade over 1d10 days."
  }
};

// Non-dragon legendaries

const abolethLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Psychic Drain", description: "The aboleth casts Phantasmal Force (no spell slot required) on any number of creatures it can see within 60 feet. The aboleth needn't maintain Concentration on the spell." },
      { name: "Slimy Pool", description: "Pools of water within 90 feet surge outward. Each creature on the ground within 20 feet of such a pool must succeed on a DC 14 Strength saving throw or be pulled up to 20 feet into the pool and knocked prone." },
      { name: "Psychic Lure", description: "Water in the aboleth's lair magically becomes a conduit for the creature's rage. The aboleth can target any number of creatures it can see in such water within 90 feet. Each target must succeed on a DC 14 Wisdom saving throw or take 7 (2d6) psychic damage." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Tainted Water", description: "Underground surfaces within 1 mile of the aboleth's lair are slimy and wet, making them difficult terrain." },
      { name: "Psychic Influence", description: "Water sources within 1 mile of the lair are supernaturally fouled. Enemies of the aboleth that drink such water vomit it within minutes." },
      { name: "Aquatic Minions", description: "As an action, the aboleth can create an illusory image of itself within 1 mile of the lair. The copy can appear at any location the aboleth has seen before or in any location a creature charmed by the aboleth can currently see." }
    ],
    endCondition: "If the aboleth dies, the first two effects fade over 3d10 days."
  }
};

const beholderLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Eye Ray Ricochet", description: "A 50-foot-square area of ground within 120 feet of the beholder becomes slimy. That area is difficult terrain until initiative count 20 on the next round." },
      { name: "Grasping Appendages", description: "Walls within 120 feet of the beholder sprout grasping appendages until initiative count 20 on the round after next. Each creature of the beholder's choice that starts its turn within 10 feet of such a wall must succeed on a DC 15 Dexterity saving throw or be grappled. Escaping requires a DC 15 Strength (Athletics) or Dexterity (Acrobatics) check." },
      { name: "Random Eye", description: "An eye opens on a solid surface within 60 feet of the beholder. One random eye ray of the beholder shoots from that eye at a target of the beholder's choice that it can see. The eye then closes and vanishes." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Warped Creatures", description: "Creatures within 1 mile of the beholder's lair sometimes feel as if they're being watched when they aren't." },
      { name: "Aberrant Terrain", description: "The area within 1 mile of the lair is warped and altered to look like the beholder wants it to look. This can include creating small tunnels or reshaping walls." },
      { name: "Psychic Residue", description: "Small, seemingly unnatural things happen, like food spoiling overnight, small objects moving, and faint sounds of scratching." }
    ],
    endCondition: "If the beholder dies, these effects fade over 1d10 days."
  }
};

const deathTyrantLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Negative Energy", description: "An area of ground within 120 feet becomes a 60-foot-radius pool of negative energy. Each creature in that area must succeed on a DC 15 Constitution saving throw, taking 10 (3d6) necrotic damage on a failed save, or half as much on a success." },
      { name: "Darkness Zone", description: "A 60-foot-radius sphere of magical darkness extends from a point the death tyrant chooses within 120 feet. Darkvision can't penetrate this darkness, and no natural light can illuminate it. If any of the darkness overlaps with an area illuminated by a spell of 2nd level or lower, the spell creating the light is dispelled." },
      { name: "Undead Grasp", description: "The death tyrant targets one creature it can see within 60 feet. A crackling cord of negative energy tethers the death tyrant to the target. The target must succeed on a DC 15 Constitution saving throw or the death tyrant drains 10 (3d6) HP from the target." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Undead Rising", description: "Creatures within 1 mile of the death tyrant's lair sometimes hear faint whispers or see fleeting shadows." },
      { name: "Blighted Land", description: "The area within 1 mile of the lair is tainted by the death tyrant's presence. Vegetation withers, and small animals flee." },
      { name: "Necromantic Fog", description: "A creature that dies within 1 mile of the lair has a 10% chance of rising as a zombie 24 hours later." }
    ],
    endCondition: "If the death tyrant is destroyed, these effects fade over 1d10 days."
  }
};

const lichLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Paralyze", description: "The lich rolls a d8 and regains a spell slot of that level or lower. If it has no spent spell slots of that level or lower, nothing happens." },
      { name: "Undead Surge", description: "The lich targets one creature it can see within 30 feet. A crackling cord of negative energy tethers the lich to the target. Whenever the lich takes damage while the tether lasts, the target must make a DC 18 Constitution saving throw. On a failed save, the lich takes half the damage (rounded down), and the target takes the remaining damage. The tether lasts until initiative count 20 on the next round or until the lich or target is no longer in the lair." },
      { name: "Antimagic Zone", description: "The lich calls forth the spirits of creatures that died in its lair. These apparitions appear briefly and one of them makes a melee spell attack (+12 to hit) against one creature the lich can see within 60 feet. On a hit, the target takes 21 (6d6) necrotic damage." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Twisted Creatures", description: "Creatures within 1 mile of the lair that are dying have disadvantage on death saving throws." },
      { name: "Darkness", description: "A creeping sense of dread pervades the area within 6 miles of the lair." },
      { name: "Necromantic Corruption", description: "If a creature that isn't Undead dies within 1 mile of the lair, the lich can cause its spirit to rise as a specter at the location 24 hours later." }
    ],
    endCondition: "If the lich is destroyed but its phylactery remains, these effects persist until the phylactery is also destroyed."
  }
};

const demilichLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Soul Vortex", description: "The tomb fills with a swirling vortex of bone dust. Each creature in the lair must succeed on a DC 15 Constitution saving throw or take 10 (3d6) necrotic damage and be unable to regain Hit Points until the end of its next turn." },
      { name: "Antimagic Field", description: "The demilich targets one creature it can see within 60 feet. An antimagic field fills a 10-foot-radius sphere centered on the target until initiative count 20 on the next round." },
      { name: "Fear Aura", description: "The demilich creates a shimmering wall of bone 30 feet long, 10 feet high, and 5 feet thick. A creature that moves through the wall takes 16 (3d10) necrotic damage." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Withered Land", description: "Creatures within 100 feet of the demilich's lair feel an overwhelming sense of despair and dread." },
      { name: "Silence", description: "Magical wards prevent teleportation within 1 mile of the lair." },
      { name: "Trapped Souls", description: "Undead within 1 mile of the lair have advantage on saving throws against features that turn Undead." }
    ],
    endCondition: "If the demilich is destroyed, these effects fade over 10 days."
  }
};

const krakenLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Lightning Storm", description: "A strong current moves through the kraken's lair. Each creature within 60 feet of the kraken must succeed on a DC 23 Strength saving throw or be pushed up to 60 feet away from the kraken and knocked prone." },
      { name: "Whirlpool", description: "Creatures in the water within 60 feet of the kraken have vulnerability to lightning damage until initiative count 20 on the next round." },
      { name: "Tentacle Grasp", description: "The water in the kraken's lair becomes electrically charged. Each creature within 120 feet must succeed on a DC 23 Constitution saving throw, taking 10 (3d6) lightning damage on a failed save, or half as much on a success." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Stormy Seas", description: "The sea within 6 miles of the lair is extremely difficult to navigate." },
      { name: "Aquatic Predators", description: "Aquatic creatures within 6 miles of the lair that have an Intelligence score of 2 or lower are charmed by the kraken and aggressive toward intruders." },
      { name: "Weather Control", description: "The kraken can alter the weather at will in a 6-mile radius, as though it had cast Control Weather." }
    ],
    endCondition: "If the kraken dies, these effects fade over 1d10 days."
  }
};

const mummyLordLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Sandstorm", description: "Each undead in the lair can pinpoint the location of each living creature within 120 feet as though it had blindsight." },
      { name: "Cursed Dust", description: "A cloud of sand swirls in a 20-foot-radius sphere at a point the mummy lord can see within 120 feet. Each creature in the cloud must succeed on a DC 16 Constitution saving throw or be blinded until the end of its next turn." },
      { name: "Undead Rally", description: "Each undead ally within 60 feet of the mummy lord gains 10 temporary hit points." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Dessication", description: "Food brought within 1 mile of the lair instantly molders and spoils." },
      { name: "Sandstorms", description: "Sandstorms rage within 6 miles of the lair." },
      { name: "Undead", description: "Undead within 1 mile of the lair have advantage on saving throws against features that turn Undead." }
    ],
    endCondition: "If the mummy lord is destroyed, these effects end immediately."
  }
};

const vampireLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Summon Swarm", description: "The vampire summons a swarm of bats or rats. The swarm appears in an unoccupied space within 60 feet and acts on the vampire's initiative. The swarm disperses after 1 round." },
      { name: "Shadowy Tendrils", description: "Shadowy tendrils extend from the walls and floor within 20 feet of a target the vampire can see within 60 feet. The target must succeed on a DC 15 Dexterity saving throw or be grappled (escape DC 15). Until the grapple ends, the target is restrained." },
      { name: "Fog", description: "The vampire causes a section of the lair to fill with creeping fog until initiative count 20 on the next round. The fog is lightly obscured." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Persistent Fog", description: "A creeping fog clings to the area within 500 feet of the vampire's lair." },
      { name: "Animal Servants", description: "The area within 1 mile of the lair is overrun with wolves, bats, and rats that serve the vampire." },
      { name: "Oppressive Aura", description: "If a humanoid spends at least 1 hour within 1 mile of the lair, that humanoid must succeed on a DC 15 Wisdom saving throw or feel an overwhelming sense of dread." }
    ],
    endCondition: "If the vampire is destroyed, these effects end after 2d6 days."
  }
};

const androsphinxLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Teleport", description: "The flow of time is altered such that every creature in the lair must reroll initiative. The sphinx can choose not to reroll." },
      { name: "Time Shift", description: "The lair fills with a magical miasma that affects all creatures other than the sphinx. Each such creature must succeed on a DC 15 Constitution saving throw or be affected by the Slow spell for 1 minute." },
      { name: "Aging", description: "The sphinx shifts itself and up to seven other creatures it can see in its lair to another plane of existence." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Time Anomalies", description: "The region within 1 mile of the sphinx's lair is altered by the creature's presence, creating one or more of these effects: a time anomaly that causes creatures to age or de-age while in the area." }
    ],
    endCondition: "If the sphinx dies, these effects end immediately."
  }
};

const gynosphinxLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Temporal Shift", description: "The flow of time within the lair is altered. Each creature in the lair must reroll initiative. The sphinx chooses whether to reroll." },
      { name: "Planar Trap", description: "The lair fills with magical darkness (as the Darkness spell) in a 30-foot radius around a point the sphinx can see. The darkness lasts until initiative count 20 on the next round." },
      { name: "Riddle Curse", description: "The sphinx targets one creature it can see within 60 feet. The target must succeed on a DC 15 Intelligence saving throw or be teleported to a random unoccupied space within 60 feet." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Riddle Magic", description: "The region within 1 mile of the sphinx's lair is warped by its presence. Each creature that finishes a long rest within 1 mile of the lair must succeed on a DC 15 Intelligence saving throw or be subjected to a random minor magical effect." }
    ],
    endCondition: "If the sphinx dies, these effects end immediately."
  }
};

const archHagLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Hallucinatory Terrain", description: "The arch-hag creates an illusory duplicate of herself within 60 feet. The duplicate lasts until initiative count 20 on the next round. A creature can discern the duplicate with a DC 16 Intelligence (Investigation) check." },
      { name: "Hex", description: "A creature the arch-hag can see within 60 feet must succeed on a DC 16 Wisdom saving throw or be frightened until initiative count 20 on the next round." },
      { name: "Fey Curse", description: "The arch-hag targets a 20-foot-radius area within 120 feet. The area becomes difficult terrain until initiative count 20 on the next round." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Twisted Nature", description: "Plants within 1 mile of the lair twist into thorny, unwholesome forms." },
      { name: "Bewitched Beasts", description: "Beasts within 1 mile of the lair are supernaturally aggressive and territorial." },
      { name: "Eerie Sounds", description: "Eerie sounds echo within 1 mile of the lair, including cackles, whispers, and wailing." }
    ],
    endCondition: "If the arch-hag dies, these effects fade over 1d10 days."
  }
};

const unicornLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Healing Mist", description: "The unicorn causes shimmering fey light to appear in a 20-foot-radius sphere centered on a point it can see within 120 feet. Each creature in the sphere must succeed on a DC 15 Dexterity saving throw or be blinded until the end of its next turn." },
      { name: "Teleport", description: "The unicorn creates a shimmering field that covers a 20-foot square within 60 feet. Any spell of 4th level or lower cast from outside the field can't affect creatures or objects within it." },
      { name: "Calming Aura", description: "The unicorn conjures a swirling mist around a creature it can see within 60 feet. The target must succeed on a DC 15 Wisdom saving throw or the unicorn teleports the target to an unoccupied space it can see within 60 feet." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Pure Water", description: "Open flames of a nonmagical nature are extinguished within 1 mile of the lair. Torches and campfires refuse to burn." },
      { name: "Blessed Land", description: "Creatures native to the lair have advantage on all Wisdom-based saving throws while within 1 mile of the lair." },
      { name: "Nature's Shield", description: "Curses, diseases, and poison have no effect on creatures within 1 mile of the lair." }
    ],
    endCondition: "If the unicorn dies, these effects end immediately."
  }
};

const dracolichLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Necrotic Eruption", description: "Necrotic energy erupts from a point the dracolich can see within 120 feet. Each creature within 20 feet must succeed on a DC 15 Constitution saving throw or take 14 (4d6) necrotic damage." },
      { name: "Tremor", description: "A tremor shakes the lair in a 60-foot radius around the dracolich. Each creature other than the dracolich on the ground in that area must succeed on a DC 15 Dexterity saving throw or be knocked prone." },
      { name: "Undead Rising", description: "The dracolich targets one corpse within 120 feet that it can see. The corpse rises as a zombie under the dracolich's control. The zombie takes its turn immediately after the dracolich." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Blighted Land", description: "Vegetation within 1 mile of the lair withers, and the land becomes barren and lifeless." },
      { name: "Undead Presence", description: "Undead within 1 mile of the lair have advantage on saving throws against features that turn Undead." },
      { name: "Dread Aura", description: "Creatures within 1 mile of the lair that are sleeping experience nightmares." }
    ],
    endCondition: "If the dracolich is destroyed, these effects fade over 1d10 days."
  }
};

const solarLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Blinding Light", description: "Blinding light fills a 30-foot-radius sphere centered on a point the solar can see within 120 feet. Each creature in the sphere must succeed on a DC 21 Constitution saving throw or be blinded until the end of its next turn." },
      { name: "Healing Word", description: "The solar restores 20 Hit Points to one creature it can see within 60 feet." },
      { name: "Divine Judgment", description: "The solar targets one creature it can see within 60 feet. The target must succeed on a DC 21 Charisma saving throw or be stunned until initiative count 20 on the next round." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Blessed Land", description: "Within 1 mile of the lair, evil creatures have disadvantage on attack rolls and saving throws." },
      { name: "Radiant Light", description: "Magical darkness can't be created within 1 mile of the lair." },
      { name: "Peace", description: "Celestials within 1 mile of the lair have advantage on all saving throws." }
    ],
    endCondition: "If the solar dies or leaves, these effects end immediately."
  }
};

const empyreanLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Earthquake", description: "The empyrean creates a 30-foot-radius tremor centered on a point it can see within 150 feet. Each creature in the area must succeed on a DC 23 Dexterity saving throw or take 14 (4d6) bludgeoning damage and be knocked prone." },
      { name: "Lightning Bolt", description: "The empyrean hurls a bolt of energy at a point it can see within 150 feet. Each creature within 10 feet of the point must succeed on a DC 23 Dexterity saving throw or take 22 (4d10) radiant or necrotic damage (empyrean's choice)." },
      { name: "Summon Elemental", description: "The empyrean summons a water, earth, fire, or air elemental that appears in an unoccupied space within 60 feet. The elemental acts on the empyrean's initiative and obeys its commands." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Weather Control", description: "The empyrean can alter the weather in a 5-mile radius, as if it had cast Control Weather." },
      { name: "Blessed Ground", description: "Flowers bloom and trees bear fruit in abundance within 1 mile of the lair." },
      { name: "Emotional Aura", description: "Creatures within 1 mile of the lair feel strong emotions tied to the empyrean's mood \u2014 joy when it's happy, dread when it's angry." }
    ],
    endCondition: "If the empyrean dies, these effects end over 1d10 days."
  }
};

const tarrasqueLair = {
  lairActions: {
    initiativeCount: 20,
    actions: []
  },
  regionalEffects: {
    effects: [
      { name: "Devastation", description: "The land within 1 mile of the tarrasque's resting place is scarred and barren, reflecting the destruction it has caused." },
      { name: "Seismic Activity", description: "Minor tremors occur within 5 miles of the tarrasque when it stirs." },
      { name: "Fleeing Wildlife", description: "No creature with Intelligence 3 or higher willingly approaches within 1 mile of the tarrasque." }
    ],
    endCondition: "These effects end if the tarrasque is destroyed."
  }
};

const animalLordLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Animal Surge", description: "The animal lord summons 1d4+1 beasts of CR 1 or lower that appear in unoccupied spaces within 60 feet. They act on the animal lord's initiative." },
      { name: "Nature's Grasp", description: "Roots and vines erupt from the ground in a 20-foot-radius sphere centered on a point within 120 feet. The area becomes difficult terrain, and each creature in it must succeed on a DC 17 Strength saving throw or be restrained." },
      { name: "Primal Roar", description: "Each hostile creature within 60 feet must succeed on a DC 17 Wisdom saving throw or be frightened until the end of its next turn." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Abundant Wildlife", description: "Within 3 miles of the lair, animals are unusually numerous and healthy." },
      { name: "Nature's Shield", description: "Natural terrain within 1 mile of the lair is difficult terrain for the animal lord's enemies." },
      { name: "Animal Sentinels", description: "The animal lord is always aware of intruders within 3 miles of its lair through animal sentinels." }
    ],
    endCondition: "If the animal lord dies, these effects fade over 1d10 days."
  }
};

const elementalCataclysmLair = {
  lairActions: {
    initiativeCount: 20,
    actions: [
      { name: "Elemental Surge", description: "An elemental force erupts from a point the cataclysm can see within 120 feet. Choose fire, cold, lightning, or thunder. Each creature within 20 feet must succeed on a DC 20 Dexterity saving throw or take 14 (4d6) damage of the chosen type." },
      { name: "Elemental Shift", description: "The ground in a 30-foot radius around a point the cataclysm can see transforms: to lava (fire), ice (cold), crackling energy (lightning), or unstable earth (thunder). The area is difficult terrain and deals 7 (2d6) damage of the appropriate type to creatures starting their turn in it." },
      { name: "Planar Rift", description: "A 10-foot-radius portal to an elemental plane opens at a point within 120 feet. Creatures within 15 feet must succeed on a DC 20 Strength saving throw or be pulled 10 feet toward the portal. A creature that enters the portal takes 21 (6d6) damage of a random elemental type." }
    ]
  },
  regionalEffects: {
    effects: [
      { name: "Elemental Storms", description: "Elemental storms of random types rage within 3 miles of the lair." },
      { name: "Unstable Terrain", description: "The terrain within 1 mile of the lair shifts between elemental extremes \u2014 patches of fire, ice, crackling lightning, and trembling earth." },
      { name: "Planar Bleed", description: "Minor portals to elemental planes occasionally open within 1 mile, releasing small elementals or elemental energy." }
    ],
    endCondition: "If the elemental cataclysm is destroyed, these effects fade over 1d6 days."
  }
};

// Map creature IDs to their lair data
const lairDataMap = {
  // Black dragons
  'adult-black-dragon': blackDragonLair,
  'ancient-black-dragon': blackDragonLair,
  // Blue dragons
  'adult-blue-dragon': blueDragonLair,
  'ancient-blue-dragon': blueDragonLair,
  // Green dragons
  'adult-green-dragon': greenDragonLair,
  'ancient-green-dragon': greenDragonLair,
  // Red dragons
  'adult-red-dragon': redDragonLair,
  'ancient-red-dragon': redDragonLair,
  // White dragons
  'adult-white-dragon': whiteDragonLair,
  'ancient-white-dragon': whiteDragonLair,
  // Brass dragons
  'adult-brass-dragon': brassDragonLair,
  'ancient-brass-dragon': brassDragonLair,
  // Bronze dragons
  'adult-bronze-dragon': bronzeDragonLair,
  'ancient-bronze-dragon': bronzeDragonLair,
  // Copper dragons
  'adult-copper-dragon': copperDragonLair,
  'ancient-copper-dragon': copperDragonLair,
  // Gold dragons
  'adult-gold-dragon': goldDragonLair,
  'ancient-gold-dragon': goldDragonLair,
  // Silver dragons
  'adult-silver-dragon': silverDragonLair,
  'ancient-silver-dragon': silverDragonLair,
  // Non-dragon legendaries
  'aboleth': abolethLair,
  'beholder': beholderLair,
  'death-tyrant': deathTyrantLair,
  'lich': lichLair,
  'demilich': demilichLair,
  'kraken': krakenLair,
  'mummy-lord': mummyLordLair,
  'vampire': vampireLair,
  'androsphinx': androsphinxLair,
  'gynosphinx': gynosphinxLair,
  'arch-hag': archHagLair,
  'unicorn': unicornLair,
  'dracolich': dracolichLair,
  'solar': solarLair,
  'empyrean': empyreanLair,
  'tarrasque': tarrasqueLair,
  'animal-lord': animalLordLair,
  'elemental-cataclysm': elementalCataclysmLair,
};

// Process each monster
let updated = 0;
let skipped = 0;
let notFound = [];

for (const monster of monsters) {
  if (lairDataMap[monster.id]) {
    const data = lairDataMap[monster.id];

    // Check if already has lair actions
    if (monster.lairActions) {
      console.log(`  SKIP: ${monster.id} - already has lairActions`);
      skipped++;
      continue;
    }

    monster.lairActions = data.lairActions;
    monster.regionalEffects = data.regionalEffects;
    updated++;
    console.log(`  ADDED: ${monster.id} - lairActions (${data.lairActions.actions.length} actions) + regionalEffects (${data.regionalEffects.effects.length} effects)`);
  }
}

// Check for any IDs that weren't found in the data
const monsterIds = new Set(monsters.map(m => m.id));
for (const id of Object.keys(lairDataMap)) {
  if (!monsterIds.has(id)) {
    notFound.push(id);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Updated: ${updated} creatures`);
console.log(`Skipped (already had data): ${skipped}`);
if (notFound.length > 0) {
  console.log(`NOT FOUND in monsters.json: ${notFound.join(', ')}`);
}

// Write back
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n', 'utf-8');
console.log(`\nWritten to ${monstersPath}`);
