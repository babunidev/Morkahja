export type EncounterState = 'active' | 'resolving' | 'resolved';

export interface EncounterExecutionLock {
  snapshotId: string;
  locked: boolean;
}

const allowedTransitions: ReadonlyMap<EncounterState, ReadonlySet<EncounterState>> =
  new Map([
    ['active', new Set(['resolving'])],
    ['resolving', new Set(['resolved'])],
    ['resolved', new Set()],
  ]);

const locks = new Map<string, EncounterExecutionLock>();

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

export function acquireLock(snapshotId: string): EncounterExecutionLock {
  const existing = locks.get(snapshotId);

  if (existing?.locked) {
    throw new Error('Encounter already resolving');
  }

  const lock: EncounterExecutionLock = {
    snapshotId,
    locked: true,
  };

  locks.set(snapshotId, lock);
  return lock;
}

export function releaseLock(snapshotId: string): void {
  locks.set(snapshotId, {
    snapshotId,
    locked: false,
  });
}
