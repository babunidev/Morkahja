import type { AvatarInventory } from '../../../api/http.js';
import { SolutionGridOverlay } from './SolutionGridOverlay.js';

export function InventoryBlock({
  inventory,
  visible,
}: {
  inventory: AvatarInventory | undefined;
  visible: boolean;
}) {
  return (
    <SolutionGridOverlay
      ariaLabel="Inventory"
      emptyText="Your inventory is empty."
      inventory={inventory}
      inventoryType={2}
      scrollDataAttribute="inventory-scroll"
      sourceContainer="items"
      visible={visible}
    />
  );
}

export default InventoryBlock;
