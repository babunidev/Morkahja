import {
  ensureTestPlayer,
  TEST_AVATAR_ID,
  TEST_PLAYER_ID,
} from './testBootstrap.js';

type EncounterAction = 'A' | 'B' | 'C' | 'D' | 'dice';

interface EncounterSnapshot {
  snapshotId: string;
  encounterId: number;
  preparedEncounter: {
    encounterId: number;
    followMode: 'follow' | 'random' | 'system';
  };
  rollA: number;
  rollB: number;
  rollC: number;
  rollD: number;
  rollE: number;
  state: 'created' | 'active' | 'resolving' | 'resolved';
  resolved: boolean;
}

interface ResolveEncounterResponse {
  success: boolean;
  rewards: number[];
  message: string;
  slotResults: Record<'A' | 'B' | 'C' | 'D', boolean>;
  snapshot: EncounterSnapshot;
}

const BASE_URL = process.env.MORKAHJA_API_URL ?? 'http://localhost:3000';
const PLAYER_ID = TEST_PLAYER_ID;
const AVATAR_ID = TEST_AVATAR_ID;
const ACTION: EncounterAction = 'A';

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${path}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

async function requestExpectFailure(
  path: string,
  init?: RequestInit,
): Promise<void> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (response.ok) {
    throw new Error(`Expected ${path} to fail, but it succeeded`);
  }
}

function assertRolls(snapshot: EncounterSnapshot, label: string): void {
  for (const key of ['rollA', 'rollB', 'rollC', 'rollD', 'rollE'] as const) {
    if (typeof snapshot[key] !== 'number') {
      throw new Error(`${label}: missing numeric ${key}`);
    }
  }
  if (typeof snapshot.preparedEncounter?.encounterId !== 'number') {
    throw new Error(`${label}: missing prepared encounter id`);
  }
  if (!['follow', 'random', 'system'].includes(snapshot.preparedEncounter.followMode)) {
    throw new Error(`${label}: invalid prepared encounter follow mode`);
  }
}

function assertSameSnapshot(
  expected: EncounterSnapshot,
  actual: EncounterSnapshot,
  label: string,
): void {
  if (actual.snapshotId !== expected.snapshotId) {
    throw new Error(`${label}: snapshotId changed`);
  }
  if (actual.encounterId !== expected.encounterId) {
    throw new Error(`${label}: encounterId changed`);
  }
  if (
    actual.preparedEncounter.encounterId !==
      expected.preparedEncounter.encounterId ||
    actual.preparedEncounter.followMode !== expected.preparedEncounter.followMode
  ) {
    throw new Error(`${label}: prepared encounter changed`);
  }
  for (const key of ['rollA', 'rollB', 'rollC', 'rollD', 'rollE'] as const) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${label}: ${key} changed`);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createEncounter(): Promise<EncounterSnapshot> {
  return request<EncounterSnapshot>('/encounter/create', {
    method: 'POST',
    body: JSON.stringify({
      playerId: PLAYER_ID,
      avatarId: AVATAR_ID,
    }),
  });
}

async function getActiveEncounter(): Promise<EncounterSnapshot> {
  const params = new URLSearchParams({
    playerId: PLAYER_ID,
    avatarId: AVATAR_ID,
  });

  return request<EncounterSnapshot>(`/encounter/active?${params.toString()}`);
}

async function resolveEncounter(): Promise<ResolveEncounterResponse> {
  return request<ResolveEncounterResponse>('/encounter/resolve', {
    method: 'POST',
    body: JSON.stringify({
      playerId: PLAYER_ID,
      avatarId: AVATAR_ID,
      action: ACTION,
    }),
  });
}

async function assertDuplicateResolutionRejected(): Promise<void> {
  await requestExpectFailure('/encounter/resolve', {
    method: 'POST',
    body: JSON.stringify({
      playerId: PLAYER_ID,
      avatarId: AVATAR_ID,
      action: ACTION,
    }),
  });
}

async function main(): Promise<void> {
  await ensureTestPlayer();

  const created = await createEncounter();
  assertRolls(created, 'created encounter');

  const firstReconnect = await getActiveEncounter();
  if (firstReconnect.state !== 'active') {
    throw new Error(`Expected active state, got ${firstReconnect.state}`);
  }
  assertRolls(firstReconnect, 'first reconnect');
  assertSameSnapshot(created, firstReconnect, 'first reconnect');

  await delay(500);

  const secondReconnect = await getActiveEncounter();
  if (secondReconnect.state !== 'active') {
    throw new Error(`Expected active state after delay, got ${secondReconnect.state}`);
  }
  assertSameSnapshot(created, secondReconnect, 'second reconnect');

  const resolved = await resolveEncounter();
  if (resolved.snapshot.state !== 'resolved') {
    throw new Error(`Expected resolved state, got ${resolved.snapshot.state}`);
  }
  if (!Array.isArray(resolved.rewards)) {
    throw new Error('Resolve response missing rewards array');
  }
  if (typeof resolved.message !== 'string') {
    throw new Error('Resolve response missing message string');
  }
  if (!resolved.slotResults) {
    throw new Error('Resolve response missing slot results');
  }

  const persistedResolved = await getActiveEncounter();
  if (persistedResolved.state !== 'resolved') {
    throw new Error(
      `Expected Firebase snapshot to remain resolved, got ${persistedResolved.state}`,
    );
  }
  assertSameSnapshot(created, persistedResolved, 'resolved persistence');

  await assertDuplicateResolutionRejected();

  console.log(JSON.stringify(
    {
      encounterId: resolved.snapshot.encounterId,
      snapshotId: resolved.snapshot.snapshotId,
      playerId: PLAYER_ID,
      avatarId: AVATAR_ID,
      nextEncounterId: resolved.snapshot.preparedEncounter.encounterId,
      followMode: resolved.snapshot.preparedEncounter.followMode,
      reconnectValidation: 'passed',
      finalState: resolved.snapshot.state,
      rewards: resolved.rewards,
      message: resolved.message,
      success: resolved.success,
    },
    null,
    2,
  ));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
