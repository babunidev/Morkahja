import { ATRANOR_ELEMENT_GOD_COUNT } from '@shared/deathEncounter.js';

/**
 * Picks `count` different essences for an Atranor return (D-055): from the
 * avatar's own element's gods, in random order. An avatar without an element
 * gets different essences of any element instead.
 */
export function atranorEssenceRewardIds({
  count,
  ownEssenceIds,
  anyEssenceIds,
  pickIndex,
}: {
  count: number;
  ownEssenceIds: readonly number[];
  anyEssenceIds: readonly number[];
  /** A random index in [0, length). */
  pickIndex: (length: number) => number;
}): number[] {
  const wanted = Math.max(0, Math.min(ATRANOR_ELEMENT_GOD_COUNT, Math.floor(count)));
  const pool = [...new Set(ownEssenceIds.length > 0 ? ownEssenceIds : anyEssenceIds)];
  const picked: number[] = [];
  while (picked.length < wanted && pool.length > 0) {
    const [id] = pool.splice(pickIndex(pool.length), 1);
    picked.push(id!);
  }
  return picked;
}
