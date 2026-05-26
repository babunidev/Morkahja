import { normalizePersistedAvatar } from '../ui/avatar/avatarDisplayName.js';
import { ApiRequestError } from './httpErrorMessage.js';
import type {
  AchievementsResponse,
  ActivityFeedResponse,
  ClaimDailyRewardResponse,
  DonateGemsResponse,
  UnlockExpansionResponse,
  AddFriendResponse,
  FriendAchievementsResponse,
  FriendsListResponse,
  AvatarInventoryDto,
  AvatarResponse,
  AvatarsResponse,
  ClientSession,
  EncounterAction,
  EncounterResultResponse,
  EncounterSnapshotDto,
  InventoryItemDto,
  LoreGemClaimResponse,
  LoreGemOfferResponse,
  PersistedAvatarDto,
  PlayerProfileResponse,
  PlayerResponse,
  ActivateSealOfNorghorResponse,
  SetAvatarDisplayTitleResponse,
  StaticGameDataStatus,
} from '@shared/contracts';

/**
 * API base URL. Defaults to same-origin (empty string):
 * - dev: Vite proxies /session, /player, … to the backend on :3000
 * - prod: nginx proxies those paths to Node on the same host
 * Override at build time: VITE_API_BASE_URL=https://api.example.com
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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
  PlayerResponse,
  StaticGameDataStatus,
};

const DEFAULT_SESSION: ClientSession = {
  playerId: '',
  playerName: '',
  sessionId: '',
  accessToken: '',
};
const SESSION_STORAGE_KEY = 'morkahja.session';

export function loadStoredSession(): ClientSession | null {
  try {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) as ClientSession : null;
  } catch {
    return null;
  }
}

export function saveStoredSession(session: ClientSession): void {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function accessToken(): string | null {
  return loadStoredSession()?.accessToken ?? null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = accessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 && token) {
      clearStoredSession();
    }
    throw new ApiRequestError(response.status, response.statusText, body);
  }

  return (await response.json()) as T;
}

export async function fetchSession(): Promise<ClientSession> {
  await request<{ status: string }>('/health');
  return loadStoredSession() ?? DEFAULT_SESSION;
}

export async function bootstrapSession(input: {
  devicePublicKey: string;
  identityPublicKey: string;
  playerName?: string;
  signedIdentityChallenge?: {
    challenge: string;
    signature: string;
  };
}): Promise<ClientSession> {
  const session = await request<ClientSession>('/session/bootstrap', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  saveStoredSession(session);
  return session;
}

export async function heartbeatSession(): Promise<void> {
  await request<{ ok: true }>('/session/heartbeat', { method: 'POST' });
}

export async function logoutSession(): Promise<void> {
  await request<{ ok: true }>('/session/logout', { method: 'POST' });
  clearStoredSession();
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
  void session;

  return request<PlayerResponse>('/player');
}

export async function fetchPlayerProfile(): Promise<PlayerProfileResponse> {
  return request<PlayerProfileResponse>('/player/profile');
}

export async function setAvatarDisplayTitle(
  avatarId: string,
  displayTitle: string | null,
): Promise<SetAvatarDisplayTitleResponse> {
  const response = await request<SetAvatarDisplayTitleResponse>(
    `/avatar/${encodeURIComponent(avatarId)}/display-title`,
    {
      method: 'PATCH',
      body: JSON.stringify({ displayTitle }),
    },
  );

  return {
    ...response,
    avatar: normalizePersistedAvatar(response.avatar),
  };
}

export async function offerLoreGem(avatarId: string): Promise<LoreGemOfferResponse> {
  return request<LoreGemOfferResponse>('/encounter/lore-gem/offer', {
    method: 'POST',
    body: JSON.stringify({ avatarId }),
  });
}

export async function claimLoreGem(
  avatarId: string,
  encounterKey: string,
): Promise<LoreGemClaimResponse> {
  return request<LoreGemClaimResponse>('/encounter/lore-gem/claim', {
    method: 'POST',
    body: JSON.stringify({ avatarId, encounterKey }),
  });
}

export async function donateGems(amount: number): Promise<DonateGemsResponse> {
  return request<DonateGemsResponse>('/player/donate', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function unlockExpansion(
  expansionId: number,
): Promise<UnlockExpansionResponse> {
  return request<UnlockExpansionResponse>('/player/expansions/unlock', {
    method: 'POST',
    body: JSON.stringify({ expansionId }),
  });
}

export async function activateSealOfNorghor(): Promise<ActivateSealOfNorghorResponse> {
  return request<ActivateSealOfNorghorResponse>('/player/seal-of-norghor/activate', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchFriends(): Promise<FriendsListResponse> {
  return request<FriendsListResponse>('/player/friends');
}

export async function addFriend(query: string): Promise<AddFriendResponse> {
  return request<AddFriendResponse>('/player/friends', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function fetchFriendAchievements(
  friendId: string,
): Promise<FriendAchievementsResponse> {
  const response = await request<FriendAchievementsResponse>(
    `/player/friends/${encodeURIComponent(friendId)}/achievements`,
  );

  return {
    ...response,
    avatars: Array.isArray(response.avatars) ? response.avatars : [],
    achievements: Array.isArray(response.achievements) ? response.achievements : [],
  };
}

export async function fetchAvatar(
  player: PlayerResponse | null,
): Promise<AvatarResponse> {
  void player;

  try {
    return await request<AvatarResponse>('/avatar/active');
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
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

  const params = new URLSearchParams({ avatarId: avatar.avatar.id });

  try {
    return await request<EncounterSnapshot>(
      `/encounter/active?${params.toString()}`,
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function fetchAvatars(): Promise<PersistedAvatar[]> {
  const response = await request<AvatarsResponse>('/avatars');
  return response.avatars.map((avatar) => normalizePersistedAvatar(avatar));
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

  return normalizePersistedAvatar(response.avatar);
}

export async function selectAvatar(
  avatar: PersistedAvatar,
): Promise<{ avatar: PersistedAvatar; encounter: EncounterSnapshot }> {
  const response = await request<{ avatar: PersistedAvatar; encounter: EncounterSnapshot }>('/avatar/select', {
    method: 'POST',
    body: JSON.stringify(avatar),
  });

  return {
    avatar: normalizePersistedAvatar(response.avatar),
    encounter: response.encounter,
  };
}

export async function deleteAvatar(avatarId: string): Promise<void> {
  await request<{ ok: true }>(`/avatar/${encodeURIComponent(avatarId)}`, {
    method: 'DELETE',
  });
}

export async function fetchOrCreateActiveEncounter(
  avatar: PersistedAvatar,
): Promise<EncounterSnapshot> {
  const params = new URLSearchParams({ avatarId: avatar.id });

  try {
    return await request<EncounterSnapshot>(`/encounter/active?${params.toString()}`);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 404) {
      throw error;
    }
  }

  return request<EncounterSnapshot>('/encounter/create', {
    method: 'POST',
    body: JSON.stringify({
      avatarId: avatar.id,
    }),
  });
}

export async function resolveEncounterAction(
  action: EncounterAction,
  avatarId: string,
): Promise<ResolveEncounterResponse> {
  const response = await request<ResolveEncounterResponse>('/encounter/continue', {
    method: 'POST',
    body: JSON.stringify({
      avatarId,
      action,
    }),
  });

  if (!response.avatar) {
    return response;
  }

  return {
    ...response,
    avatar: normalizePersistedAvatar(response.avatar),
  };
}

export async function clearEncounter(avatarId: string): Promise<void> {
  await request<{ ok: true }>('/encounter/clear', {
    method: 'POST',
    body: JSON.stringify({
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
      avatarId: avatar.id,
    }),
  });
}

export async function fetchRecentActivity(): Promise<ActivityFeedResponse> {
  return request<ActivityFeedResponse>('/activity/recent');
}

export async function fetchAchievements(): Promise<AchievementsResponse> {
  return request<AchievementsResponse>('/player/achievements');
}

export async function claimDailyReward(): Promise<ClaimDailyRewardResponse> {
  return request<ClaimDailyRewardResponse>('/player/daily-reward/claim', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
