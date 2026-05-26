import { createEncounterRollSnapshot } from '../engine/encounterResolver.js';
import type {
  EncounterRollSnapshot,
  SelectedEncounterAction,
} from '../engine/encounterResolver.js';
import type {
  EncounterData,
  EncounterSlotLetter,
} from '../engine/types.js';

export type EncounterSnapshotState =
  | 'created'
  | 'active'
  | 'resolving'
  | 'resolved';

export type EncounterFollowMode = 'follow' | 'random' | 'system';

export interface PreparedEncounter {
  encounterId: number;
  followMode: EncounterFollowMode;
}

/** Authoritative server-side encounter fate snapshot stored in persistence. */
export interface EncounterSnapshot {
  snapshotId: string;
  /** Legacy owner fields; room-owned snapshots use roomId as authority. */
  playerId: string;
  avatarId: string;
  /** When set, the encounter is owned by an EncounterRoom. */
  roomId?: string;
  encounterId: number;

  // Metadata copied from the selected encounter definition at creation time.
  encounterType: EncounterData['mEncounterType'];
  encounterExpansion: EncounterData['mEncounterExpansion'];
  encounterRewardType: EncounterData['mEncounterRewardType'];
  encounterRewardAmount: number;
  encounterDifficulty: EncounterData['mEncounterDifficulty'];
  encounterFollow: number;
  encounterImageName: string;
  encounterTitle: string;
  encounterText: string;

  // Slot requirements copied from static data for replay-safe resolution.
  primarySolutionA: EncounterData['mEncounterSolutiuonA'];
  primarySolutionB: EncounterData['mEncounterSolutiuonB'];
  primarySolutionC: EncounterData['mEncounterSolutiuonC'];
  primarySolutionD: EncounterData['mEncounterSolutiuonD'];
  secondarySolutionTypeA: EncounterData['mEncounterSolutiuonTypeA'];
  secondarySolutionTypeB: EncounterData['mEncounterSolutiuonTypeB'];
  secondarySolutionTypeC: EncounterData['mEncounterSolutiuonTypeC'];
  secondarySolutionTypeD: EncounterData['mEncounterSolutiuonTypeD'];

  // Immutable precomputed rolls.
  rollA: number;
  rollB: number;
  rollC: number;
  rollD: number;
  rollPrimaryA: number;
  rollPrimaryB: number;
  rollPrimaryC: number;
  rollPrimaryD: number;
  rollSecondaryA: number;
  rollSecondaryB: number;
  rollSecondaryC: number;
  rollSecondaryD: number;
  rollE: number;

  // Rewards are selected at encounter creation, then conditionally granted.
  rewardIds: number[];
  prosperityRewardId: number | null;

  resolved: boolean;
  state: EncounterSnapshotState;
  createdAt: number;
  /** Earliest timestamp when player actions are accepted for this encounter. */
  actionReadyAt?: number;
  preparedEncounter: PreparedEncounter;

  /** Server-authoritative lore gem roll; set when the player opens lore. */
  loreGemOffer?: {
    eligible: boolean;
    claimableAt: number | null;
    offeredAt: number;
  };
}

/** Client-submitted action; server maps to resolver input. */
export type PlayerEncounterAction =
  | { type: 'primaryA' }
  | { type: 'secondaryB' }
  | { type: 'primaryC' }
  | { type: 'secondaryD' }
  | { type: 'dice' };

export function encounterToSnapshotFields(
  encounter: EncounterData,
): Pick<
  EncounterSnapshot,
  | 'encounterType'
  | 'encounterExpansion'
  | 'encounterRewardType'
  | 'encounterRewardAmount'
  | 'encounterDifficulty'
  | 'encounterFollow'
  | 'encounterImageName'
  | 'encounterTitle'
  | 'encounterText'
  | 'primarySolutionA'
  | 'primarySolutionB'
  | 'primarySolutionC'
  | 'primarySolutionD'
  | 'secondarySolutionTypeA'
  | 'secondarySolutionTypeB'
  | 'secondarySolutionTypeC'
  | 'secondarySolutionTypeD'
> {
  return {
    encounterType: encounter.mEncounterType,
    encounterExpansion: encounter.mEncounterExpansion,
    encounterRewardType: encounter.mEncounterRewardType,
    encounterRewardAmount: encounter.mEncounterRewardAmount,
    encounterDifficulty: encounter.mEncounterDifficulty,
    encounterFollow: encounter.mEncounterFollow,
    encounterImageName: encounter.mEncounterImageName,
    encounterTitle: encounter.mEncounterTitle,
    encounterText: encounter.mEncounterText,
    primarySolutionA: encounter.mEncounterSolutiuonA,
    primarySolutionB: encounter.mEncounterSolutiuonB,
    primarySolutionC: encounter.mEncounterSolutiuonC,
    primarySolutionD: encounter.mEncounterSolutiuonD,
    secondarySolutionTypeA: encounter.mEncounterSolutiuonTypeA,
    secondarySolutionTypeB: encounter.mEncounterSolutiuonTypeB,
    secondarySolutionTypeC: encounter.mEncounterSolutiuonTypeC,
    secondarySolutionTypeD: encounter.mEncounterSolutiuonTypeD,
  };
}

/**
 * Reconstruct the resolver's raw encounter shape from Firebase snapshot data.
 * Resolution/replay must use this snapshot, not static encounter JSON.
 */
export function snapshotToEncounterData(
  snapshot: EncounterSnapshot,
): EncounterData {
  return {
    mEncounterDifficulty: snapshot.encounterDifficulty,
    mEncounterExpansion: snapshot.encounterExpansion,
    mEncounterFollow: snapshot.encounterFollow,
    mEncounterID: snapshot.encounterId,
    mEncounterImageName: snapshot.encounterImageName,
    mEncounterRewardAmount: snapshot.encounterRewardAmount,
    mEncounterRewardType: snapshot.encounterRewardType,
    mEncounterSolutiuonA: snapshot.primarySolutionA,
    mEncounterSolutiuonB: snapshot.primarySolutionB,
    mEncounterSolutiuonC: snapshot.primarySolutionC,
    mEncounterSolutiuonD: snapshot.primarySolutionD,
    mEncounterSolutiuonTypeA: snapshot.secondarySolutionTypeA,
    mEncounterSolutiuonTypeB: snapshot.secondarySolutionTypeB,
    mEncounterSolutiuonTypeC: snapshot.secondarySolutionTypeC,
    mEncounterSolutiuonTypeD: snapshot.secondarySolutionTypeD,
    mEncounterText: snapshot.encounterText,
    mEncounterTitle: snapshot.encounterTitle,
    mEncounterType: snapshot.encounterType,
  };
}

export function snapshotToRolls(
  snapshot: EncounterSnapshot,
): EncounterRollSnapshot {
  return createEncounterRollSnapshot({
    rollA: snapshot.rollA,
    rollB: snapshot.rollB,
    rollC: snapshot.rollC,
    rollD: snapshot.rollD,
    rollPrimaryA: snapshot.rollPrimaryA ?? snapshot.rollA,
    rollPrimaryB: snapshot.rollPrimaryB ?? snapshot.rollA,
    rollPrimaryC: snapshot.rollPrimaryC ?? snapshot.rollC,
    rollPrimaryD: snapshot.rollPrimaryD ?? snapshot.rollC,
    rollSecondaryA: snapshot.rollSecondaryA ?? snapshot.rollB,
    rollSecondaryB: snapshot.rollSecondaryB ?? snapshot.rollB,
    rollSecondaryC: snapshot.rollSecondaryC ?? snapshot.rollD,
    rollSecondaryD: snapshot.rollSecondaryD ?? snapshot.rollD,
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
