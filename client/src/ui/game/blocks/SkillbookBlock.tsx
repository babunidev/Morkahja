import type { AvatarInventory } from '../../../api/http.js';
import { SolutionGridOverlay } from './SolutionGridOverlay.js';

export function SkillbookBlock({
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
      ariaLabel="Skillbook"
      emptyText="Your skillbook is empty."
      inventory={inventory}
      inventoryType={1}
      panelTitle="Skillbook"
      scrollDataAttribute="skillbook-scroll"
      sourceContainer="spellbook"
      visible={visible}
      onClose={onClose}
    />
  );
}

export default SkillbookBlock;
