/**
 * Equipment (D-056, Babuni, 2026-11-23): two item slots. Equipping adds one
 * charge that belongs to the slot; a use with a total of 12 or higher gives one
 * charge back, 20 or higher two. Hardship and Misery cannot take an equipped
 * item's charges. There is no unequip: equipping another item into an occupied
 * slot takes one charge from the item that leaves.
 */

export const EQUIPMENT_SLOT_COUNT = 2;

/** Charges added when an item goes into a slot, and taken when it leaves. */
export const EQUIPMENT_SLOT_CHARGE = 1;

export const EQUIPMENT_REGAIN_ONE_TOTAL = 12;
export const EQUIPMENT_REGAIN_TWO_TOTAL = 20;

/** The two slots; `null` is an empty slot. */
export type EquipmentSlots = (number | null)[];

export interface EquippableRecord {
  mSolutionInventoryType: number;
  mSolutionType: number;
}

const SKILL_INVENTORY_TYPE = 1;
const ESSENCE_SOLUTION_TYPE = 15;
const ATRANOR_ITEM_SOLUTION_TYPE = 77;

/**
 * Items only: skills have the specialization instead, and essences and the
 * Atranor items keep their own rules.
 */
export function isEquippableSolution(record: EquippableRecord | null | undefined): boolean {
  if (!record) {
    return false;
  }
  return record.mSolutionInventoryType !== SKILL_INVENTORY_TYPE
    && record.mSolutionType !== ESSENCE_SOLUTION_TYPE
    && record.mSolutionType !== ATRANOR_ITEM_SOLUTION_TYPE;
}

/** Charges an equipped item gets back after a use with this total (the roll as shown). */
export function equipmentRegainCharges(total: number): number {
  if (!Number.isFinite(total)) {
    return 0;
  }
  if (total >= EQUIPMENT_REGAIN_TWO_TOTAL) {
    return 2;
  }
  return total >= EQUIPMENT_REGAIN_ONE_TOTAL ? 1 : 0;
}

/** Always two entries; anything that is not a positive integer id is an empty slot. */
export function normalizeEquipmentSlots(value: unknown): EquipmentSlots {
  const source = Array.isArray(value) ? value : [];
  const slots: EquipmentSlots = [];
  for (let index = 0; index < EQUIPMENT_SLOT_COUNT; index += 1) {
    const entry = source[index];
    const id = typeof entry === 'number' && Number.isInteger(entry) && entry > 0 ? entry : null;
    // The same item cannot fill both slots.
    slots.push(id !== null && slots.includes(id) ? null : id);
  }
  return slots;
}

export function equippedSolutionIds(value: unknown): number[] {
  return normalizeEquipmentSlots(value).filter((id): id is number => id !== null);
}
