import type { AvatarInventory } from '../../../api/http.js';
import { SolutionGridOverlay } from './SolutionGridOverlay.js';

export function SkillbookBlock({
  inventory,
  visible,
}: {
  inventory: AvatarInventory | undefined;
  visible: boolean;
}) {
  return (
    <SolutionGridOverlay
      ariaLabel="Skillbook"
      emptyText="Your skillbook is empty."
      inventory={inventory}
      inventoryType={1}
      scrollDataAttribute="skillbook-scroll"
      sourceContainer="spellbook"
      visible={visible}
    />
  );
}

export default SkillbookBlock;
