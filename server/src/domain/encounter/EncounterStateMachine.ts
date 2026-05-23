export type EncounterState = 'active' | 'resolving' | 'resolved';

const allowedTransitions: ReadonlyMap<EncounterState, ReadonlySet<EncounterState>> =
  new Map([
    ['active', new Set(['resolving'])],
    ['resolving', new Set(['resolved'])],
    ['resolved', new Set()],
  ]);

export function assertValidTransition(
  from: EncounterState,
  to: EncounterState,
): void {
  if (allowedTransitions.get(from)?.has(to)) {
    return;
  }

  throw new Error(`Invalid encounter state transition: ${from} → ${to}`);
}

export function transitionState(
  current: EncounterState,
  next: EncounterState,
): EncounterState {
  assertValidTransition(current, next);
  return next;
}
