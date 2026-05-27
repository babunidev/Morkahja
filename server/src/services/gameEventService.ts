import { randomUUID } from 'node:crypto';
import type { AvatarDocument } from '../types/avatar.js';
import { formatAvatarDisplayName, readAvatarDisplayTitle } from '../domain/achievements/achievementTitles.js';
import { recordWallOfFameEntry } from './playerProfileService.js';
import type { EncounterResolution } from '../engine/encounterResolver.js';
import type { RollOutcome } from '../engine/diceInterpreter.js';
import type { EncounterSnapshot } from '../types/encounterSnapshot.js';
import { ACTIVITY_FEED_WINDOW_MS, type GameEvent, type GameEventImportance } from '../domain/events/GameEvent.js';
import { gameEventBus } from '../domain/events/gameEventBus.js';
import { getPlayer } from '../db/postgresDocumentStore.js';
import { postgresEventStore } from '../db/gameEventPersistence.js';
import { renderEventMessage } from '../domain/news/renderEventMessage.js';
import { isVisibleInScribesFeed } from '../domain/news/scribesFeedFilter.js';
import {
  resolveScribesAvatarVisual,
  resolveScribesIconUrl,
} from '../domain/news/scribesFeedPresentation.js';
import type { PlayerDocument } from '../types/player.js';
import { getEncounterById, getSolutionMap } from './gameData.js';

const ATRANOR_DEATH_SYMBOL_SOLUTION_ID = 10015;

function atranorDeathSymbolIconName(): string | undefined {
  const solution = getSolutionMap()[String(ATRANOR_DEATH_SYMBOL_SOLUTION_ID)];
  const icon = solution?.mSolutionIconName;
  return typeof icon === 'string' && icon.length > 0 ? icon : undefined;
}

function withAtranorDeathSymbol(payload: Record<string, unknown>): Record<string, unknown> {
  const symbolIconName = atranorDeathSymbolIconName();
  return symbolIconName ? { ...payload, symbolIconName } : payload;
}

async function readPlayer(playerId: string): Promise<PlayerDocument | null> {
  const data = await getPlayer<Partial<PlayerDocument>>(playerId);
  if (!data) {
    return null;
  }

  return {
    ...data,
    playerId: typeof data.playerId === 'string' ? data.playerId : playerId,
    playerName: typeof data.playerName === 'string' ? data.playerName : playerId,
    identityPublicKey: typeof data.identityPublicKey === 'string' ? data.identityPublicKey : '',
    activeSessionId: typeof data.activeSessionId === 'string' ? data.activeSessionId : null,
    activeSessionExpiresAt: typeof data.activeSessionExpiresAt === 'number' ? data.activeSessionExpiresAt : null,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : Date.now(),
    lastPlayedAt: typeof data.lastPlayedAt === 'number' ? data.lastPlayedAt : Date.now(),
    unlockedExpansions: Array.isArray(data.unlockedExpansions)
      ? data.unlockedExpansions.filter((entry): entry is number => Number.isInteger(entry))
      : [0],
  };
}

type RecordGameEventInput = Omit<GameEvent, 'eventId' | 'timestamp'> & {
  timestamp?: number;
};

export interface ActivityFeedEntry {
  eventId: string;
  timestamp: number;
  authorName: string;
  message: string;
  importance: GameEventImportance;
  iconUrl?: string;
  avatarPortrait?: string;
  avatarFrame?: string;
}

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

async function buildPlayerNameLookup(playerIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(playerIds)];
  const pairs = await Promise.all(uniqueIds.map(async (playerId) => {
    const player = await readPlayer(playerId);
    const name = player?.playerName?.trim();

    return [playerId, name && name.length > 0 ? name : playerId] as const;
  }));

  return new Map(pairs);
}

function resolveEventAuthorName(event: GameEvent, playerNames: Map<string, string>): string {
  return payloadString(event.payload, 'playerName')
    ?? playerNames.get(event.playerId)
    ?? event.playerId;
}

export interface EncounterContinuedEventContext {
  resolvedEncounterId: number;
  resolvedEncounterTitle?: string;
  selectedRollOutcome: RollOutcome | null;
  leveledUp: boolean;
  deathTriggered: boolean;
  isDeathEncounterResolution: boolean;
}

export async function recordGameEvent(input: RecordGameEventInput): Promise<GameEvent> {
  const event: GameEvent = {
    eventId: randomUUID(),
    timestamp: input.timestamp ?? Date.now(),
    playerId: input.playerId,
    avatarId: input.avatarId,
    type: input.type,
    visibility: input.visibility,
    importance: input.importance,
    payload: input.payload,
  };

  await postgresEventStore.appendEvent(event);
  await gameEventBus.emit(event);
  return event;
}

function basePayload(
  playerName: string | undefined,
  avatar: Pick<AvatarDocument, 'id' | 'name' | 'race' | 'role' | 'portrait' | 'frame' | 'profile'>,
  encounterId?: number,
  encounterTitle?: string,
): Record<string, unknown> {
  return {
    playerName,
    avatarName: formatAvatarDisplayName(
      avatar.name?.trim() || 'Adventurer',
      readAvatarDisplayTitle(avatar),
    ),
    avatarId: avatar.id,
    race: avatar.race,
    role: avatar.role,
    ...(avatar.portrait ? { avatarPortrait: avatar.portrait } : {}),
    ...(avatar.frame ? { avatarFrame: avatar.frame } : {}),
    encounterId,
    encounterTitle,
  };
}

function solutionName(solutionId: number): string | undefined {
  const solution = getSolutionMap()[String(solutionId)];
  if (!solution) {
    return undefined;
  }

  const title = solution.mSolutionName;
  return typeof title === 'string' && title.length > 0 ? title : `Reward ${solutionId}`;
}

function resolveEncounterRewardDetails(rewardIds: number[]): {
  rewardNames: string[];
  rewardIconName?: string;
} {
  const rewardNames: string[] = [];
  let rewardIconName: string | undefined;

  for (const rewardId of rewardIds) {
    const solution = getSolutionMap()[String(rewardId)];
    const name = solutionName(rewardId);
    if (name) {
      rewardNames.push(name);
    }

    if (!rewardIconName && solution) {
      const icon = solution.mSolutionIconName;
      if (typeof icon === 'string' && icon.length > 0) {
        rewardIconName = icon;
      }
    }
  }

  return {
    rewardNames,
    ...(rewardIconName ? { rewardIconName } : {}),
  };
}

export async function recordAvatarCreatedEvent(
  playerId: string,
  avatar: AvatarDocument,
): Promise<void> {
  const player = await readPlayer(playerId);

  await recordGameEvent({
    playerId,
    avatarId: avatar.id,
    type: 'avatar_created',
    visibility: 'global',
    importance: 'medium',
    payload: basePayload(player?.playerName, avatar),
  });
}

export async function recordEncounterStartedEvent(
  playerId: string,
  avatar: AvatarDocument,
  snapshot: EncounterSnapshot,
): Promise<void> {
  const player = await readPlayer(playerId);
  const encounter = getEncounterById(snapshot.encounterId);

  await recordGameEvent({
    playerId,
    avatarId: avatar.id ?? snapshot.avatarId,
    type: 'encounter_started',
    visibility: 'global',
    importance: 'low',
    payload: {
      ...basePayload(
        player?.playerName,
        avatar,
        snapshot.encounterId,
        snapshot.encounterTitle ?? encounter?.mEncounterTitle,
      ),
    },
  });
}

export async function recordEncounterContinuedEvents(
  playerId: string,
  avatar: AvatarDocument,
  resolution: EncounterResolution,
  context: EncounterContinuedEventContext,
): Promise<void> {
  const player = await readPlayer(playerId);
  const avatarId = avatar.id;
  if (!avatarId) {
    return;
  }

  const encounter = getEncounterById(context.resolvedEncounterId);
  const encounterTitle = context.resolvedEncounterTitle
    ?? encounter?.mEncounterTitle;
  const payload = {
    ...basePayload(
      player?.playerName,
      avatar,
      context.resolvedEncounterId,
      encounterTitle,
    ),
    outcome: context.selectedRollOutcome ?? undefined,
    success: resolution.success,
    ...(typeof encounter?.mEncounterType === 'number'
      ? { encounterType: encounter.mEncounterType }
      : {}),
  };

  if (
    context.isDeathEncounterResolution &&
    (context.selectedRollOutcome === 'Misery' || context.selectedRollOutcome === 'Hardship')
  ) {
    await recordGameEvent({
      playerId,
      avatarId,
      type: 'avatar_died',
      visibility: 'global',
      importance: 'legendary',
      payload: withAtranorDeathSymbol({
        ...payload,
        actualDeath: true,
      }),
    });
    await recordWallOfFameEntry(playerId, avatar);
    return;
  }

  const resolvedPayload = resolution.success && resolution.rewards.length > 0
    ? {
      ...payload,
      ...resolveEncounterRewardDetails(resolution.rewards),
    }
    : payload;

  await recordGameEvent({
    playerId,
    avatarId,
    type: resolution.success ? 'encounter_resolved' : 'encounter_failed',
    visibility: 'global',
    importance: resolution.success ? 'medium' : 'medium',
    payload: resolvedPayload,
  });

  if (context.leveledUp) {
    await recordGameEvent({
      playerId,
      avatarId,
      type: 'level_up',
      visibility: 'global',
      importance: 'high',
      payload: {
        ...payload,
        level: avatar.level,
      },
    });
  }

  if (context.deathTriggered) {
    await recordGameEvent({
      playerId,
      avatarId,
      type: 'avatar_died',
      visibility: 'global',
      importance: 'legendary',
      payload: withAtranorDeathSymbol({
        ...payload,
        pendingDeathEncounter: true,
      }),
    });
  }

  if (!resolution.success) {
    return;
  }

  for (const rewardId of resolution.rewards) {
    const solution = getSolutionMap()[String(rewardId)];
    if (!solution) {
      continue;
    }

    await recordGameEvent({
      playerId,
      avatarId,
      type: 'item_obtained',
      visibility: 'global',
      importance: 'low',
      payload: {
        ...payload,
        solutionId: rewardId,
        solutionName: solutionName(rewardId),
        rewardType: solution.mSolutionRewardType,
        solutionIconName: solution.mSolutionIconName,
      },
    });
  }
}

export async function recordAchievementUnlockedEvent(
  playerId: string,
  payload: {
    achievementId: string;
    rank: number;
    rankTitle: string;
  },
): Promise<void> {
  const player = await readPlayer(playerId);

  await recordGameEvent({
    playerId,
    type: 'achievement_unlocked',
    visibility: 'global',
    importance: 'high',
    payload: {
      playerName: player?.playerName,
      achievementId: payload.achievementId,
      rank: payload.rank,
      rankTitle: payload.rankTitle,
    },
  });
}

export async function recordHearthBlessingReadyEvent(
  playerId: string,
  utcDay: string,
  encountersRequired: number,
): Promise<void> {
  const player = await readPlayer(playerId);

  await recordGameEvent({
    playerId,
    type: 'hearth_blessing_ready',
    visibility: 'global',
    importance: 'high',
    payload: {
      playerName: player?.playerName,
      utcDay,
      encountersRequired,
    },
  });
}

export async function recordDailyRewardClaimedEvent(
  playerId: string,
  gemAmount: number,
  utcDay: string,
): Promise<void> {
  const player = await readPlayer(playerId);

  await recordGameEvent({
    playerId,
    type: 'daily_reward_claimed',
    visibility: 'global',
    importance: 'high',
    payload: {
      playerName: player?.playerName,
      gemAmount,
      utcDay,
    },
  });
}

export async function recordGemsDonatedEvent(
  playerId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) {
    return;
  }

  const player = await readPlayer(playerId);

  await recordGameEvent({
    playerId,
    type: 'gems_donated',
    visibility: 'global',
    importance: 'high',
    payload: {
      playerName: player?.playerName,
      amount,
      currencyType: 'yellow_red_gem',
      source: 'credits_donate',
    },
  });
}

export async function recordGemsReceivedEvent(
  playerId: string,
  amount: number,
  options?: {
    encounterKey?: string;
    source?: 'lore_gem' | 'general';
  },
): Promise<void> {
  if (amount <= 0) {
    return;
  }

  const player = await readPlayer(playerId);

  await recordGameEvent({
    playerId,
    type: 'gems_received',
    visibility: 'global',
    importance: 'high',
    payload: {
      playerName: player?.playerName,
      amount,
      currencyType: 'yellow_red_gem',
      source: options?.source ?? 'general',
      encounterKey: options?.encounterKey,
    },
  });
}

export async function queryActivityFeed(playerId: string): Promise<ActivityFeedEntry[]> {
  const sinceTimestamp = Date.now() - ACTIVITY_FEED_WINDOW_MS;
  const events = await postgresEventStore.queryRecentEvents({
    playerId,
    sinceTimestamp,
    limit: 50,
  });

  const visibleEvents = events.filter((event) => isVisibleInScribesFeed(event, playerId));
  const playerNames = await buildPlayerNameLookup(visibleEvents.map((event) => event.playerId));

  return visibleEvents.map((event) => {
    const avatarVisual = resolveScribesAvatarVisual(event);

    return {
      eventId: event.eventId,
      timestamp: event.timestamp,
      authorName: resolveEventAuthorName(event, playerNames),
      message: renderEventMessage(event),
      importance: event.importance,
      iconUrl: resolveScribesIconUrl(event),
      avatarPortrait: avatarVisual?.portrait,
      avatarFrame: avatarVisual?.frame,
    };
  });
}
