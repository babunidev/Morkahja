import { recoveryKeyFilename } from '@shared/recoveryKeyFilename.js';
import { getPlayer, listAvatars, setPlayer } from '../db/postgresDocumentStore.js';
import type { AvatarDocument } from '../types/avatar.js';
import type { PlayerDocument } from '../types/player.js';
import {
  recordAccountKeySecurityReminderEvent,
  recordSupportAppreciationNudgeEvent,
} from './gameEventService.js';

const SUPPORT_NUDGE_MIN_PLAY_TIME_MS = 15 * 60 * 1000;

function utcDayKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function earliestAvatarCreatedAt(
  avatars: Array<{ id: string; data: Partial<AvatarDocument> }>,
): number | null {
  let earliest: number | null = null;

  for (const avatar of avatars) {
    const createdAt = avatar.data.createdAt;
    if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
      continue;
    }

    if (earliest === null || createdAt < earliest) {
      earliest = createdAt;
    }
  }

  return earliest;
}

function isSupportNudgePlayTimeEligible(
  earliestAvatarCreatedAt: number | null,
  timestamp: number,
): boolean {
  if (earliestAvatarCreatedAt === null) {
    return true;
  }

  return timestamp >= earliestAvatarCreatedAt + SUPPORT_NUDGE_MIN_PLAY_TIME_MS;
}

async function readPlayerName(playerId: string): Promise<string> {
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const name = player?.playerName?.trim();
  return name && name.length > 0 ? name : playerId;
}

export async function recordAccountKeySecurityReminder(
  playerId: string,
  options?: {
    itemLabel?: string;
  },
): Promise<void> {
  const playerName = await readPlayerName(playerId);

  await recordAccountKeySecurityReminderEvent(playerId, {
    playerName,
    recoveryKeyFilename: recoveryKeyFilename(playerName),
    ...(options?.itemLabel ? { itemLabel: options.itemLabel } : {}),
  });
}

export async function ensureDailySupportAppreciationNudge(
  playerId: string,
  timestamp = Date.now(),
): Promise<void> {
  const utcDay = utcDayKey(timestamp);
  const player = await getPlayer<Partial<PlayerDocument>>(playerId);
  const storedDay = player?.scribeNudges?.supportReminderUtcDay;

  if (storedDay === utcDay) {
    return;
  }

  const avatars = await listAvatars<Partial<AvatarDocument>>(playerId);
  if (avatars.length === 0) {
    return;
  }

  const firstAvatarAt = earliestAvatarCreatedAt(avatars);
  if (!isSupportNudgePlayTimeEligible(firstAvatarAt, timestamp)) {
    return;
  }

  const playerName = await readPlayerName(playerId);

  await recordSupportAppreciationNudgeEvent(playerId, {
    playerName,
    utcDay,
  });

  await setPlayer(
    playerId,
    {
      scribeNudges: {
        ...(player?.scribeNudges ?? {}),
        supportReminderUtcDay: utcDay,
      },
      updatedAt: timestamp,
    },
    { merge: true },
  );
}
