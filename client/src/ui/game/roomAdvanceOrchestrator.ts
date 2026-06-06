import type { EncounterRoomSnapshotDto, RoomStateDto } from '../../api/http.js';

const ENCOUNTER_PRESENTATION_STATES: ReadonlySet<RoomStateDto> = new Set([
  'active_encounter',
  'system_event',
]);

const ENCOUNTER_TRANSITION_BASELINE_STATES: ReadonlySet<RoomStateDto> = new Set([
  'active_encounter',
  'system_event',
  'waiting_continue',
  'advancing',
]);

/** True when the shared encounter shell changed and the client should run the full transition. */
export function encounterSnapshotAdvanced(
  baseline: EncounterRoomSnapshotDto,
  next: EncounterRoomSnapshotDto,
): boolean {
  if (next.activeEncounter.snapshotId === baseline.activeEncounter.snapshotId) {
    return false;
  }

  if (!ENCOUNTER_PRESENTATION_STATES.has(next.roomState)) {
    return false;
  }

  return ENCOUNTER_TRANSITION_BASELINE_STATES.has(baseline.roomState);
}

/** Room advanced from a continue/advance boundary (poll gating). */
export function roomAdvancedFromBaseline(
  baseline: EncounterRoomSnapshotDto,
  next: EncounterRoomSnapshotDto,
): boolean {
  return encounterSnapshotAdvanced(baseline, next);
}

export interface RoomAdvanceTransitionHooks {
  applySnapshotOnly: (next: EncounterRoomSnapshotDto) => void;
  playDismissAnimations: () => Promise<void>;
  setTransitionInFlight: (inFlight: boolean) => void;
  onAdvanceComplete?: () => void;
}

/** Apply snapshot updates; play reward dismiss only when the encounter snapshot advances. */
export async function runEncounterAdvanceTransition(
  baseline: EncounterRoomSnapshotDto,
  next: EncounterRoomSnapshotDto,
  hooks: RoomAdvanceTransitionHooks,
): Promise<void> {
  if (!encounterSnapshotAdvanced(baseline, next)) {
    hooks.applySnapshotOnly(next);
    return;
  }

  hooks.setTransitionInFlight(true);
  try {
    await hooks.playDismissAnimations();
    hooks.applySnapshotOnly(next);
    hooks.onAdvanceComplete?.();
  } finally {
    hooks.setTransitionInFlight(false);
  }
}
