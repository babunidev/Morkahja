import { isTopRoll } from '@shared/diceInterpreter.js';
import type { DocumentTransaction } from '../db/postgresDocumentStore.js';
import { grantPlayerYellowRedGemsInTransaction } from './playerService.js';

/**
 * The top roll's gem (Babuni, 2026-11-24): one red-yellow gem for every roll
 * that reaches `TOP_ROLL_TOTAL`, granted with the roll's commit like the lore
 * gem. The claim key keeps it to one gem per player and roll; a system event
 * (Atranor, the level-up) adds its encounter so a chained level-up counts apart.
 */
export function topRollGemClaimKey(snapshotId: string, playerId: string, encounterId?: number): string {
  return encounterId === undefined
    ? `top-roll:${snapshotId}:${playerId}`
    : `top-roll:${snapshotId}:${encounterId}:${playerId}`;
}

export async function grantTopRollGemInTransaction(
  transaction: DocumentTransaction,
  playerId: string,
  selectedRoll: number | null | undefined,
  snapshotId: string,
  encounterId?: number,
): Promise<boolean> {
  if (!isTopRoll(selectedRoll)) {
    return false;
  }
  const { granted } = await grantPlayerYellowRedGemsInTransaction(
    transaction,
    playerId,
    1,
    topRollGemClaimKey(snapshotId, playerId, encounterId),
    'top_roll',
  );
  return granted;
}
