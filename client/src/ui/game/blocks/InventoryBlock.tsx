import type { AvatarInventory } from '../../../api/http.js';
import { SolutionGridOverlay } from './SolutionGridOverlay.js';

export function InventoryBlock({
  inventory,
  visible,
  onClose,
}: {
  inventory: AvatarInventory | undefined;
  visible: boolean;
  onClose?: () => void;
}) {
  return (
    <SolutionGridOverlay
      ariaLabel="Inventory"
      emptyText="Your inventory is empty."
      inventory={inventory}
      inventoryType={2}
      panelTitle="Inventory"
      scrollDataAttribute="inventory-scroll"
      sourceContainer="items"
      visible={visible}
      onClose={onClose}
    />
  );
}

export default InventoryBlock;
