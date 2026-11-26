/**
 * The world map of Morkahja (Babuni's direction, 2026-11-17).
 *
 * Placement follows Babuni's notes and the directions in the MorkahjaWorld
 * archive (`Places/`, `Races/`, `Places/Unplaced_Lands.md`); where neither
 * gives a direction, a site sits inside its region without a claim about where.
 * Coordinates are map units: x grows to the east, y to the south. North is up.
 *
 * Drawing rules: straight lines only, no curves and no right angles; triangles
 * are the only symbols.
 */

export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 1160;

export type Point = readonly [number, number];

/** How a symbol field is drawn: each kind is built from triangles only. */
export type Terrain =
  | 'meadow'
  | 'forest'
  | 'cursed-forest'
  | 'mountain'
  | 'snow-mountain'
  | 'volcano'
  | 'tundra'
  | 'desert'
  | 'swamp'
  | 'skyland'
  | 'underground';

/** Border styles, after the frame's lines: a full line with a broken one, three lines, thin or broad. */
export type BorderStyle = 'realm' | 'land' | 'wild' | 'hidden';

export interface MapRegion {
  id: string;
  name: string;
  /** A second, smaller line under the name. */
  subtitle?: string;
  outline: readonly Point[];
  label: Point;
  border: BorderStyle;
  terrain: Terrain;
  /** How many symbols to scatter inside the outline. */
  density: number;
}

export type SiteKind = 'capital' | 'city' | 'temple' | 'ruin' | 'site' | 'oasis' | 'peak' | 'hollow';

export interface MapSite {
  id: string;
  name: string;
  at: Point;
  kind: SiteKind;
  /** Where the name sits relative to the symbol. */
  labelSide?: 'above' | 'below' | 'left' | 'right';
}

export interface MapPath {
  id: string;
  points: readonly Point[];
  kind: 'road' | 'stream' | 'pass';
}

export const MAP_REGIONS: readonly MapRegion[] = [
  {
    id: 'everwinter',
    name: 'Everwinter Valley',
    outline: [[372, 92], [468, 56], [600, 70], [682, 128], [662, 214], [578, 262], [446, 256], [378, 204], [352, 146]],
    label: [512, 150],
    border: 'land',
    terrain: 'snow-mountain',
    density: 10,
  },
  {
    id: 'shattered-peaks',
    name: 'Shattered Peaks',
    outline: [[206, 64], [326, 44], [350, 110], [300, 168], [212, 160], [178, 108]],
    label: [262, 108],
    border: 'wild',
    terrain: 'mountain',
    density: 7,
  },
  {
    id: 'fyrskar',
    name: 'Fyrskar Mountains',
    subtitle: 'Rokur homeland',
    outline: [[70, 196], [196, 172], [296, 196], [318, 276], [262, 330], [150, 338], [80, 300], [52, 246]],
    label: [186, 254],
    border: 'realm',
    terrain: 'volcano',
    density: 11,
  },
  {
    id: 'frostwind',
    name: 'Frostwind Mountains',
    outline: [[400, 258], [588, 268], [626, 322], [596, 404], [520, 430], [432, 414], [384, 352]],
    label: [508, 334],
    border: 'wild',
    terrain: 'snow-mountain',
    density: 12,
  },
  {
    id: 'emberfrost',
    name: 'Emberfrost',
    outline: [[736, 172], [866, 150], [946, 214], [930, 306], [836, 336], [750, 300], [716, 236]],
    label: [830, 246],
    border: 'land',
    terrain: 'volcano',
    density: 8,
  },
  {
    id: 'keldor',
    name: 'The Cursed Forest of Keldor',
    outline: [[78, 370], [196, 348], [312, 384], [346, 452], [316, 532], [212, 556], [104, 528], [56, 452]],
    label: [204, 418],
    border: 'realm',
    terrain: 'cursed-forest',
    density: 26,
  },
  {
    id: 'rocky-tundra',
    name: 'Rocky Tundra',
    outline: [[60, 572], [186, 576], [296, 600], [314, 668], [258, 726], [140, 734], [62, 690], [40, 628]],
    label: [178, 652],
    border: 'wild',
    terrain: 'tundra',
    density: 12,
  },
  {
    id: 'vale',
    name: "Ethera's Vale",
    outline: [[380, 446], [520, 440], [654, 470], [704, 548], [690, 640], [612, 708], [470, 716], [372, 680], [334, 600], [346, 514]],
    label: [432, 486],
    border: 'realm',
    terrain: 'meadow',
    density: 30,
  },
  {
    id: 'karrhu',
    name: 'Swamp of Karrhu',
    outline: [[742, 432], [872, 404], [956, 470], [960, 590], [892, 658], [778, 652], [732, 572], [722, 492]],
    label: [846, 500],
    border: 'land',
    terrain: 'swamp',
    density: 20,
  },
  {
    id: 'eldertree',
    name: 'Eldertree Forest',
    outline: [[396, 734], [524, 726], [636, 748], [664, 810], [612, 864], [488, 878], [392, 846], [360, 786]],
    label: [512, 840],
    border: 'land',
    terrain: 'forest',
    density: 26,
  },
  {
    id: 'southwest-mountains',
    name: 'Celesterra',
    subtitle: 'Aevis homeland',
    outline: [[70, 770], [204, 752], [320, 790], [340, 878], [292, 958], [168, 982], [74, 940], [40, 856]],
    label: [190, 930],
    border: 'realm',
    terrain: 'mountain',
    density: 14,
  },
  {
    id: 'ohgar',
    name: 'Desert of Ohgar',
    outline: [[372, 900], [520, 892], [640, 914], [664, 990], [598, 1046], [470, 1052], [372, 1014], [344, 952]],
    label: [508, 948],
    border: 'wild',
    terrain: 'desert',
    density: 18,
  },
  {
    id: 'evergrove',
    name: 'Evergrove',
    subtitle: 'Verdani heartland',
    outline: [[704, 860], [836, 836], [946, 884], [960, 990], [900, 1070], [772, 1080], [694, 1020], [676, 934]],
    label: [822, 912],
    border: 'realm',
    terrain: 'desert',
    density: 16,
  },
];

/** Grimnir Skylands drift above Celesterra and the northern ranges (Races/Grimnir.md). */
export const SKYLAND_FIELDS: readonly { at: Point; count: number; spread: number }[] = [
  { at: [196, 820], count: 5, spread: 70 },
  { at: [420, 120], count: 3, spread: 50 },
];

export const MAP_SITES: readonly MapSite[] = [
  { id: 'aetherion', name: 'Aetherion', at: [520, 572], kind: 'capital', labelSide: 'below' },
  { id: 'eldridia', name: 'Eldridia', at: [474, 652], kind: 'city', labelSide: 'right' },
  { id: 'pantheon-temple', name: 'Pantheon Temple', at: [468, 700], kind: 'temple', labelSide: 'left' },
  { id: 'lovely-meadows', name: 'Lovely Meadows', at: [392, 530], kind: 'site', labelSide: 'below' },
  { id: 'arcane-meadows', name: 'Arcane Meadows', at: [626, 506], kind: 'site', labelSide: 'below' },
  { id: 'hearthguard', name: 'Hearthguard Sanctuary', at: [520, 470], kind: 'temple', labelSide: 'below' },
  { id: 'nereval', name: "Nereval's Sanctuary", at: [608, 620], kind: 'temple', labelSide: 'below' },
  { id: 'trading-post', name: 'Everwinter Trading Post', at: [512, 236], kind: 'city', labelSide: 'below' },
  { id: 'nekalos', name: 'Ruins of Nekalos', at: [598, 102], kind: 'ruin', labelSide: 'below' },
  { id: 'skyreach', name: 'Skyreach Peak', at: [446, 372], kind: 'peak', labelSide: 'right' },
  { id: 'deepstone', name: 'Deepstone Hollow', at: [632, 236], kind: 'hollow', labelSide: 'right' },
  { id: 'blackwood', name: 'Blackwood Abyss', at: [202, 476], kind: 'hollow', labelSide: 'below' },
  { id: 'darkwood', name: 'Darkwood Thicket', at: [98, 448], kind: 'site', labelSide: 'below' },
  { id: 'verdanis-vigil', name: "Verdani's Vigil", at: [328, 500], kind: 'temple', labelSide: 'below' },
  { id: 'rokur-citadels', name: 'Rokur Citadels', at: [146, 296], kind: 'city', labelSide: 'below' },
  { id: 'emerald-realm', name: 'Emerald Realm of the Liani', at: [500, 784], kind: 'site', labelSide: 'below' },
  { id: 'celesterra-city', name: 'Celesterra', at: [200, 870], kind: 'hollow', labelSide: 'below' },
  { id: 'grimnir-skylands', name: 'Grimnir Skylands', at: [138, 786], kind: 'site', labelSide: 'below' },
  { id: 'stormrift', name: 'Stormrift', at: [92, 1034], kind: 'site', labelSide: 'below' },
  { id: 'rocks-of-ohgar', name: 'Rocks of Ohgar', at: [440, 990], kind: 'peak', labelSide: 'below' },
  { id: 'sunstone-oasis', name: 'Sunstone Oasis', at: [506, 1108], kind: 'oasis', labelSide: 'below' },
  { id: 'rotwood', name: 'Rotwood', at: [674, 878], kind: 'site', labelSide: 'right' },
  { id: 'embermire', name: 'Embermire', at: [890, 378], kind: 'site', labelSide: 'below' },
  { id: 'verdani-oases', name: 'Oasis-gardens', at: [858, 990], kind: 'oasis', labelSide: 'below' },
];

/** Trade roads leave Aetherion toward every land (Etheras_Vale.md); streams converge on it. */
export const MAP_PATHS: readonly MapPath[] = [
  { id: 'road-north', kind: 'road', points: [[520, 572], [500, 500], [512, 430], [496, 360], [512, 236]] },
  { id: 'road-west', kind: 'road', points: [[520, 572], [430, 530], [346, 500], [280, 460]] },
  { id: 'road-east', kind: 'road', points: [[520, 572], [620, 560], [728, 540], [810, 520]] },
  { id: 'road-south', kind: 'road', points: [[520, 572], [474, 652], [468, 700], [440, 760], [470, 900], [500, 1000], [506, 1108]] },
  { id: 'road-southeast', kind: 'road', points: [[520, 572], [626, 650], [700, 760], [780, 860], [858, 990]] },
  { id: 'road-southwest', kind: 'road', points: [[520, 572], [400, 660], [310, 740], [220, 820], [200, 870]] },
  { id: 'road-northeast', kind: 'road', points: [[520, 572], [600, 500], [690, 400], [790, 300]] },
  { id: 'pass-fyrskar', kind: 'pass', points: [[400, 330], [330, 300], [262, 290], [146, 296]] },
  { id: 'stream-west', kind: 'stream', points: [[352, 470], [410, 520], [470, 548], [520, 572]] },
  { id: 'stream-north', kind: 'stream', points: [[596, 404], [570, 470], [548, 530], [520, 572]] },
  { id: 'stream-east', kind: 'stream', points: [[732, 560], [660, 590], [590, 586], [520, 572]] },
  { id: 'stream-south', kind: 'stream', points: [[520, 572], [560, 640], [548, 700], [584, 760], [560, 820]] },
];

/** Where the game's lands are: expansion id → region and the point the map opens on. */
export const EXPANSION_FOCUS: Readonly<Record<number, { regionId: string; at: Point }>> = {
  0: { regionId: 'vale', at: [414, 604] },
  1001: { regionId: 'keldor', at: [204, 452] },
  1003: { regionId: 'everwinter', at: [512, 160] },
  1004: { regionId: 'aetherion', at: [520, 572] },
  // Regional expansions (D-063): the middle of their encounters' places.
  1005: { regionId: 'eldertree', at: [512, 798] },
  1006: { regionId: 'frostwind', at: [503, 337] },
  1007: { regionId: 'evergrove', at: [810, 967] },
  1008: { regionId: 'emberfrost', at: [835, 247] },
  1009: { regionId: 'southwest-mountains', at: [230, 856] },
  1010: { regionId: 'fyrskar', at: [174, 258] },
  1011: { regionId: 'shattered-peaks', at: [268, 117] },
  1012: { regionId: 'ohgar', at: [492, 999] },
  1013: { regionId: 'karrhu', at: [834, 572] },
  1014: { regionId: 'rocky-tundra', at: [191, 655] },
};

/**
 * Travel (D-056): where a tap on the map leads. A region is its expansion, so
 * Keldor and Everwinter Valley are their expansions and Aetherion (a city in
 * the Vale) is its own. Since D-063 (2026-11-26) the base game is Ethera's Vale
 * alone: every other land is a regional expansion, closed while its catalog
 * entry is inactive, so it never leads into the base game's encounters.
 */
export interface TravelTarget {
  /** `region:<id>` or `site:<id>`. */
  key: string;
  name: string;
  expansion: number;
}

export const REGION_EXPANSIONS: Readonly<Record<string, number>> = {
  keldor: 1001,
  everwinter: 1003,
  eldertree: 1005,
  frostwind: 1006,
  evergrove: 1007,
  emberfrost: 1008,
  'southwest-mountains': 1009,
  fyrskar: 1010,
  'shattered-peaks': 1011,
  ohgar: 1012,
  karrhu: 1013,
  'rocky-tundra': 1014,
};

const SITE_EXPANSIONS: Readonly<Record<string, number>> = {
  aetherion: 1004,
};

export function travelTargetFor(key: string): TravelTarget | null {
  const [kind, id] = key.split(':');
  if (kind === 'region') {
    const region = MAP_REGIONS.find((entry) => entry.id === id);
    return region ? { key, name: region.name, expansion: REGION_EXPANSIONS[region.id] ?? 0 } : null;
  }
  if (kind === 'site' && id && id in SITE_EXPANSIONS) {
    const site = MAP_SITES.find((entry) => entry.id === id);
    return site ? { key, name: site.name, expansion: SITE_EXPANSIONS[id]! } : null;
  }
  return null;
}

/** The sites that are destinations of their own (Aetherion). */
export const TRAVEL_SITE_IDS: readonly string[] = Object.keys(SITE_EXPANSIONS);
