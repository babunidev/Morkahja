import {
  countAvatarsByPlayerIds,
  deleteSession,
  listActiveAvatarsForPlayers,
  listAllPlayers,
  setPlayer,
} from '../db/postgresDocumentStore.js';
import { ACTIVITY_FEED_WINDOW_MS } from '../domain/events/GameEvent.js';
import { renderEventMessage } from '../domain/news/renderEventMessage.js';
import { postgresEventStore } from '../db/gameEventPersistence.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument } from '../types/player.js';

export interface AdminPlayerDto {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'banned' | 'timed_out';
  level: number;
  realm: string;
  lastSeen: string;
  isOnline: boolean;
  activeAvatar?: string;
  timeoutUntil?: string | null;
  banReason?: string;
  avatarCount?: number;
  createdAt?: string;
}

export interface AdminActivityDto {
  id: string;
  timestamp: string;
  playerName: string;
  message: string;
  importance: 'low' | 'normal' | 'high';
  category: 'encounter' | 'moderation' | 'social' | 'system';
}

export interface AdminDashboardDto {
  onlinePlayers: number;
  timedOutPlayers: number;
  bannedPlayers: number;
  eventsToday: number;
  serverUptime: string;
}

const SERVER_STARTED_AT = Date.now();

function isTimedOut(player: PlayerDocument, now: number): boolean {
  const until = player.moderation?.timeoutUntil;
  return typeof until === 'number' && until > now;
}

function isBanned(player: PlayerDocument): boolean {
  return player.moderation?.banned === true;
}

function isOnline(player: PlayerDocument, now: number): boolean {
  return typeof player.activeSessionExpiresAt === 'number'
    && player.activeSessionExpiresAt > now
    && !isBanned(player)
    && !isTimedOut(player, now);
}

function resolveStatus(player: PlayerDocument, now: number): AdminPlayerDto['status'] {
  if (isBanned(player)) return 'banned';
  if (isTimedOut(player, now)) return 'timed_out';
  if (isOnline(player, now)) return 'online';
  return 'offline';
}

function formatRealm(avatar?: AvatarDocument): string {
  if (!avatar) return '—';
  const race = avatar.race ?? 'Unknown';
  const role = avatar.role ?? 'Unknown';
  return `${race} · ${role}`;
}

function toAdminPlayer(
  player: PlayerDocument,
  activeAvatar?: AvatarDocument,
  avatarCount = 0,
): AdminPlayerDto {
  const now = Date.now();
  const status = resolveStatus(player, now);

  return {
    id: player.playerId,
    name: player.playerName,
    status,
    level: typeof activeAvatar?.level === 'number' ? activeAvatar.level : 1,
    realm: formatRealm(activeAvatar),
    lastSeen: new Date(player.lastPlayedAt ?? player.createdAt ?? now).toISOString(),
    isOnline: status === 'online',
    activeAvatar: activeAvatar?.name,
    timeoutUntil:
      typeof player.moderation?.timeoutUntil === 'number'
        ? new Date(player.moderation.timeoutUntil).toISOString()
        : null,
    banReason: player.moderation?.banReason,
    avatarCount,
    createdAt: new Date(player.createdAt ?? now).toISOString(),
  };
}

export async function listAdminPlayers(): Promise<AdminPlayerDto[]> {
  const rows = await listAllPlayers<PlayerDocument>();
  const playerIds = rows.map((row) => row.id);
  const [activeAvatars, avatarCounts] = await Promise.all([
    listActiveAvatarsForPlayers<AvatarDocument>(playerIds),
    countAvatarsByPlayerIds(playerIds),
  ]);

  const players = rows.map((row) => {
    const active = activeAvatars.get(row.id);
    return toAdminPlayer(
      { ...row.data, playerId: row.id },
      active?.data,
      avatarCounts.get(row.id) ?? 0,
    );
  });

  return players.sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    const statusRank: Record<AdminPlayerDto['status'], number> = {
      online: 0,
      offline: 1,
      timed_out: 2,
      banned: 3,
    };
    const statusDiff = statusRank[a.status] - statusRank[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
  });
}

export async function listOnlineAdminPlayers(): Promise<AdminPlayerDto[]> {
  const players = await listAdminPlayers();
  return players.filter((player) => player.isOnline);
}

export async function getAdminDashboard(): Promise<AdminDashboardDto> {
  const players = await listAdminPlayers();
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const events = await postgresEventStore.queryRecentEvents({
    sinceTimestamp: since,
    limit: 100,
  });

  const uptimeMs = Date.now() - SERVER_STARTED_AT;
  const uptimeHours = Math.floor(uptimeMs / 3_600_000);
  const uptimeDays = Math.floor(uptimeHours / 24);

  return {
    onlinePlayers: players.filter((player) => player.isOnline).length,
    timedOutPlayers: players.filter((player) => player.status === 'timed_out').length,
    bannedPlayers: players.filter((player) => player.status === 'banned').length,
    eventsToday: events.length,
    serverUptime: uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours % 24}h` : `${uptimeHours}h`,
  };
}

function mapImportance(
  importance: string,
): AdminActivityDto['importance'] {
  if (importance === 'high' || importance === 'legendary') return 'high';
  if (importance === 'low') return 'low';
  return 'normal';
}

function mapCategory(type: string): AdminActivityDto['category'] {
  if (type.includes('encounter') || type.includes('roll')) return 'encounter';
  if (type.includes('friend')) return 'social';
  if (type.includes('ban') || type.includes('moderation')) return 'moderation';
  return 'system';
}

export async function listAdminActivity(): Promise<AdminActivityDto[]> {
  const sinceTimestamp = Date.now() - ACTIVITY_FEED_WINDOW_MS;
  const events = await postgresEventStore.queryRecentEvents({
    sinceTimestamp,
    limit: 50,
  });

  return events.map((event) => ({
    id: event.eventId,
    timestamp: new Date(event.timestamp).toISOString(),
    playerName:
      typeof event.payload.playerName === 'string'
        ? event.payload.playerName
        : event.playerId,
    message: renderEventMessage(event),
    importance: mapImportance(event.importance),
    category: mapCategory(event.type),
  }));
}

async function disconnectPlayer(player: PlayerDocument): Promise<void> {
  if (player.activeSessionId) {
    await deleteSession(player.activeSessionId);
  }

  await setPlayer(
    player.playerId,
    {
      activeSessionId: null,
      activeSessionExpiresAt: null,
    },
    { merge: true },
  );
}

export async function timeoutAdminPlayer(
  playerId: string,
  durationMinutes: number,
  reason?: string,
): Promise<AdminPlayerDto | null> {
  const rows = await listAllPlayers<PlayerDocument>();
  const row = rows.find((entry) => entry.id === playerId);
  if (!row) return null;

  const player = row.data;
  const timeoutUntil = Date.now() + durationMinutes * 60_000;

  await disconnectPlayer(player);
  await setPlayer(
    playerId,
    {
      moderation: {
        ...player.moderation,
        banned: false,
        timeoutUntil,
        banReason: reason?.trim() || player.moderation?.banReason,
      },
    },
    { merge: true },
  );

  const players = await listAdminPlayers();
  return players.find((entry) => entry.id === playerId) ?? null;
}

export async function banAdminPlayer(
  playerId: string,
  reason?: string,
): Promise<AdminPlayerDto | null> {
  const rows = await listAllPlayers<PlayerDocument>();
  const row = rows.find((entry) => entry.id === playerId);
  if (!row) return null;

  const player = row.data;
  await disconnectPlayer(player);
  await setPlayer(
    playerId,
    {
      moderation: {
        ...player.moderation,
        banned: true,
        banReason: reason?.trim() || 'Banned by admin',
        timeoutUntil: null,
      },
    },
    { merge: true },
  );

  const players = await listAdminPlayers();
  return players.find((entry) => entry.id === playerId) ?? null;
}

export async function unbanAdminPlayer(playerId: string): Promise<AdminPlayerDto | null> {
  const rows = await listAllPlayers<PlayerDocument>();
  const row = rows.find((entry) => entry.id === playerId);
  if (!row) return null;

  const player = row.data;
  await setPlayer(
    playerId,
    {
      moderation: {
        ...player.moderation,
        banned: false,
        banReason: undefined,
      },
    },
    { merge: true },
  );

  const players = await listAdminPlayers();
  return players.find((entry) => entry.id === playerId) ?? null;
}

export function assertPlayerCanPlay(player: PlayerDocument): void {
  const now = Date.now();
  if (isBanned(player)) {
    throw new Error('PLAYER_BANNED');
  }
  if (isTimedOut(player, now)) {
    throw new Error('PLAYER_TIMED_OUT');
  }
}
