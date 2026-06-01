import type { EncounterRoomSnapshotDto } from '../../api/http.js';

/** True when the server advanced to a new encounter snapshot. */
export function encounterSnapshotAdvanced(
  baseline: EncounterRoomSnapshotDto,
  next: EncounterRoomSnapshotDto,
): boolean {
  return (
    next.roomState === 'active_encounter'
    && next.activeEncounter.snapshotId !== baseline.activeEncounter.snapshotId
  );
}

/** Room advanced from waiting_continue / advancing (poll gating). */
export function roomAdvancedFromBaseline(
  baseline: EncounterRoomSnapshotDto,
  next: EncounterRoomSnapshotDto,
): boolean {
  return (
    encounterSnapshotAdvanced(baseline, next)
    && (
      baseline.roomState === 'waiting_continue'
      || baseline.roomState === 'advancing'
    )
  );
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
