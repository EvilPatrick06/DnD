#!/usr/bin/env node
/**
 * MM 2025 Markdown Stat Block Parser
 *
 * Reads all markdown files from 5.5e References/MM2025/Markdown/ and extracts
 * every stat block into MonsterStatBlock-shaped JSON.
 *
 * Usage: node scripts/mm2025-parse.js
 * Output: scripts/mm2025-parsed.json
 */

const fs = require('fs');
const path = require('path');

// === Constants ===

const CR_TO_XP = {
  '0': 0, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000
};

const CR_TO_PB = {
  '0': 2, '1/8': 2, '1/4': 2, '1/2': 2,
  '1': 2, '2': 2, '3': 2, '4': 2,
  '5': 3, '6': 3, '7': 3, '8': 3,
  '9': 4, '10': 4, '11': 4, '12': 4,
  '13': 5, '14': 5, '15': 5, '16': 5,
  '17': 6, '18': 6, '19': 6, '20': 6,
  '21': 7, '22': 7, '23': 7, '24': 7,
  '25': 8, '26': 8, '27': 8, '28': 8,
  '29': 9, '30': 9
};

const SIZE_TO_TOKEN = {
  'Tiny': { x: 1, y: 1 },
  'Small': { x: 1, y: 1 },
  'Medium': { x: 1, y: 1 },
  'Large': { x: 2, y: 2 },
  'Huge': { x: 3, y: 3 },
  'Gargantuan': { x: 4, y: 4 },
};

const VALID_SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];

const VALID_TYPES = [
  'Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon',
  'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid',
  'Monstrosity', 'Ooze', 'Plant', 'Undead'
];

// === Utility Functions ===

function toKebabCase(name) {
  return name
    .toLowerCase()
    .replace(/[''\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseNumber(str) {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function normalizeQuotes(str) {
  return str.replace(/[\u2018\u2019\u201C\u201D]/g, m => {
    if (m === '\u2018' || m === '\u2019') return "'";
    return '"';
  });
}

function normalizeDashes(str) {
  return str.replace(/[\u2013\u2014\u2212]/g, '-');
}

function cleanText(str) {
  return normalizeDashes(normalizeQuotes(str.trim()));
}

// === Type Line Parser ===

function parseTypeLine(line) {
  // Format: *Size Type (Subtype), Alignment*
  // Or: *Medium or Small Humanoid, Neutral*
  // Or: *Medium Swarm of Tiny Undead, Neutral Evil*
  const cleaned = line.replace(/^\*|\*$/g, '').trim();

  let size = 'Medium';
  let type = 'Humanoid';
  let subtype = undefined;
  let alignment = 'Unaligned';

  // Split on last comma to get alignment
  const lastComma = cleaned.lastIndexOf(',');
  if (lastComma === -1) return { size, type, subtype, alignment };

  alignment = cleaned.substring(lastComma + 1).trim();
  const prefix = cleaned.substring(0, lastComma).trim();

  // Handle "Medium or Small" size
  const sizeOrMatch = prefix.match(/^(Medium or Small|Small or Medium)\s+(.+)/i);
  if (sizeOrMatch) {
    size = 'Medium';
    const rest = sizeOrMatch[2];
    return { size, ...parseTypeAndSubtype(rest), alignment };
  }

  // Handle "Medium Swarm of Tiny Undead"
  const swarmMatch = prefix.match(/^(\w+)\s+Swarm\s+of\s+(\w+)\s+(.+)/i);
  if (swarmMatch) {
    size = capitalizeFirst(swarmMatch[1]);
    const swarmSize = swarmMatch[2];
    const rest = swarmMatch[3];
    const { type: t, subtype: st } = parseTypeAndSubtype(rest);
    return { size, type: t, subtype: st || `Swarm of ${swarmSize}`, alignment };
  }

  // Standard: "Size Type (Subtype)"
  const standardMatch = prefix.match(/^(\w+)\s+(.+)/);
  if (standardMatch) {
    size = capitalizeFirst(standardMatch[1]);
    if (!VALID_SIZES.includes(size)) {
      // Might be a weird format, default Medium
      size = 'Medium';
      return { size, ...parseTypeAndSubtype(prefix), alignment };
    }
    return { size, ...parseTypeAndSubtype(standardMatch[2]), alignment };
  }

  return { size, type, subtype, alignment };
}

function parseTypeAndSubtype(str) {
  // "Humanoid (Goblinoid)" or "Dragon (Chromatic)" or just "Beast"
  const parenMatch = str.match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
  if (parenMatch) {
    let type = parenMatch[1].trim();
    const subtype = parenMatch[2] ? parenMatch[2].trim() : undefined;

    // Validate type
    const matchedType = VALID_TYPES.find(t => t.toLowerCase() === type.toLowerCase());
    if (matchedType) type = matchedType;

    return { type, subtype };
  }
  return { type: str.trim(), subtype: undefined };
}

function capitalizeFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// === AC / Initiative Parser ===

function parseAcInitLine(line) {
  const result = { ac: 10, acType: undefined, initiative: undefined };
  const cleaned = cleanText(line);

  // **AC** 17 (Natural Armor) | **Initiative** +7 (17)
  // **AC** 17 | **Initiative** +7 (17)
  const acMatch = cleaned.match(/\*\*AC\*\*\s+(\d+)(?:\s*\(([^)]+)\))?/);
  if (acMatch) {
    result.ac = parseInt(acMatch[1], 10);
    if (acMatch[2]) {
      const acType = acMatch[2].trim();
      // Skip AC types that are just references to spells already included
      if (!acType.toLowerCase().includes('included in ac')) {
        result.acType = acType;
      }
    }
  }

  const initMatch = cleaned.match(/\*\*Initiative\*\*\s+([+-]?\d+)\s*\((\d+)\)/);
  if (initMatch) {
    result.initiative = {
      modifier: parseInt(initMatch[1], 10),
      score: parseInt(initMatch[2], 10)
    };
  }

  return result;
}

// === HP Parser ===

function parseHpLine(line) {
  const cleaned = cleanText(line);
  const result = { hp: 0, hitDice: '' };

  // **HP** 150 (20d10 + 40)  or  **HP** 7 (2d6)  or  **HP** 2 (1d4)
  const hpMatch = cleaned.match(/\*\*HP\*\*\s+(\d+)\s*\(([^)]+)\)/);
  if (hpMatch) {
    result.hp = parseInt(hpMatch[1], 10);
    result.hitDice = normalizeDashes(hpMatch[2].trim());
  }

  return result;
}

// === Speed Parser ===

function parseSpeedLine(line) {
  const cleaned = cleanText(line);
  const speed = { walk: 30 };

  // **Speed** 10 ft., Swim 40 ft.
  // **Speed** 5 ft., Fly 30 ft. (hover)
  // **Speed** 30 ft., Burrow 15 ft., Fly 60 ft., Swim 30 ft.
  const speedSection = cleaned.replace(/^\*\*Speed\*\*\s*/, '');

  // Walk speed is the first number
  const walkMatch = speedSection.match(/^(\d+)\s*ft\./);
  if (walkMatch) speed.walk = parseInt(walkMatch[1], 10);

  // Other speeds
  const burrowMatch = speedSection.match(/Burrow\s+(\d+)\s*ft\./i);
  if (burrowMatch) speed.burrow = parseInt(burrowMatch[1], 10);

  const climbMatch = speedSection.match(/Climb\s+(\d+)\s*ft\./i);
  if (climbMatch) speed.climb = parseInt(climbMatch[1], 10);

  const flyMatch = speedSection.match(/Fly\s+(\d+)\s*ft\.(?:\s*\((hover)\))?/i);
  if (flyMatch) {
    speed.fly = parseInt(flyMatch[1], 10);
    if (flyMatch[2]) speed.hover = true;
  }

  const swimMatch = speedSection.match(/Swim\s+(\d+)\s*ft\./i);
  if (swimMatch) speed.swim = parseInt(swimMatch[1], 10);

  return speed;
}

// === Ability Score Table Parser ===
// Format A (standard - row-oriented):
// | **Str** 21 | +5 | +5 | **Dex** 9 | -1 | +3 | **Con** 15 | +2 | +6 |
// Format B (column-oriented, used by Dragons-Other.md):
// |       | STR    | DEX    | CON    | INT    | WIS    | CHA    |
// | Score | 3      | 16     | 12     | 12     | 12     | 14     |
// | Mod   | -4     | +3     | +1     | +1     | +1     | +2     |
// | Save  | -4     | +3     | +1     | +1     | +1     | +2     |

function parseAbilityScores(lines) {
  const result = {
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {}
  };

  // Detect Format B: header row has STR, DEX etc. as plain column names (not bold **Str**)
  // Format B: "| ... | STR | DEX |" — no ** markers around ability names
  const headerLine = lines.find(l => /\|\s*STR\s*\|/i.test(l) && !/\*\*/.test(l));
  if (headerLine) {
    return parseAbilityScoresColumnFormat(lines);
  }

  // Format A
  for (const line of lines) {
    const cleaned = normalizeDashes(normalizeQuotes(line));
    const abilityPattern = /\*\*(\w+)\*\*\s+(\d+)\s*\|\s*([+-]?\d+)\s*\|\s*([+-]?\d+)/g;
    let match;
    while ((match = abilityPattern.exec(cleaned)) !== null) {
      const abilityName = match[1].toLowerCase().substring(0, 3);
      const score = parseInt(match[2], 10);
      const mod = parseInt(match[3], 10);
      const save = parseInt(match[4], 10);

      if (['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(abilityName)) {
        result.abilityScores[abilityName] = score;
        if (save !== mod) {
          result.savingThrows[abilityName] = save;
        }
      }
    }
  }

  return result;
}

// Parse column-oriented ability score table (Format B)
function parseAbilityScoresColumnFormat(lines) {
  const result = {
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {}
  };
  const abilityOrder = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  let scoreLine = null;
  let modLine = null;
  let saveLine = null;

  for (const line of lines) {
    const normalized = normalizeDashes(normalizeQuotes(line)).trim();
    if (/^\|\s*Score\s*\|/i.test(normalized)) scoreLine = normalized;
    else if (/^\|\s*Mod\s*\|/i.test(normalized)) modLine = normalized;
    else if (/^\|\s*Save\s*\|/i.test(normalized)) saveLine = normalized;
  }

  if (scoreLine && modLine) {
    const scores = [...scoreLine.matchAll(/\d+/g)].map(m => parseInt(m[0]));
    const mods = [...modLine.matchAll(/[+-]?\d+/g)].map(m => parseInt(m[0]));
    const saves = saveLine ? [...saveLine.matchAll(/[+-]?\d+/g)].map(m => parseInt(m[0])) : mods;

    for (let idx = 0; idx < abilityOrder.length && idx < scores.length; idx++) {
      result.abilityScores[abilityOrder[idx]] = scores[idx];
      if (saves[idx] !== undefined && mods[idx] !== undefined && saves[idx] !== mods[idx]) {
        result.savingThrows[abilityOrder[idx]] = saves[idx];
      }
    }
  }

  return result;
}

// === Property Line Parsers ===

function parseSkills(line) {
  // **Skills** History +12, Perception +10
  const cleaned = cleanText(line.replace(/^\*\*Skills\*\*\s*/, ''));
  const skills = {};
  const pattern = /([\w\s]+?)\s+([+-]\d+)/g;
  let match;
  while ((match = pattern.exec(cleaned)) !== null) {
    skills[match[1].trim()] = parseInt(match[2], 10);
  }
  return skills;
}

function parseResistances(line) {
  // **Resistances** Acid, Fire
  // Can also be "Bludgeoning, Piercing, Slashing"
  const cleaned = cleanText(line.replace(/^\*\*Resistances\*\*\s*/, ''));
  return cleaned.split(',').map(r => r.trim()).filter(Boolean);
}

function parseVulnerabilities(line) {
  const cleaned = cleanText(line.replace(/^\*\*Vulnerabilities\*\*\s*/, ''));
  return cleaned.split(',').map(r => r.trim()).filter(Boolean);
}

function parseImmunities(line) {
  // **Immunities** Cold, Necrotic, Poison; Charmed, Exhaustion, Frightened
  // Semicolon separates damage immunities from condition immunities
  // Or just condition immunities: **Immunities** Charmed, Frightened
  const cleaned = cleanText(line.replace(/^\*\*Immunities\*\*\s*/, ''));

  const damageTypes = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning',
    'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];

  const parts = cleaned.split(';').map(p => p.trim());

  if (parts.length === 1) {
    // Could be all damage or all condition immunities
    const items = parts[0].split(',').map(i => i.trim()).filter(Boolean);
    const damageImmunities = [];
    const conditionImmunities = [];

    for (const item of items) {
      if (damageTypes.some(d => item.toLowerCase().startsWith(d.toLowerCase()))) {
        damageImmunities.push(item);
      } else {
        conditionImmunities.push(item);
      }
    }

    return { damageImmunities, conditionImmunities };
  }

  // Two parts: damage ; condition
  const damageImmunities = parts[0].split(',').map(i => i.trim()).filter(Boolean);
  const conditionImmunities = parts[1].split(',').map(i => i.trim()).filter(Boolean);

  return { damageImmunities, conditionImmunities };
}

function parseSenses(line) {
  // **Senses** Darkvision 120 ft., Tremorsense 60 ft.; Passive Perception 20
  // **Senses** Blindsight 10 ft., Darkvision 60 ft.; Passive Perception 14
  // **Senses** Passive Perception 10
  const cleaned = cleanText(line.replace(/^\*\*Senses\*\*\s*/, ''));
  const senses = { passivePerception: 10 };

  const ppMatch = cleaned.match(/Passive Perception\s+(\d+)/i);
  if (ppMatch) senses.passivePerception = parseInt(ppMatch[1], 10);

  const blindsightMatch = cleaned.match(/Blindsight\s+(\d+)\s*ft\./i);
  if (blindsightMatch) senses.blindsight = parseInt(blindsightMatch[1], 10);

  const darkvisionMatch = cleaned.match(/Darkvision\s+(\d+)\s*ft\./i);
  if (darkvisionMatch) senses.darkvision = parseInt(darkvisionMatch[1], 10);

  const tremorsenseMatch = cleaned.match(/Tremorsense\s+(\d+)\s*ft\./i);
  if (tremorsenseMatch) senses.tremorsense = parseInt(tremorsenseMatch[1], 10);

  const truesightMatch = cleaned.match(/Truesight\s+(\d+)\s*ft\./i);
  if (truesightMatch) senses.truesight = parseInt(truesightMatch[1], 10);

  return senses;
}

function parseLanguages(line) {
  // **Languages** Deep Speech; telepathy 120 ft.
  // **Languages** Common, Draconic
  // **Languages** Understands Common but can't speak
  // **Languages** None
  const cleaned = cleanText(line.replace(/^\*\*Languages\*\*\s*/, ''));
  const result = { languages: [], telepathy: undefined };

  // Check for telepathy
  const telepathyMatch = cleaned.match(/telepathy\s+(\d+)\s*ft\./i);
  if (telepathyMatch) {
    result.telepathy = parseInt(telepathyMatch[1], 10);
  }

  // Remove telepathy part and split on semicolon
  let langPart = cleaned.replace(/;?\s*telepathy\s+\d+\s*ft\.?/i, '').trim();

  if (langPart.toLowerCase() === 'none' || langPart === '' || langPart === '—' || langPart === '-') {
    result.languages = [];
  } else {
    result.languages = langPart.split(',').map(l => l.trim()).filter(Boolean);
  }

  return result;
}

function parseCR(line) {
  // **CR** 10 (XP 5,900; PB +4)
  // **CR** 10 (XP 5,900, or 7,200 in lair; PB +4)
  // **CR** 1/8 (XP 25; PB +2)
  const cleaned = cleanText(line.replace(/^\*\*CR\*\*\s*/, ''));
  const result = { cr: '0', xp: 0, proficiencyBonus: 2 };

  const crMatch = cleaned.match(/^([\d/]+)/);
  if (crMatch) result.cr = crMatch[1];

  const xpMatch = cleaned.match(/XP\s+([\d,]+)/);
  if (xpMatch) result.xp = parseNumber(xpMatch[1]);

  const pbMatch = cleaned.match(/PB\s+\+(\d+)/);
  if (pbMatch) result.proficiencyBonus = parseInt(pbMatch[1], 10);

  // Validate XP against CR
  if (CR_TO_XP[result.cr] !== undefined && result.xp === 0) {
    result.xp = CR_TO_XP[result.cr];
  }
  if (CR_TO_PB[result.cr] !== undefined && result.proficiencyBonus === 2) {
    result.proficiencyBonus = CR_TO_PB[result.cr];
  }

  return result;
}

function parseGear(line) {
  const cleaned = cleanText(line.replace(/^\*\*Gear\*\*\s*/, ''));
  return cleaned.split(',').map(g => g.trim()).filter(Boolean);
}

// === Action Parser ===

function parseAction(name, description) {
  const action = { name, description };
  const desc = cleanText(description);

  // Parse recharge from name (handles regular dash, en-dash, em-dash, double dash)
  const rechargeMatch = name.match(/\(Recharge\s+(\d+(?:[\-\u2013\u2014]{1,2}\d+)?)\)/i);
  if (rechargeMatch) {
    action.recharge = rechargeMatch[1].replace(/[\u2013\u2014-]+/g, '-');
    action.name = name.replace(/\s*\(Recharge\s+\d+(?:[\-\u2013\u2014]{1,2}\d+)?\)/i, '').trim();
  }

  // Parse "Recharge after a Short or Long Rest"
  const restRechargeMatch = name.match(/\(Recharge after a (?:Short or )?Long Rest\)/i);
  if (restRechargeMatch) {
    action.recharge = 'short rest';
    action.name = name.replace(/\s*\(Recharge after a (?:Short or )?Long Rest\)/i, '').trim();
  }

  // Parse per-day from name
  const perDayMatch = name.match(/\((\d+)\/Day\)/i);
  if (perDayMatch) {
    action.recharge = `${perDayMatch[1]}/day`;
    action.name = name.replace(/\s*\(\d+\/Day\)/i, '').trim();
  }

  // Parse attack type and toHit
  const meleeOrRangedMatch = desc.match(/\*Melee or Ranged Attack Roll:\*\s*\+(\d+)/);
  const meleeMatch = desc.match(/\*Melee Attack Roll:\*\s*\+(\d+)/);
  const rangedMatch = desc.match(/\*Ranged Attack Roll:\*\s*\+(\d+)/);

  if (meleeOrRangedMatch) {
    action.attackType = 'melee-or-ranged';
    action.toHit = parseInt(meleeOrRangedMatch[1], 10);
  } else if (meleeMatch) {
    action.attackType = 'melee';
    action.toHit = parseInt(meleeMatch[1], 10);
  } else if (rangedMatch) {
    action.attackType = 'ranged';
    action.toHit = parseInt(rangedMatch[1], 10);
  }

  // Parse reach
  const reachMatch = desc.match(/reach\s+(\d+)\s*ft\./i);
  if (reachMatch) action.reach = parseInt(reachMatch[1], 10);

  // Parse range
  const rangeMatch = desc.match(/range\s+(\d+)\/(\d+)\s*ft\./i);
  if (rangeMatch) {
    action.rangeNormal = parseInt(rangeMatch[1], 10);
    action.rangeLong = parseInt(rangeMatch[2], 10);
  } else {
    const rangeSimple = desc.match(/range\s+(\d+)\s*ft\./i);
    if (rangeSimple && !reachMatch) {
      action.rangeNormal = parseInt(rangeSimple[1], 10);
    }
  }

  // Parse damage from *Hit:* line
  const hitMatch = desc.match(/\*Hit:\*\s*(\d+)\s*(?:\(([^)]+)\))?\s*(\w[\w\s]*?)\s*damage/i);
  if (hitMatch) {
    if (hitMatch[2]) {
      action.damageDice = normalizeDashes(hitMatch[2].trim());
    } else {
      action.damageDice = hitMatch[1];
    }
    action.damageType = hitMatch[3].trim();
  }

  // Parse additional damage "plus N (dice) Type damage"
  const plusDmgMatch = desc.match(/plus\s+(\d+)\s*\(([^)]+)\)\s*(\w[\w\s]*?)\s*damage/i);
  if (plusDmgMatch) {
    action.additionalDamage = `${normalizeDashes(plusDmgMatch[2].trim())} ${plusDmgMatch[3].trim()}`;
  }

  // Parse saving throw
  const saveMatch = desc.match(/\*(\w+)\s+Saving Throw:\*\s*DC\s+(\d+)/);
  if (saveMatch) {
    action.saveAbility = saveMatch[1];
    action.saveDC = parseInt(saveMatch[2], 10);
  }

  // Parse area of effect
  const aoePatterns = [
    { regex: /(\d+)-foot[- ](?:long|tall),?\s*(\d+)-foot[- ]wide\s+Line/i, type: 'line' },
    { regex: /(\d+)-foot[- ]radius\s+Sphere/i, type: 'sphere' },
    { regex: /(\d+)-foot[- ](?:radius\s+)?Cylinder/i, type: 'cylinder' },
    { regex: /(\d+)-foot\s+Cone/i, type: 'cone' },
    { regex: /(\d+)-foot\s+Cube/i, type: 'cube' },
    { regex: /(\d+)-foot\s+Emanation/i, type: 'sphere' },
  ];

  for (const { regex, type } of aoePatterns) {
    const aoeMatch = desc.match(regex);
    if (aoeMatch) {
      action.areaOfEffect = { type, size: parseInt(aoeMatch[1], 10) };
      break;
    }
  }

  // Parse multiattack
  if (action.name === 'Multiattack') {
    action.multiattackActions = parseMultiattack(desc);
  }

  return action;
}

function parseMultiattack(desc) {
  // "makes two Tentacle attacks and uses Consume Memories"
  // "makes three attacks, using Shortsword or Light Crossbow in any combination"
  // "makes two Rend attacks"
  // "makes one Attach attack and two Tail attacks"
  // "makes two Pincer attacks and uses Paralyzing Tentacles"
  const actions = [];

  const countWords = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

  // Pattern: "makes N ActionName attacks"
  const attackPattern = /(?:makes?\s+)?(\w+)\s+([\w\s]+?)\s+attacks?/gi;
  let match;
  while ((match = attackPattern.exec(desc)) !== null) {
    const countStr = match[1].toLowerCase();
    const count = countWords[countStr] || parseInt(countStr, 10) || 1;
    const actionName = match[2].trim();
    if (actionName.toLowerCase() === 'the') continue;
    for (let i = 0; i < count; i++) {
      actions.push(actionName);
    }
  }

  // Pattern: "and uses ActionName"
  const usesPattern = /(?:and\s+)?uses?\s+(?:either\s+)?([\w\s]+?)(?:\s+if available|\s*\.|\s*$)/gi;
  while ((match = usesPattern.exec(desc)) !== null) {
    const actionName = match[1].trim();
    if (actionName.toLowerCase() !== 'spellcasting' &&
        !actions.includes(actionName) &&
        actionName.length < 40) {
      actions.push(actionName);
    }
  }

  return actions.length > 0 ? actions : undefined;
}

// === Spellcasting Parser ===

function parseSpellcasting(actionLines) {
  const result = {
    ability: 'Intelligence',
    saveDC: 10,
    attackBonus: 0,
    notes: undefined,
  };

  const fullText = actionLines.join('\n');
  const cleaned = cleanText(fullText);

  // Parse ability, DC, attack bonus
  const abilityMatch = cleaned.match(/using\s+(\w+)\s+as\s+the\s+spellcasting\s+ability/i);
  if (abilityMatch) result.ability = abilityMatch[1];

  const dcMatch = cleaned.match(/spell\s+save\s+DC\s+(\d+)/i);
  if (dcMatch) result.saveDC = parseInt(dcMatch[1], 10);

  const atkMatch = cleaned.match(/\+(\d+)\s+to\s+hit\s+with\s+spell\s+attacks/i);
  if (atkMatch) result.attackBonus = parseInt(atkMatch[1], 10);

  // Parse spell lists
  // **At Will:** *Spell*, *Spell*
  // **1/Day Each:** *Spell*, *Spell*
  // **2/Day Each:** *Spell*
  const atWillMatch = cleaned.match(/\*\*At Will:\*\*\s*(.+?)(?:\n\*\*|\n---|\n####|$)/is);
  if (atWillMatch) {
    result.atWill = extractSpellNames(atWillMatch[1]);
  }

  const perDayPattern = /\*\*(\d+)\/Day\s*(?:Each)?:\*\*\s*(.+?)(?:\n\*\*|\n---|\n####|$)/gis;
  let pdMatch;
  while ((pdMatch = perDayPattern.exec(cleaned)) !== null) {
    if (!result.perDay) result.perDay = {};
    result.perDay[pdMatch[1]] = extractSpellNames(pdMatch[2]);
  }

  return result;
}

function extractSpellNames(text) {
  // Extract spell names from italicized text: *Spell Name*, *Spell Name (level N version)*
  const spells = [];
  const pattern = /\*([^*]+)\*/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const spellName = match[1].trim();
    if (spellName && !spellName.startsWith('Hit:') && !spellName.includes('Attack Roll')) {
      spells.push(spellName);
    }
  }
  return spells;
}

// === Legendary Actions Parser ===

function parseLegendaryPreamble(text) {
  // *Legendary Action Uses: 3 (4 in Lair). ...
  const usesMatch = text.match(/Legendary Action Uses:\s*(\d+)/i);
  return usesMatch ? parseInt(usesMatch[1], 10) : 3;
}

// === Main Stat Block Parser ===

function parseStatBlock(lines, startIdx, name) {
  let i = startIdx;
  const totalLines = lines.length;

  // Parse type line
  if (i >= totalLines) return null;
  const typeLine = lines[i].trim();
  if (!typeLine.startsWith('*') || !typeLine.endsWith('*')) return null;
  const { size, type, subtype, alignment } = parseTypeLine(typeLine);
  i++;

  // Skip empty lines and quote blocks (some stat blocks have flavor quotes before AC)
  while (i < totalLines && (lines[i].trim() === '' || lines[i].trim().startsWith('>'))) i++;

  // Guard: next non-empty/non-quote line MUST be **AC** — otherwise this is lore, not a stat block
  if (i >= totalLines || !lines[i].includes('**AC**')) return null;

  // Parse AC/Initiative
  let ac = 10, acType, initiative;
  if (i < totalLines && lines[i].includes('**AC**')) {
    const acInit = parseAcInitLine(lines[i]);
    ac = acInit.ac;
    acType = acInit.acType;
    initiative = acInit.initiative;
    i++;
  }

  // Parse HP
  let hp = 0, hitDice = '';
  if (i < totalLines && lines[i].includes('**HP**')) {
    const hpData = parseHpLine(lines[i]);
    hp = hpData.hp;
    hitDice = hpData.hitDice;
    i++;
  }

  // Parse Speed
  let speed = { walk: 30 };
  if (i < totalLines && lines[i].includes('**Speed**')) {
    speed = parseSpeedLine(lines[i]);
    i++;
  }

  // Skip empty lines
  while (i < totalLines && lines[i].trim() === '') i++;

  // Parse ability score table (spans multiple lines)
  const abilityLines = [];
  while (i < totalLines && lines[i].trim().startsWith('|')) {
    abilityLines.push(lines[i]);
    i++;
  }
  const { abilityScores, savingThrows } = parseAbilityScores(abilityLines);

  // Skip empty lines
  while (i < totalLines && lines[i].trim() === '') i++;

  // Parse property lines (Skills, Resistances, Immunities, Gear, Senses, Languages, CR)
  let skills, resistances, vulnerabilities, damageImmunities, conditionImmunities;
  let senses = { passivePerception: 10 };
  let languages = [];
  let telepathy;
  let cr = '0', xp = 0, proficiencyBonus = 2;
  let gear;
  let habitat;

  while (i < totalLines) {
    const line = lines[i].trim();
    if (line === '' || line.startsWith('####') || line.startsWith('---') || line.startsWith('***')) break;

    if (line.startsWith('**Skills**')) {
      skills = parseSkills(line);
    } else if (line.startsWith('**Resistances**')) {
      resistances = parseResistances(line);
    } else if (line.startsWith('**Vulnerabilities**')) {
      vulnerabilities = parseVulnerabilities(line);
    } else if (line.startsWith('**Immunities**')) {
      const imm = parseImmunities(line);
      if (imm.damageImmunities.length > 0) damageImmunities = imm.damageImmunities;
      if (imm.conditionImmunities.length > 0) conditionImmunities = imm.conditionImmunities;
    } else if (line.startsWith('**Gear**')) {
      gear = parseGear(line);
    } else if (line.startsWith('**Senses**')) {
      senses = parseSenses(line);
    } else if (line.startsWith('**Languages**')) {
      const langData = parseLanguages(line);
      languages = langData.languages;
      telepathy = langData.telepathy;
    } else if (line.startsWith('**CR**')) {
      const crData = parseCR(line);
      cr = crData.cr;
      xp = crData.xp;
      proficiencyBonus = crData.proficiencyBonus;
    } else if (line.startsWith('**Habitat:**')) {
      const habMatch = line.match(/\*\*Habitat:\*\*\s*([^;*]+)/);
      if (habMatch) {
        habitat = habMatch[1].split(',').map(h => h.trim()).filter(Boolean);
      }
    }
    i++;
  }

  // Skip empty lines
  while (i < totalLines && lines[i].trim() === '') i++;

  // Parse sections: Traits, Actions, Bonus Actions, Reactions, Legendary Actions
  let traits = [];
  let actions = [];
  let bonusActions = [];
  let reactions = [];
  let legendaryActions;
  let spellcasting;

  let currentSection = null;

  while (i < totalLines) {
    const line = lines[i].trim();

    // End of stat block
    if (line === '---') break;
    // Next stat block or section header at level 2 or 3
    if (line.match(/^#{1,3}\s/) && !line.startsWith('####')) break;

    // Section headers
    if (line.startsWith('#### Traits')) {
      currentSection = 'traits';
      i++;
      continue;
    }
    if (line.startsWith('#### Actions')) {
      currentSection = 'actions';
      i++;
      continue;
    }
    if (line.startsWith('#### Bonus Actions')) {
      currentSection = 'bonusActions';
      i++;
      continue;
    }
    if (line.startsWith('#### Reactions')) {
      currentSection = 'reactions';
      i++;
      continue;
    }
    if (line.startsWith('#### Legendary Actions')) {
      currentSection = 'legendaryActions';
      i++;
      continue;
    }

    // Parse entries within sections
    if (line.startsWith('***') && line.includes('.***')) {
      // Action/trait entry: ***Name.*** Description
      // Or: ***Name (Recharge 5-6).*** Description
      const entryMatch = line.match(/^\*\*\*(.+?)\.\*\*\*\s*(.*)/);
      if (entryMatch) {
        let entryName = cleanText(entryMatch[1]);
        let entryDesc = cleanText(entryMatch[2]);

        // Collect multi-line descriptions
        i++;
        while (i < totalLines) {
          const nextLine = lines[i].trim();
          if (nextLine === '' || nextLine.startsWith('***') || nextLine.startsWith('####') ||
              nextLine === '---' || (nextLine.startsWith('**') && !nextLine.startsWith('***'))) {
            break;
          }
          entryDesc += '\n' + cleanText(nextLine);
          i++;
        }

        // Check if this is a spellcasting entry
        if (entryName.toLowerCase() === 'spellcasting' ||
            entryName.toLowerCase().startsWith('spellcasting')) {
          // Collect the spell list lines that follow
          const spellLines = [entryDesc];
          while (i < totalLines) {
            const nextLine = lines[i].trim();
            if (nextLine === '' && i + 1 < totalLines && lines[i + 1].trim().startsWith('**') &&
                !lines[i + 1].trim().startsWith('***') && !lines[i + 1].trim().startsWith('####')) {
              i++;
              continue;
            }
            if (nextLine.startsWith('**') && !nextLine.startsWith('***') && !nextLine.startsWith('####') &&
                (nextLine.includes('/Day') || nextLine.includes('At Will'))) {
              spellLines.push(cleanText(nextLine));
              i++;
              continue;
            }
            break;
          }
          spellcasting = parseSpellcasting(spellLines);
          // Also add as a trait/action for description
          const spellAction = { name: entryName, description: spellLines.join('\n') };
          if (currentSection === 'actions') actions.push(spellAction);
          else if (currentSection === 'traits') traits.push({ name: entryName, description: spellLines.join('\n') });
          continue;
        }

        // Parse as action or trait based on section
        if (currentSection === 'traits') {
          traits.push({ name: entryName, description: entryDesc });
        } else if (currentSection === 'actions') {
          actions.push(parseAction(entryName, entryDesc));
        } else if (currentSection === 'bonusActions') {
          bonusActions.push(parseAction(entryName, entryDesc));
        } else if (currentSection === 'reactions') {
          actions.push(parseAction(entryName, entryDesc)); // Reactions stored here temporarily
          // Actually let's store them in the right place
          actions.pop();
          reactions.push(parseAction(entryName, entryDesc));
        } else if (currentSection === 'legendaryActions') {
          if (!legendaryActions) legendaryActions = { uses: 3, actions: [] };
          legendaryActions.actions.push(parseAction(entryName, entryDesc));
        }
        continue;
      }
    }

    // Legendary action preamble (italicized text)
    if (currentSection === 'legendaryActions' && line.startsWith('*') && line.includes('Legendary Action Uses')) {
      const uses = parseLegendaryPreamble(line);
      if (!legendaryActions) legendaryActions = { uses, actions: [] };
      else legendaryActions.uses = uses;
      i++;
      continue;
    }

    i++;
  }

  // Build the stat block
  const id = toKebabCase(name);
  const tokenSize = SIZE_TO_TOKEN[size] || { x: 1, y: 1 };

  const statBlock = {
    id,
    name,
    size,
    type,
    alignment,
    ac,
    hp,
    hitDice,
    speed,
    abilityScores,
    senses,
    languages,
    cr,
    xp,
    proficiencyBonus,
    actions: actions.length > 0 ? actions : [{ name: 'None', description: 'No actions.' }],
    source: 'mm2025',
    tokenSize,
  };

  // Optional fields
  if (subtype) statBlock.subtype = subtype;
  if (acType) statBlock.acType = acType;
  if (initiative) statBlock.initiative = initiative;
  if (Object.keys(savingThrows).length > 0) statBlock.savingThrows = savingThrows;
  if (skills && Object.keys(skills).length > 0) statBlock.skills = skills;
  if (resistances && resistances.length > 0) statBlock.resistances = resistances;
  if (vulnerabilities && vulnerabilities.length > 0) statBlock.vulnerabilities = vulnerabilities;
  if (damageImmunities && damageImmunities.length > 0) statBlock.damageImmunities = damageImmunities;
  if (conditionImmunities && conditionImmunities.length > 0) statBlock.conditionImmunities = conditionImmunities;
  if (telepathy) statBlock.telepathy = telepathy;
  if (gear && gear.length > 0) statBlock.gear = gear;
  if (habitat && habitat.length > 0) statBlock.habitat = habitat;
  if (traits.length > 0) statBlock.traits = traits;
  if (bonusActions.length > 0) statBlock.bonusActions = bonusActions;
  if (reactions.length > 0) statBlock.reactions = reactions;
  if (legendaryActions && legendaryActions.actions.length > 0) statBlock.legendaryActions = legendaryActions;
  if (spellcasting) statBlock.spellcasting = spellcasting;

  return { statBlock, endIndex: i };
}

// === File Parser ===

function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const statBlocks = [];
  let i = 0;

  // Track habitat from ## sections (lore before stat blocks)
  let currentHabitat = null;
  let currentLairActions = null;
  let currentRegionalEffects = null;
  let currentGroupName = null;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Track ## sections for group name and habitat
    if (line.startsWith('## ') && !line.startsWith('## CR ')) {
      currentGroupName = line.replace(/^##\s+/, '').trim();
      currentHabitat = null;
      currentLairActions = null;
      currentRegionalEffects = null;

      // Look for habitat in following lines
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('**Habitat:**')) {
          const habMatch = nextLine.match(/\*\*Habitat:\*\*\s*([^;*]+)/);
          if (habMatch) {
            currentHabitat = habMatch[1].split(',').map(h => h.trim()).filter(Boolean);
          }
          break;
        }
      }

      // Look for lair actions and regional effects in the lore section
      const lairResult = parseLairAndRegionalEffects(lines, i);
      if (lairResult.lairActions) currentLairActions = lairResult.lairActions;
      if (lairResult.regionalEffects) currentRegionalEffects = lairResult.regionalEffects;
    }

    // Detect stat block start: ### heading followed by type line
    if (line.startsWith('### ') && !line.startsWith('#### ')) {
      const name = line.replace(/^###\s+/, '').trim();

      // Skip non-stat-block headings (tables, lairs, etc.)
      // A stat block has a type line (starting with *) on the next non-empty line
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;

      if (j < lines.length) {
        const nextLine = lines[j].trim();
        // Type line starts with * and contains a valid size or "Swarm"
        if (nextLine.startsWith('*') && nextLine.endsWith('*') &&
            (VALID_SIZES.some(s => nextLine.includes(s)) || nextLine.includes('Swarm'))) {

          const result = parseStatBlock(lines, j, name);
          if (result && result.statBlock) {
            // Apply habitat from parent ## section if not already set
            if (!result.statBlock.habitat && currentHabitat) {
              result.statBlock.habitat = currentHabitat;
            }

            // Apply group from parent ## section
            if (currentGroupName && currentGroupName !== name) {
              // Only set group if the section has multiple monsters
              result.statBlock.group = currentGroupName;
            }

            // Apply lair actions and regional effects to the right monsters
            // (typically adult+ dragons and other lair monsters)
            if (currentLairActions && shouldHaveLairActions(name)) {
              result.statBlock.lairActions = currentLairActions;
            }
            if (currentRegionalEffects && shouldHaveLairActions(name)) {
              result.statBlock.regionalEffects = currentRegionalEffects;
            }

            statBlocks.push(result.statBlock);
            i = result.endIndex;
            continue;
          }
        }
      }
    }

    i++;
  }

  return statBlocks;
}

function shouldHaveLairActions(name) {
  // Adult and Ancient dragons, Aboleth, Kraken, Lich, Mummy Lord, etc.
  return name.startsWith('Adult ') ||
         name.startsWith('Ancient ') ||
         ['Aboleth', 'Kraken', 'Lich', 'Mummy Lord', 'Death Tyrant', 'Beholder'].includes(name);
}

function parseLairAndRegionalEffects(lines, sectionStart) {
  const result = { lairActions: null, regionalEffects: null };

  // Scan forward from the ## section to find lair/regional text before the first stat block
  let i = sectionStart + 1;
  let inLairSection = false;
  let lairEffects = [];
  let regionalEffects = [];
  let inRegional = false;
  let endCondition = null;

  while (i < lines.length) {
    const line = lines[i].trim();

    // Stop at next ## or stat block (### followed by type line)
    if (line.startsWith('## ') && i > sectionStart) break;
    if (line === '---' && i > sectionStart + 2) {
      // Check if next non-empty line is a stat block
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && lines[j].trim().startsWith('### ')) break;
    }

    // Detect lair section headers
    if (line.includes('Lair') && (line.startsWith('###') || line.startsWith('**'))) {
      inLairSection = true;
      inRegional = false;
    }

    // Detect regional effects
    if (line.includes('region') && line.includes('warped') || line.includes('creating the following effects')) {
      inRegional = true;
    }

    // Detect "If the dragon dies..." end condition
    if (line.startsWith('If the') && (line.includes('dies') || line.includes('moves its lair'))) {
      endCondition = cleanText(line);
      inRegional = false;
      inLairSection = false;
    }

    // Collect regional effects (marked with ** or ***)
    if (inRegional && (line.startsWith('**') || line.startsWith('***')) && !line.startsWith('####')) {
      const effectMatch = line.match(/^\*{2,3}([\w\s]+?)[\.\*]+\*{0,3}\s*(.*)/);
      if (effectMatch) {
        let desc = cleanText(effectMatch[2]);
        // Collect continuation lines
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== '' &&
               !lines[j].trim().startsWith('**') && !lines[j].trim().startsWith('***') &&
               !lines[j].trim().startsWith('If the') && !lines[j].trim().startsWith('---')) {
          desc += ' ' + cleanText(lines[j]);
          j++;
        }
        regionalEffects.push({ name: effectMatch[1].trim(), description: desc });
      }
    }

    i++;
  }

  if (regionalEffects.length > 0) {
    result.regionalEffects = {
      effects: regionalEffects,
      endCondition: endCondition || undefined
    };
  }

  return result;
}

// === Main Execution ===

function main() {
  const baseDir = path.join(__dirname, '..', '5.5e References', 'MM2025', 'Markdown');
  const bestiaryDir = path.join(baseDir, 'Bestiary');
  const appendixDir = path.join(baseDir, 'Appendices');

  const allStatBlocks = [];
  const fileStats = {};

  // Process Bestiary files
  const bestiaryFiles = fs.readdirSync(bestiaryDir)
    .filter(f => f.endsWith('.md') && f !== 'Introduction.md')
    .sort();

  for (const file of bestiaryFiles) {
    const filePath = path.join(bestiaryDir, file);
    console.log(`Parsing ${file}...`);
    const blocks = parseMarkdownFile(filePath);
    fileStats[file] = blocks.length;
    allStatBlocks.push(...blocks);
    console.log(`  Found ${blocks.length} stat blocks`);
  }

  // Process Appendix (Animals)
  const animalsFile = path.join(appendixDir, 'Animals.md');
  if (fs.existsSync(animalsFile)) {
    console.log('Parsing Animals.md...');
    const blocks = parseMarkdownFile(animalsFile);
    fileStats['Animals.md'] = blocks.length;
    allStatBlocks.push(...blocks);
    console.log(`  Found ${blocks.length} stat blocks`);
  }

  // Check for duplicate IDs
  const idMap = new Map();
  const duplicates = [];
  for (const block of allStatBlocks) {
    if (idMap.has(block.id)) {
      duplicates.push({ id: block.id, name1: idMap.get(block.id).name, name2: block.name });
      // Disambiguate by appending CR
      block.id = `${block.id}-cr-${block.cr.replace('/', '-')}`;
    }
    idMap.set(block.id, block);
  }

  if (duplicates.length > 0) {
    console.log(`\nWARNING: ${duplicates.length} duplicate IDs found and disambiguated:`);
    for (const d of duplicates) {
      console.log(`  ${d.id}: "${d.name1}" vs "${d.name2}"`);
    }
  }

  // Output
  const outputPath = path.join(__dirname, 'mm2025-parsed.json');
  fs.writeFileSync(outputPath, JSON.stringify(allStatBlocks, null, 2));

  console.log(`\n=== PARSE SUMMARY ===`);
  console.log(`Total stat blocks parsed: ${allStatBlocks.length}`);
  console.log(`Output: ${outputPath}`);
  console.log('\nBy file:');
  for (const [file, count] of Object.entries(fileStats)) {
    console.log(`  ${file}: ${count}`);
  }

  // Quick validation stats
  const withActions = allStatBlocks.filter(b => b.actions.length > 0);
  const withTraits = allStatBlocks.filter(b => b.traits && b.traits.length > 0);
  const withLegendary = allStatBlocks.filter(b => b.legendaryActions);
  const withSpellcasting = allStatBlocks.filter(b => b.spellcasting);
  const withInitiative = allStatBlocks.filter(b => b.initiative);
  const withSaves = allStatBlocks.filter(b => b.savingThrows && Object.keys(b.savingThrows).length > 0);

  console.log('\nField coverage:');
  console.log(`  Actions: ${withActions.length}/${allStatBlocks.length}`);
  console.log(`  Traits: ${withTraits.length}/${allStatBlocks.length}`);
  console.log(`  Legendary: ${withLegendary.length}/${allStatBlocks.length}`);
  console.log(`  Spellcasting: ${withSpellcasting.length}/${allStatBlocks.length}`);
  console.log(`  Initiative: ${withInitiative.length}/${allStatBlocks.length}`);
  console.log(`  Saving throws: ${withSaves.length}/${allStatBlocks.length}`);
}

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = {
    parseTypeLine,
    parseAcInitLine,
    parseHpLine,
    parseSpeedLine,
    parseAbilityScores,
    parseSkills,
    parseResistances,
    parseVulnerabilities,
    parseImmunities,
    parseSenses,
    parseLanguages,
    parseCR,
    parseAction,
    parseMultiattack,
    parseSpellcasting,
    parseStatBlock,
    parseMarkdownFile,
    toKebabCase,
    CR_TO_XP,
    CR_TO_PB,
  };
}

if (require.main === module) {
  main();
}
