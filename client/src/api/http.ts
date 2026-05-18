import type {
  AvatarInventoryDto,
  AvatarResponse,
  AvatarsResponse,
  ClientSession,
  EncounterAction,
  EncounterResultResponse,
  EncounterSnapshotDto,
  InventoryItemDto,
  PlayerCurrencyResponse,
  PersistedAvatarDto,
  PlayerResponse,
  StaticGameDataStatus,
} from '@shared/contracts';

export const API_BASE_URL = 'http://localhost:3000';

export type AvatarInventory = AvatarInventoryDto;
export type EncounterSnapshot = EncounterSnapshotDto;
export type InventoryItem = InventoryItemDto;
export type PersistedAvatar = PersistedAvatarDto;
export type ResolveEncounterResponse = EncounterResultResponse;
export type {
  AvatarResponse,
  AvatarsResponse,
  ClientSession,
  EncounterAction,
  PlayerCurrencyResponse,
  PlayerResponse,
  StaticGameDataStatus,
};

const DEFAULT_SESSION: ClientSession = {
  playerId: 'Babuni',
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}

export async function fetchSession(): Promise<ClientSession> {
  await request<{ status: string }>('/health');
  return DEFAULT_SESSION;
}

export async function fetchStaticGameDataStatus(): Promise<StaticGameDataStatus> {
  const status = await request<StaticGameDataStatus>('/game-data/status');

  if (
    status.status !== 'ok' ||
    status.encounters <= 0 ||
    status.solutions <= 0 ||
    status.frames <= 0 ||
    status.portraits <= 0
  ) {
    throw new Error('Static game data is incomplete.');
  }

  return status;
}

export async function fetchPlayer(
  session: ClientSession | null,
): Promise<PlayerResponse> {
  const playerId = session?.playerId ?? DEFAULT_SESSION.playerId;
  const params = new URLSearchParams({ playerId });

  return request<PlayerResponse>(`/player?${params.toString()}`);
}

export async function addYellowRedGem(
  encounterKey: string,
): Promise<PlayerCurrencyResponse> {
  return request<PlayerCurrencyResponse>('/player/currency/yellow_red_gem', {
    method: 'POST',
    body: JSON.stringify({ encounterKey }),
  });
}

export async function fetchAvatar(
  player: PlayerResponse | null,
): Promise<AvatarResponse> {
  void player;

  try {
    return await request<AvatarResponse>('/avatar/active');
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP 404')) {
      return {};
    }

    throw error;
  }
}

export async function fetchActiveEncounter(
  avatar: AvatarResponse | null,
): Promise<EncounterSnapshot | null> {
  if (!avatar?.avatar?.id) {
    return null;
  }

  const params = new URLSearchParams({
    playerId: DEFAULT_SESSION.playerId,
    avatarId: avatar.avatar.id,
  });

  try {
    return await request<EncounterSnapshot>(
      `/encounter/active?${params.toString()}`,
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP 404')) {
      return null;
    }

    throw error;
  }
}

export async function fetchAvatars(): Promise<PersistedAvatar[]> {
  const response = await request<AvatarsResponse>('/avatars');
  return response.avatars;
}

export async function createAvatar(
  avatar: PersistedAvatar,
): Promise<PersistedAvatar> {
  const response = await request<AvatarResponse>('/avatar', {
    method: 'POST',
    body: JSON.stringify(avatar),
  });

  if (!response.avatar) {
    throw new Error('Avatar creation response did not include an avatar.');
  }

  return response.avatar;
}

export async function selectAvatar(
  avatar: PersistedAvatar,
): Promise<{ avatar: PersistedAvatar; encounter: EncounterSnapshot }> {
  const response = await request<{ avatar: PersistedAvatar; encounter: EncounterSnapshot }>('/avatar/select', {
    method: 'POST',
    body: JSON.stringify(avatar),
  });

  return response;
}

export async function deleteAvatar(avatarId: string): Promise<void> {
  await request<{ ok: true }>(`/avatar/${encodeURIComponent(avatarId)}`, {
    method: 'DELETE',
  });
}

export async function fetchOrCreateActiveEncounter(
  avatar: PersistedAvatar,
): Promise<EncounterSnapshot> {
  const params = new URLSearchParams({
    playerId: DEFAULT_SESSION.playerId,
    avatarId: avatar.id,
  });

  try {
    return await request<EncounterSnapshot>(`/encounter/active?${params.toString()}`);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('HTTP 404')) {
      throw error;
    }
  }

  return request<EncounterSnapshot>('/encounter/create', {
    method: 'POST',
    body: JSON.stringify({
      playerId: DEFAULT_SESSION.playerId,
      avatarId: avatar.id,
    }),
  });
}

export async function resolveEncounterAction(
  action: EncounterAction,
  avatarId: string,
): Promise<ResolveEncounterResponse> {
  return request<ResolveEncounterResponse>('/encounter/continue', {
    method: 'POST',
    body: JSON.stringify({
      playerId: DEFAULT_SESSION.playerId,
      avatarId,
      action,
    }),
  });
}

export async function clearEncounter(avatarId: string): Promise<void> {
  await request<{ ok: true }>('/encounter/clear', {
    method: 'POST',
    body: JSON.stringify({
      playerId: DEFAULT_SESSION.playerId,
      avatarId,
    }),
  });
}

export async function createNextEncounter(
  avatar: PersistedAvatar,
): Promise<EncounterSnapshot> {
  return request<EncounterSnapshot>('/encounter/create', {
    method: 'POST',
    body: JSON.stringify({
      playerId: DEFAULT_SESSION.playerId,
      avatarId: avatar.id,
    }),
  });
}
