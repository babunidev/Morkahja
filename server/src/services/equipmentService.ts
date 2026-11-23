import type { AvatarDocument, AvatarInventory } from '../types/avatar.js';
import { withDocumentTransaction } from '../db/postgresDocumentStore.js';
import { readAvatarLifeStatus } from './avatarDeathService.js';
import { createInitialAvatarInventory, equipItemInInventoryState, EquipmentError } from './inventoryService.js';
import { patchOpenOutcomeInventory } from './roomService.js';

export class EquipmentRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

/**
 * Equip an item into one of the avatar's two slots (D-056). Not while the
 * player is still choosing in the encounter in front of them. When the
 * encounter's outcome is already prepared, the outcome decides what the
 * inventory will be, so the item is checked against it and the change goes
 * into it as well.
 */
export async function equipAvatarItem(
  playerId: string,
  avatarId: string,
  slot: number,
  solutionId: number,
): Promise<AvatarInventory> {
  try {
    return await withDocumentTransaction(async (transaction) => {
      const avatar = await transaction.getAvatar<AvatarDocument>(playerId, avatarId);
      if (!avatar) {
        throw new EquipmentRequestError('Avatar not found', 404, 'AVATAR_NOT_FOUND');
      }
      if (readAvatarLifeStatus(avatar) !== 'active') {
        throw new EquipmentRequestError('This avatar cannot change equipment', 409, 'AVATAR_NOT_ACTIVE');
      }

      const transform = (inventory: AvatarInventory) => equipItemInInventoryState(inventory, slot, solutionId);
      const outcome = await patchOpenOutcomeInventory(transaction, playerId, avatarId, transform);
      if (outcome.kind === 'choice_open') {
        throw new EquipmentRequestError(
          'Equipment can change once the choice in this encounter is made',
          409,
          'CHOICE_OPEN',
        );
      }

      const current = await transaction.getInventory<AvatarInventory>(playerId, avatarId)
        ?? avatar.inventory
        ?? createInitialAvatarInventory(avatar.profile);

      let next: AvatarInventory;
      if (outcome.kind === 'patched') {
        // The item may only exist after the prepared outcome (a reward not yet
        // collected); the outcome then carries the change on Continue.
        try {
          next = transform(current);
        } catch (error) {
          if (!(error instanceof EquipmentError)) {
            throw error;
          }
          next = { ...current, equipped: outcome.inventory.equipped };
        }
      } else {
        next = transform(current);
      }

      await transaction.setInventory(playerId, avatarId, next as never);
      await transaction.setAvatar(playerId, avatarId, { inventory: next } as never, { merge: true });
      return next;
    });
  } catch (error) {
    if (error instanceof EquipmentError) {
      throw new EquipmentRequestError(error.message, error.code === 'ALREADY_EQUIPPED' ? 409 : 400, error.code);
    }
    throw error;
  }
}
