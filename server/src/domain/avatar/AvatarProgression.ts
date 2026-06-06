import type { RollOutcome } from '../../engine/diceInterpreter.js';

export interface AvatarProgression {
  level: number;
  experience: number;
  encountersCompleted: number;
  encountersFailed: number;
  createdAt: number;
  lastPlayedAt: number;
  /** Set when XP commits a new level; cleared when level-up rewards are granted. */
  pendingLevelUpRewards?: boolean;
}

export function applyPendingLevelUpRewardsFlag(
  progression: AvatarProgression,
  options: {
    leveledUp: boolean;
    resolvedEncounterId: number;
    levelUpEncounterId: number;
  },
): AvatarProgression {
  if (options.resolvedEncounterId === options.levelUpEncounterId) {
    return { ...progression, pendingLevelUpRewards: false };
  }

  if (options.leveledUp) {
    return { ...progression, pendingLevelUpRewards: true };
  }

  return progression;
}

export function createInitialProgression(now = Date.now()): AvatarProgression {
  return {
    level: 1,
    experience: 0,
    encountersCompleted: 0,
    encountersFailed: 0,
    createdAt: now,
    lastPlayedAt: now,
  };
}

export function experienceRequiredForNextLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) {
    throw new Error(`Invalid avatar level: ${level}`);
  }

  return 7 * 2 ** (level - 1);
}

export function applyExperience(
  progress: AvatarProgression,
  gainedXP: number,
): AvatarProgression {
  if (!Number.isInteger(gainedXP) || gainedXP < 0) {
    throw new Error(`Invalid gained XP: ${gainedXP}`);
  }

  const next: AvatarProgression = {
    ...progress,
    experience: progress.experience + gainedXP,
  };

  while (next.experience >= experienceRequiredForNextLevel(next.level)) {
    next.experience -= experienceRequiredForNextLevel(next.level);
    next.level += 1;
  }

  return next;
}

export function experienceForSelectedRollOutcome(
  outcome: RollOutcome | null,
): number {
  const prosperityBonus = outcome === 'Prosperity' ? 1 : 0;
  const miseryBonus = outcome === 'Misery' ? 1 : 0;

  return 1 + prosperityBonus + miseryBonus;
}
