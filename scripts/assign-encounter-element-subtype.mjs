/**
 * Adds mEncounterElement and mEncounterSubtype to every encounter.
 * Element: inferred from title, image key, and description text.
 * Subtype: dominant solution-type theme used in encounter slots.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLOTS = ['A', 'B', 'C', 'D'];

const encounterPaths = [
  join(root, 'server/game/encountersdata.json'),
  join(root, 'client/src/data/game/encountersdata.json'),
  join(root, 'client/public/game/encountersdata.json'),
];

const solutions = JSON.parse(
  readFileSync(join(root, 'server/game/solutiondata.json'), 'utf8'),
);
const solutionById = new Map(
  Object.values(solutions).map((entry) => [entry.mSolutionID, entry]),
);

const SOLUTION_TYPE_SUBTYPE = {
  1: 'Learn',
  2: 'Learn',
  3: 'Trade',
  4: 'Trade',
  5: 'Find',
  6: 'Find',
  7: 'OpenLock',
  8: 'OpenLock',
  9: 'Combat',
  10: 'Combat',
  13: 'Climb',
  14: 'Climb',
  15: 'Treasure',
  16: 'Life',
  17: 'Speech',
  18: 'Speech',
  20: 'Travel',
  21: 'Heal',
  22: 'Heal',
  25: 'Protect',
  26: 'Protect',
  27: 'Purge',
  28: 'Purge',
  29: 'Hunt',
  30: 'Hunt',
  32: 'RareFind',
  33: 'Nurture',
  34: 'Nurture',
  35: 'Stealth',
  36: 'Stealth',
  37: 'Warmth',
  38: 'Warmth',
  39: 'Inspiration',
  40: 'Inspiration',
  76: 'Resurrection',
  77: 'Resurrection',
};

const CATEGORY_FALLBACK_SUBTYPE = {
  1: 'Combat',
  2: 'Find',
  3: 'Heal',
  4: 'Learn',
  5: 'Trade',
};

/** Manual overrides where keyword scoring is unreliable. */
const SUBTYPE_OVERRIDES = {
  2: 'Learn',
};

const ELEMENT_OVERRIDES = {
  1: 'Void',
  2: 'Core',
  19001: 'Water',
  19444: 'Fire',
  20006: 'Air',
  20007: 'Air',
  20008: 'Earth',
  20009: 'Earth',
  20010: 'Nature',
  20011: 'Arcana',
  20012: 'Core',
  20031: 'Core',
  20032: 'Nature',
  20181: 'Spirit',
};

const ELEMENT_KEYWORDS = {
  Core: [
    'pantheon', 'temple', 'market', 'merchant', 'trade', 'agreement', 'level up',
    'archive', 'neutral', 'sanctuary of the gods', 'divine architecture',
  ],
  Fire: [
    'fire', 'flame', 'ember', 'inferno', 'burn', 'burning', 'magma', 'volcanic',
    'heat', 'blaze', 'scorch', 'torch', 'furnace', 'cauteriz', 'wildfire', 'pyre',
    'smolder', 'char', 'ignit', 'molten', 'lava', 'bonfire', 'hearth', 'crackle',
  ],
  Water: [
    'water', 'rain', 'river', 'ocean', 'sea', 'tide', 'flood', 'spring', 'lake',
    'aqua', 'dew', 'torrent', 'ripple', 'stream', 'brook', 'frost', 'ice', 'snow',
    'winter', 'frozen', 'glacial', 'permafrost', 'weeping', 'mire', 'bog', 'swamp',
    'drown', 'nereval', 'fluid', 'healing waters', 'drip',
  ],
  Earth: [
    'stone', 'earth', 'rock', 'mountain', 'cave', 'crystal', 'soil', 'granite',
    'clay', 'mineral', 'ore', 'tunnel', 'underground', 'gnarled', 'root', 'mud',
    'cavern', 'cliff', 'ridge', 'grit', 'dust', 'burrow', 'quarry', 'bedrock',
    'crumblegheist', 'grimnir', 'rokur', 'iron', 'steel', 'metal', 'forge',
  ],
  Air: [
    'wind', 'sky', 'storm', 'thunder', 'cloud', 'aerial', 'tempest', 'gale',
    'breeze', 'wing', 'flight', 'lightning', 'hurricane', 'aevis', 'floating',
    'soar', 'gust', 'cyclone', 'vortex', 'whirlwind', 'zephyr', 'skyr', 'echo',
  ],
  Force: [
    'force', 'pressure', 'shockwave', 'collision', 'impact', 'kinetic', 'surge',
    'eruption', 'steam', 'boiling', 'chaotic clash',
  ],
  Arcana: [
    'arcane', 'magic', 'enchant', 'spell', 'mystic', 'rune', 'sorcery', 'wizard',
    'occult', 'ethereal glow', 'magical barrier', 'incant', 'ley line', 'aether',
    'aetherion', 'arcana', 'mystical', 'supernatural',
  ],
  Metal: [
    'armor', 'armour', 'blade', 'sword', 'axe', 'mace', 'hammer', 'shield',
    'anvil', 'smith', 'forged', 'metallic', 'iron', 'steel', 'bronze', 'copper',
    'chainmail', 'weapon', 'spiked steel',
  ],
  Spirit: [
    'spirit', 'soul', 'ghost', 'wraith', 'specter', 'spectre', 'phantom',
    'ethereal', 'haunt', 'afterlife', 'whispering voices', 'hollow choir',
    'revenant', 'echoes', 'apparition', 'undead', 'spectral',
  ],
  Nature: [
    'forest', 'meadow', 'glade', 'pasture', 'tree', 'flora', 'garden', 'grove',
    'verdant', 'canopy', 'leaf', 'bloom', 'fern', 'moss', 'wildflower', 'fae',
    'blackwood', 'cursed forest', 'keldor', 'entwined', 'roots', 'woodland',
    'grassy', 'pastoral', 'herb', 'vine', 'thicket', 'sanctuary of the forest',
  ],
  Void: [
    'void', 'curse', 'cursed', 'shadow', 'abyss', 'dark magic', 'necro', 'blight',
    'corrupt', 'malevol', 'doom', 'hollow', 'emptiness', 'forgotten', 'nightmare',
    'unspeakable', 'oblivion', 'entropy', 'gloom', 'dread', 'ominous', 'atrophy',
  ],
};

const ELEMENT_PRIORITY = [
  'Core',
  'Force',
  'Arcana',
  'Metal',
  'Spirit',
  'Nature',
  'Void',
  'Fire',
  'Water',
  'Earth',
  'Air',
];

function encounterCorpus(encounter) {
  return [
    encounter.mEncounterTitle,
    encounter.mEncounterImageName,
    encounter.mEncounterText,
  ].join(' ').toLowerCase();
}

function scoreElement(corpus, element) {
  const keywords = ELEMENT_KEYWORDS[element] ?? [];
  let score = 0;

  for (const keyword of keywords) {
    if (corpus.includes(keyword)) {
      score += keyword.length >= 8 ? 3 : keyword.includes(' ') ? 4 : 2;
    }
  }

  return score;
}

function inferElement(encounter) {
  if (ELEMENT_OVERRIDES[encounter.mEncounterID]) {
    return ELEMENT_OVERRIDES[encounter.mEncounterID];
  }

  const corpus = encounterCorpus(encounter);
  const scores = Object.fromEntries(
    ELEMENT_PRIORITY.map((element) => [element, scoreElement(corpus, element)]),
  );

  const ranked = [...ELEMENT_PRIORITY]
    .map((element) => ({ element, score: scores[element] }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score <= 0) {
    return 'Core';
  }

  const compositeBases = {
    Force: ['Fire', 'Water'],
    Arcana: ['Fire', 'Air'],
    Metal: ['Fire', 'Earth'],
    Spirit: ['Water', 'Air'],
    Nature: ['Water', 'Earth'],
    Void: ['Earth', 'Air'],
  };

  for (const composite of ['Force', 'Arcana', 'Metal', 'Spirit', 'Nature', 'Void']) {
    const [baseA, baseB] = compositeBases[composite];
    const compositeScore = scores[composite] ?? 0;
    const baseScore = (scores[baseA] ?? 0) + (scores[baseB] ?? 0);

    if (compositeScore >= 3 && baseScore >= 6) {
      return composite;
    }
  }

  if (best.score >= 4 && second && second.score >= 4 && best.score - second.score <= 2) {
    for (const composite of ['Nature', 'Spirit', 'Void', 'Arcana', 'Metal', 'Force']) {
      const [baseA, baseB] = compositeBases[composite];
      if (
        (best.element === baseA && second.element === baseB)
        || (best.element === baseB && second.element === baseA)
      ) {
        return composite;
      }
    }
  }

  return best.element;
}

function inferSubtype(encounter) {
  if (SUBTYPE_OVERRIDES[encounter.mEncounterID]) {
    return SUBTYPE_OVERRIDES[encounter.mEncounterID];
  }

  const weights = new Map();

  for (const slot of SLOTS) {
    const primaryId = encounter[`mEncounterSolutiuon${slot}`];
    const typeId = encounter[`mEncounterSolutiuonType${slot}`];

    if (primaryId) {
      const solution = solutionById.get(primaryId);
      if (solution) {
        const subtype = SOLUTION_TYPE_SUBTYPE[solution.mSolutionType];
        if (subtype) {
          weights.set(subtype, (weights.get(subtype) ?? 0) + 2);
        }
      }
    }

    if (typeId) {
      const subtype = SOLUTION_TYPE_SUBTYPE[typeId];
      if (subtype) {
        weights.set(subtype, (weights.get(subtype) ?? 0) + 1);
      }
    }
  }

  if (weights.size === 0) {
    return CATEGORY_FALLBACK_SUBTYPE[encounter.mEncounterType] ?? 'Find';
  }

  const combatPriority = ['Hunt', 'Purge', 'Stealth', 'Combat'];
  const ranked = [...weights.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    const leftPriority = combatPriority.indexOf(left[0]);
    const rightPriority = combatPriority.indexOf(right[0]);
    const leftRank = leftPriority === -1 ? 99 : leftPriority;
    const rightRank = rightPriority === -1 ? 99 : rightPriority;
    return leftRank - rightRank;
  });

  return ranked[0][0];
}

const encounters = JSON.parse(readFileSync(encounterPaths[0], 'utf8'));
const elementCounts = new Map();
const subtypeCounts = new Map();

for (const encounter of Object.values(encounters)) {
  const element = inferElement(encounter);
  const subtype = inferSubtype(encounter);

  encounter.mEncounterElement = element;
  encounter.mEncounterSubtype = subtype;

  elementCounts.set(element, (elementCounts.get(element) ?? 0) + 1);
  subtypeCounts.set(subtype, (subtypeCounts.get(subtype) ?? 0) + 1);
}

const serialized = `${JSON.stringify(encounters, null, 2)}\n`;
for (const filePath of encounterPaths) {
  writeFileSync(filePath, serialized, 'utf8');
}

console.log('[morkahja] Assigned mEncounterElement and mEncounterSubtype.');
console.log('Elements:', Object.fromEntries([...elementCounts.entries()].sort((a, b) => b[1] - a[1])));
console.log('Subtypes:', Object.fromEntries([...subtypeCounts.entries()].sort((a, b) => b[1] - a[1])));
