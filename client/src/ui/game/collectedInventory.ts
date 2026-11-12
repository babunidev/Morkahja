import type { AvatarInventory, InventoryItem } from '../../api/http.js';

/**
 * Items the player has collected from a result but the server has not
 * committed yet. The server adds rewards and removes losses only when the round
 * continues, so without this the inventory would show a collected item one
 * round late. The display applies these on top of the server's inventory for
 * the same encounter; once the next encounter arrives, the server's committed
 * inventory is shown instead, so nothing is counted twice.
 */
export interface CollectedInventoryChange {
  solutionId: number;
  /** Charges gained (reward) or lost (loss). */
  quantity: number;
  kind: 'reward' | 'loss';
}

export interface CollectedSolutionInfo {
  /** 1 skillbook, 2 items, 3 essences (as on the server). */
  mSolutionInventoryType: number;
  mSolutionType?: number;
}

type Container = 'spellbook' | 'items' | 'essences';

function containerFor(inventoryType: number): Container | null {
  switch (inventoryType) {
    case 1:
      return 'spellbook';
    case 2:
      return 'items';
    case 3:
      return 'essences';
    default:
      return null;
  }
}

function copyInventory(inventory: AvatarInventory | undefined): AvatarInventory {
  return {
    spellbook: (inventory?.spellbook ?? []).map((item) => ({ ...item })),
    items: (inventory?.items ?? []).map((item) => ({ ...item })),
    essences: (inventory?.essences ?? []).map((item) => ({ ...item })),
  };
}

/** The inventory to show: the server's, plus collected rewards, minus collected losses. */
export function inventoryWithCollected(
  inventory: AvatarInventory | undefined,
  changes: readonly CollectedInventoryChange[],
  solutionInfo: (solutionId: number) => CollectedSolutionInfo | undefined,
): AvatarInventory | undefined {
  if (changes.length === 0) {
    return inventory;
  }

  const next = copyInventory(inventory);
  for (const change of changes) {
    const info = solutionInfo(change.solutionId);
    const container = info ? containerFor(info.mSolutionInventoryType) : null;
    if (!container || change.quantity <= 0) {
      continue;
    }

    const items: InventoryItem[] = next[container];
    const existing = items.find((item) => item.solutionId === change.solutionId);
    if (change.kind === 'reward') {
      if (existing) {
        existing.uses += change.quantity;
      } else {
        items.push({
          solutionId: change.solutionId,
          solutionType: info?.mSolutionType ?? 0,
          uses: change.quantity,
        });
      }
      continue;
    }

    if (existing) {
      existing.uses = Math.max(0, existing.uses - change.quantity);
    }
    next[container] = items.filter((item) => item.uses > 0);
  }

  return next;
}
