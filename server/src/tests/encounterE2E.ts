import {
  resetTestState,
  seedTestInventory,
  TEST_AVATAR_ID,
  TEST_PLAYER_ID,
} from './testBootstrap.js';

type EncounterAction = 'A' | 'B' | 'C' | 'D' | 'dice';

interface EncounterSnapshot {
  snapshotId: string;
  playerId: string;
  avatarId: string;
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
  createdAt: number;
}

interface ResolveEncounterResponse {
  success: boolean;
  slotResults: Record<'A' | 'B' | 'C' | 'D', boolean>;
  rewards: number[];
  message: string;
  snapshot: EncounterSnapshot;
}

const BASE_URL = process.env.MORKAHJA_API_URL ?? 'http://localhost:3000';
const PLAYER_ID = TEST_PLAYER_ID;
const AVATAR_ID = TEST_AVATAR_ID;
const ACTION: EncounterAction = 'A';
const EXPECTED_ENCOUNTER_ID = 19001;

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
    const body = await response.text();
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${path}: ${body}`,
    );
  }

  return (await response.json()) as T;
}

function assertRolls(snapshot: EncounterSnapshot): void {
  for (const key of ['rollA', 'rollB', 'rollC', 'rollD', 'rollE'] as const) {
    if (typeof snapshot[key] !== 'number') {
      throw new Error(`Missing numeric ${key}`);
    }
  }
}

function assertSnapshot(value: EncounterSnapshot, label: string): void {
  if (!value.snapshotId) {
    throw new Error(`${label}: missing snapshotId`);
  }
  if (typeof value.encounterId !== 'number') {
    throw new Error(`${label}: missing encounterId`);
  }
  assertRolls(value);
  if (typeof value.preparedEncounter?.encounterId !== 'number') {
    throw new Error(`${label}: missing prepared encounter id`);
  }
  if (!['follow', 'random', 'system'].includes(value.preparedEncounter.followMode)) {
    throw new Error(`${label}: invalid prepared encounter follow mode`);
  }
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

async function resolveEncounter(
  action: EncounterAction,
): Promise<ResolveEncounterResponse> {
  return request<ResolveEncounterResponse>('/encounter/resolve', {
    method: 'POST',
    body: JSON.stringify({
      playerId: PLAYER_ID,
      avatarId: AVATAR_ID,
      action,
    }),
  });
}

async function main(): Promise<void> {
  await resetTestState();
  await seedTestInventory();

  const created = await createEncounter();
  assertSnapshot(created, 'created encounter');

  if (created.encounterId !== EXPECTED_ENCOUNTER_ID) {
    throw new Error(
      `Expected deterministic encounter ${EXPECTED_ENCOUNTER_ID}, got ${created.encounterId}`,
    );
  }

  const active = await getActiveEncounter();
  assertSnapshot(active, 'active encounter');

  if (active.state !== 'active') {
    throw new Error(`Expected active state, got ${active.state}`);
  }
  if (active.encounterId !== created.encounterId) {
    throw new Error('Active encounterId does not match created encounter');
  }
  if (active.snapshotId !== created.snapshotId) {
    throw new Error('Active snapshotId does not match created snapshot');
  }

  const resolved = await resolveEncounter(ACTION);

  if (typeof resolved.success !== 'boolean') {
    throw new Error('Resolve response missing success boolean');
  }
  if (!Array.isArray(resolved.rewards)) {
    throw new Error('Resolve response missing rewards array');
  }
  if (!resolved.slotResults) {
    throw new Error('Resolve response missing slotResults');
  }
  if (typeof resolved.message !== 'string') {
    throw new Error('Resolve response missing message');
  }
  if (resolved.snapshot.state !== 'resolved') {
    throw new Error(
      `Expected resolved snapshot state, got ${resolved.snapshot.state}`,
    );
  }
  if (
    resolved.snapshot.preparedEncounter.encounterId !==
    created.preparedEncounter.encounterId
  ) {
    throw new Error('Prepared encounter changed during resolution');
  }

  const nextCreated = await createEncounter();

  if (nextCreated.encounterId !== created.preparedEncounter.encounterId) {
    throw new Error(
      `Expected next create to consume prepared encounter ${created.preparedEncounter.encounterId}, got ${nextCreated.encounterId}`,
    );
  }

  console.log(JSON.stringify(
    {
      encounterId: resolved.snapshot.encounterId,
      nextEncounterId: nextCreated.encounterId,
      selectedAction: ACTION,
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
