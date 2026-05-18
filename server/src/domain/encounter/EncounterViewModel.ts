import { interpretRoll } from '../../engine/diceInterpreter.js';
import type { RollOutcome } from '../../engine/diceInterpreter.js';
import type { EncounterData } from '../../engine/types.js';
import type { EncounterSnapshot } from '../../types/encounter.js';

export interface EncounterViewModel {
  encounterId: number;
  snapshotId: string;

  state: 'active' | 'resolving' | 'resolved';

  title: string;
  text: string;
  imageName: string;

  rolls: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
  };

  slots: {
    A: SlotViewModel;
    B: SlotViewModel;
    C: SlotViewModel;
    D: SlotViewModel;
  };

  dice: {
    available: boolean;
    roll: number;
  };

  rewards: number[];

  message: string;
  success: boolean;
}

export interface SlotViewModel {
  slot: 'A' | 'B' | 'C' | 'D';

  mode: 'primary' | 'secondary' | 'empty';

  solutionId: number | null;
  solutionType: number | null;

  state: 'available' | 'resolved' | 'failed' | 'locked';

  roll: number;

  result: 'Misery' | 'Hardship' | 'Disengage' | 'Fortune' | 'Prosperity';

  usable: boolean;
}

export interface EncounterViewModelResult {
  rewards?: number[];
  message?: string;
  success?: boolean;
  slotResults?: Partial<Record<'A' | 'B' | 'C' | 'D', boolean>>;
}

function resultForRoll(roll: number): RollOutcome {
  const result = interpretRoll(roll);

  if (!result) {
    throw new Error(`Invalid encounter roll: ${roll}`);
  }

  return result;
}

function viewState(snapshot: EncounterSnapshot): EncounterViewModel['state'] {
  if (snapshot.state === 'resolved') {
    return 'resolved';
  }
  if (snapshot.state === 'resolving') {
    return 'resolving';
  }
  return 'active';
}

function slotRoll(
  snapshot: EncounterSnapshot,
  slot: SlotViewModel['slot'],
  mode: SlotViewModel['mode'],
): number {
  if (mode === 'primary') {
    return {
      A: snapshot.rollPrimaryA ?? snapshot.rollA,
      B: snapshot.rollPrimaryB ?? snapshot.rollA,
      C: snapshot.rollPrimaryC ?? snapshot.rollC,
      D: snapshot.rollPrimaryD ?? snapshot.rollC,
    }[slot];
  }

  if (mode === 'secondary') {
    return {
      A: snapshot.rollSecondaryA ?? snapshot.rollB,
      B: snapshot.rollSecondaryB ?? snapshot.rollB,
      C: snapshot.rollSecondaryC ?? snapshot.rollD,
      D: snapshot.rollSecondaryD ?? snapshot.rollD,
    }[slot];
  }

  return {
    A: snapshot.rollA,
    B: snapshot.rollB,
    C: snapshot.rollC,
    D: snapshot.rollD,
  }[slot];
}

function slotRequirement(
  encounterData: EncounterData,
  slot: SlotViewModel['slot'],
): { solutionId: number; solutionType: number } {
  return {
    A: {
      solutionId: encounterData.mEncounterSolutiuonA,
      solutionType: encounterData.mEncounterSolutiuonTypeA,
    },
    B: {
      solutionId: encounterData.mEncounterSolutiuonB,
      solutionType: encounterData.mEncounterSolutiuonTypeB,
    },
    C: {
      solutionId: encounterData.mEncounterSolutiuonC,
      solutionType: encounterData.mEncounterSolutiuonTypeC,
    },
    D: {
      solutionId: encounterData.mEncounterSolutiuonD,
      solutionType: encounterData.mEncounterSolutiuonTypeD,
    },
  }[slot];
}

function slotMode(
  slot: SlotViewModel['slot'],
  requirement: { solutionId: number; solutionType: number },
): SlotViewModel['mode'] {
  void slot;

  if (requirement.solutionId !== 0) {
    return 'primary';
  }
  if (requirement.solutionType !== 0) {
    return 'secondary';
  }
  return 'empty';
}

function slotState(
  snapshot: EncounterSnapshot,
  mode: SlotViewModel['mode'],
  slot: SlotViewModel['slot'],
  result?: EncounterViewModelResult,
): SlotViewModel['state'] {
  if (mode === 'empty') {
    return 'locked';
  }
  if (snapshot.state === 'resolved') {
    if (result?.slotResults?.[slot] === false) {
      return 'failed';
    }
    return 'resolved';
  }
  if (snapshot.state === 'resolving') {
    return 'locked';
  }
  return 'available';
}

function toSlotViewModel(
  snapshot: EncounterSnapshot,
  encounterData: EncounterData,
  slot: SlotViewModel['slot'],
  result?: EncounterViewModelResult,
): SlotViewModel {
  const requirement = slotRequirement(encounterData, slot);
  const mode = slotMode(slot, requirement);
  const roll = slotRoll(snapshot, slot, mode);
  const state = slotState(snapshot, mode, slot, result);

  return {
    slot,
    mode,
    solutionId: mode === 'primary' ? requirement.solutionId : null,
    solutionType: mode === 'secondary' ? requirement.solutionType : null,
    state,
    roll,
    result: resultForRoll(roll),
    usable: state === 'available',
  };
}

/**
 * Pure UI-facing normalization layer.
 * No Firebase, HTTP, random generation, or mutation is allowed here.
 */
export function toEncounterViewModel(
  snapshot: EncounterSnapshot,
  encounterData: EncounterData,
  result?: EncounterViewModelResult,
): EncounterViewModel {
  return {
    encounterId: snapshot.encounterId,
    snapshotId: snapshot.snapshotId,
    state: viewState(snapshot),
    title: encounterData.mEncounterTitle,
    text: encounterData.mEncounterText,
    imageName: encounterData.mEncounterImageName,
    rolls: {
      A: snapshot.rollA,
      B: snapshot.rollB,
      C: snapshot.rollC,
      D: snapshot.rollD,
      E: snapshot.rollE,
    },
    slots: {
      A: toSlotViewModel(snapshot, encounterData, 'A', result),
      B: toSlotViewModel(snapshot, encounterData, 'B', result),
      C: toSlotViewModel(snapshot, encounterData, 'C', result),
      D: toSlotViewModel(snapshot, encounterData, 'D', result),
    },
    dice: {
      available: snapshot.state === 'active',
      roll: snapshot.rollE,
    },
    rewards: result?.rewards ?? [],
    message: result?.message ?? '',
    success: result?.success ?? false,
  };
}
