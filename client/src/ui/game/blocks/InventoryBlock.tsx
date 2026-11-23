import type { AvatarInventory } from '../../../api/http.js';
import { SolutionGridOverlay, type SolutionGridEntry } from './SolutionGridOverlay.js';

/** The inventory opened to choose an item for an equipment slot (D-056). */
export interface InventoryPickMode {
  title: string;
  emptyText: string;
  pickable: (entry: SolutionGridEntry) => boolean;
  onPick: (solutionId: number) => void;
}

export function InventoryBlock({
  inventory,
  visible,
  onClose,
  pick = null,
}: {
  inventory: AvatarInventory | undefined;
  visible: boolean;
  onClose?: () => void;
  pick?: InventoryPickMode | null;
}) {
  return (
    <SolutionGridOverlay
      ariaLabel="Inventory"
      emptyText={pick?.emptyText ?? 'Your inventory is empty.'}
      inventory={inventory}
      inventoryType={2}
      panelTitle={pick?.title ?? 'Inventory'}
      scrollDataAttribute="inventory-scroll"
      sourceContainer="items"
      visible={visible}
      onClose={onClose}
      pickable={pick?.pickable}
      onPick={pick?.onPick}
    />
  );
}

export default InventoryBlock;
