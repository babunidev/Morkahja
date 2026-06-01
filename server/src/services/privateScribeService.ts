import { recoveryKeyFilename } from '@shared/recoveryKeyFilename.js';
import { getPlayer, setPlayer } from '../db/postgresDocumentStore.js';
import type { PlayerDocument } from '../types/player.js';
import {
  recordAccountKeySecurityReminderEvent,
  recordSupportAppreciationNudgeEvent,
} from './gameEventService.js';

function utcDayKey(timestamp = Date.now()): string {
  return new Date(timestamp).toISOString().slice(0, 10);
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
