/**
 * The gods' essences by element, and each race's own element (Babuni,
 * 2026-11-21). Elements follow the pantheon's four tribunals
 * (MorkahjaWorldBuilding Pantheon/Elemental_Pantheon.md): Ignis Council fire,
 * Abyssal Conclave water, Celestial Convocation air, Terran Assembly earth.
 * The races' elements follow Magic/Magic_Corruption.md and the race arts:
 * Rokur fire, Verdani water, Aevis air, Grimnir earth.
 */
export type EssenceElement = 'fire' | 'water' | 'air' | 'earth';

export type ElementRace = 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';

export const ESSENCE_ELEMENTS: Readonly<Record<number, EssenceElement>> = {
  10040: 'fire', // Fyraan
  10038: 'fire', // Solriel
  10039: 'fire', // Khaotys
  10122: 'water', // Nereval
  10123: 'water', // Sylvanus
  10244: 'water', // Aerisara
  10010: 'air', // Aeriel
  10011: 'air', // Aetheria
  10026: 'air', // Ordius
  10037: 'earth', // Stonara
  10027: 'earth', // Ferrumis
  10036: 'earth', // Umbrael
};

export const RACE_ELEMENTS: Readonly<Record<ElementRace, EssenceElement>> = {
  Rokur: 'fire',
  Verdani: 'water',
  Aevis: 'air',
  Grimnir: 'earth',
};

/** The same by the race's reward type (40 Rokur, 41 Verdani, 42 Aevis, 43 Grimnir). */
export const RACE_REWARD_TYPE_ELEMENTS: Readonly<Record<number, EssenceElement>> = {
  40: 'fire',
  41: 'water',
  42: 'air',
  43: 'earth',
};

export function essenceElementOf(solutionId: number): EssenceElement | null {
  return ESSENCE_ELEMENTS[solutionId] ?? null;
}

/** The essence ids of one element, in ascending order. */
export function essenceIdsOfElement(element: EssenceElement): number[] {
  return Object.entries(ESSENCE_ELEMENTS)
    .filter(([, value]) => value === element)
    .map(([id]) => Number(id))
    .sort((left, right) => left - right);
}
