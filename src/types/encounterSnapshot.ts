import { createEncounterRollSnapshot } from '../engine/encounterResolver.ts';
import type { EncounterRollSnapshot } from '../engine/encounterResolver.ts';
import type { SelectedEncounterAction } from '../engine/encounterResolver.ts';
import type { EncounterSlotLetter } from '../engine/types.ts';

/** Authoritative server-side encounter fate snapshot stored in Firebase. */
export interface EncounterSnapshot {
  snapshotId: string;
  playerId: string;
  avatarId: string;
  encounterId: number;
  rollA: number;
  rollB: number;
  rollC: number;
  rollD: number;
  rollE: number;
  resolved: boolean;
  createdAt: number;
}

/** Client-submitted action; server maps to resolver input. */
export type PlayerEncounterAction =
  | { type: 'primaryA' }
  | { type: 'secondaryB' }
  | { type: 'primaryC' }
  | { type: 'secondaryD' }
  | { type: 'dice' };

export function snapshotToRolls(
  snapshot: EncounterSnapshot,
): EncounterRollSnapshot {
  return createEncounterRollSnapshot({
    rollA: snapshot.rollA,
    rollB: snapshot.rollB,
    rollC: snapshot.rollC,
    rollD: snapshot.rollD,
    rollE: snapshot.rollE,
  });
}

export function toSelectedEncounterAction(
  action: PlayerEncounterAction,
): SelectedEncounterAction {
  switch (action.type) {
    case 'primaryA':
      return { mode: 'slot', slot: 'A' };
    case 'secondaryB':
      return { mode: 'slot', slot: 'B' };
    case 'primaryC':
      return { mode: 'slot', slot: 'C' };
    case 'secondaryD':
      return { mode: 'slot', slot: 'D' };
    case 'dice':
      return { mode: 'dice' };
  }
}

export function slotForPlayerAction(
  action: PlayerEncounterAction,
): EncounterSlotLetter | null {
  switch (action.type) {
    case 'primaryA':
      return 'A';
    case 'secondaryB':
      return 'B';
    case 'primaryC':
      return 'C';
    case 'secondaryD':
      return 'D';
    case 'dice':
      return null;
  }
}
