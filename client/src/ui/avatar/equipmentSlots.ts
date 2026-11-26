import { isEquippableSolution, normalizeEquipmentSlots, type EquippableRecord } from '@shared/equipment.js';
import type { AvatarInventory } from '../../api/http.js';

function chargesOf(inventory: AvatarInventory | undefined, solutionId: number): number {
  return [...(inventory?.items ?? []), ...(inventory?.essences ?? [])]
    .filter((item) => item.solutionId === solutionId)
    .reduce((sum, item) => sum + Math.max(0, item.uses), 0);
}

/** The slots as shown (D-056): an item with no charge left has broken and leaves its slot empty. */
export function shownEquipmentSlots(inventory: AvatarInventory | undefined): (number | null)[] {
  return normalizeEquipmentSlots(inventory?.equipped).map((id) =>
    id !== null && chargesOf(inventory, id) > 0 ? id : null,
  );
}

/**
 * The first empty equipment slot an item in the inventory could fill, or
 * null when every slot is filled or nothing can be equipped (Babuni,
 * 2026-11-26: before entering the world, and whenever an item breaks, the
 * game asks for an item for each empty slot).
 */
export function nextEmptyEquipSlot(
  inventory: AvatarInventory | undefined,
  solutions: Record<string, EquippableRecord | undefined>,
): number | null {
  const slots = shownEquipmentSlots(inventory);
  const empty = slots.findIndex((id) => id === null);
  if (empty < 0) {
    return null;
  }
  const available = (inventory?.items ?? []).some((item) =>
    item.uses > 0
    && !slots.includes(item.solutionId)
    && isEquippableSolution(solutions[String(item.solutionId)]));
  return available ? empty : null;
}
