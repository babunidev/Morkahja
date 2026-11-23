import { normalizeEquipmentSlots } from '@shared/equipment.js';
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
