import {
  achievementRankFromProgress,
  loadAllAchievementProgressForPlayer,
} from './achievementPersistence.js';
import type { AchievementProgress } from './achievementProgress.js';
import type { AchievementTitleSource } from './achievementTitles.js';
import {
  ADVENTURER_ACHIEVEMENT_ID,
  ADVENTURER_RANKS,
} from './adventurerAchievement.js';
import {
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  ALPHA_PLAYER_CHAIN_TITLE,
  ALPHA_PLAYER_RANKS,
} from './alphaPlayerAchievement.js';
import {
  BLESSED_ACHIEVEMENT_ID,
  BLESSED_RANKS,
} from './blessedAchievement.js';
import {
  CONTRIBUTOR_ACHIEVEMENT_ID,
  CONTRIBUTOR_RANKS,
} from './contributorAchievement.js';
import {
  ENCOUNTER_SOLVE_ACHIEVEMENTS,
} from './encounterSolveAchievements.js';
import {
  FIRESTARTER_ACHIEVEMENT_ID,
  FIRESTARTER_RANKS,
} from './firestarterAchievement.js';
import { loadFirestarterState } from './firestarterProgress.js';
import {
  SPIRITGUIDE_ACHIEVEMENT_ID,
  SPIRITGUIDE_CHAIN_TITLE,
  SPIRITGUIDE_RANKS,
} from './spiritguideAchievement.js';

function readStoredRecord(
  records: AchievementProgress[],
  achievementId: string,
): AchievementProgress | undefined {
  return records.find((record) => record.achievementId === achievementId);
}

function readProgress(records: AchievementProgress[], achievementId: string): number {
  return Math.max(0, readStoredRecord(records, achievementId)?.progress ?? 0);
}

function effectiveRank(
  achievementId: string,
  stored: AchievementProgress | undefined,
  progress: number,
): number {
  const computed = achievementRankFromProgress(achievementId, progress);
  return Math.max(stored?.rank ?? 0, computed);
}

function mapRanks(
  ranks: Array<{ rank: number; title: string }>,
): AchievementTitleSource['ranks'] {
  return ranks.map((entry) => ({
    rank: entry.rank,
    title: entry.title,
  }));
}

function pushIfStarted(
  sources: AchievementTitleSource[],
  source: AchievementTitleSource,
): void {
  if (source.progress > 0 || source.rank > 0) {
    sources.push(source);
  }
}

export async function loadAchievementTitleSourcesForPlayer(
  playerId: string,
): Promise<AchievementTitleSource[]> {
  const [records, firestarter] = await Promise.all([
    loadAllAchievementProgressForPlayer(playerId),
    loadFirestarterState(playerId),
  ]);

  const sources: AchievementTitleSource[] = [];

  const adventurerProgress = readProgress(records, ADVENTURER_ACHIEVEMENT_ID);
  pushIfStarted(sources, {
    achievementId: ADVENTURER_ACHIEVEMENT_ID,
    progress: adventurerProgress,
    rank: effectiveRank(
      ADVENTURER_ACHIEVEMENT_ID,
      readStoredRecord(records, ADVENTURER_ACHIEVEMENT_ID),
      adventurerProgress,
    ),
    chainTitle: ADVENTURER_RANKS[0]?.title,
    ranks: mapRanks(ADVENTURER_RANKS),
  });

  pushIfStarted(sources, {
    achievementId: FIRESTARTER_ACHIEVEMENT_ID,
    progress: Math.max(firestarter.avatarCount, firestarter.totalLevels),
    rank: firestarter.rank,
    chainTitle: FIRESTARTER_RANKS[0]?.title,
    ranks: mapRanks(FIRESTARTER_RANKS),
  });

  const blessedProgress = readProgress(records, BLESSED_ACHIEVEMENT_ID);
  pushIfStarted(sources, {
    achievementId: BLESSED_ACHIEVEMENT_ID,
    progress: blessedProgress,
    rank: effectiveRank(
      BLESSED_ACHIEVEMENT_ID,
      readStoredRecord(records, BLESSED_ACHIEVEMENT_ID),
      blessedProgress,
    ),
    chainTitle: 'Blessed',
    ranks: mapRanks(BLESSED_RANKS),
  });

  for (const config of ENCOUNTER_SOLVE_ACHIEVEMENTS) {
    const configProgress = readProgress(records, config.achievementId);
    pushIfStarted(sources, {
      achievementId: config.achievementId,
      progress: configProgress,
      rank: effectiveRank(
        config.achievementId,
        readStoredRecord(records, config.achievementId),
        configProgress,
      ),
      chainTitle: config.chainTitle,
      ranks: mapRanks(config.ranks),
    });
  }

  const contributorProgress = readProgress(records, CONTRIBUTOR_ACHIEVEMENT_ID);
  pushIfStarted(sources, {
    achievementId: CONTRIBUTOR_ACHIEVEMENT_ID,
    progress: contributorProgress,
    rank: effectiveRank(
      CONTRIBUTOR_ACHIEVEMENT_ID,
      readStoredRecord(records, CONTRIBUTOR_ACHIEVEMENT_ID),
      contributorProgress,
    ),
    chainTitle: CONTRIBUTOR_RANKS[0]?.title,
    ranks: mapRanks(CONTRIBUTOR_RANKS),
  });

  const spiritguideProgress = readProgress(records, SPIRITGUIDE_ACHIEVEMENT_ID);
  pushIfStarted(sources, {
    achievementId: SPIRITGUIDE_ACHIEVEMENT_ID,
    progress: spiritguideProgress,
    rank: effectiveRank(
      SPIRITGUIDE_ACHIEVEMENT_ID,
      readStoredRecord(records, SPIRITGUIDE_ACHIEVEMENT_ID),
      spiritguideProgress,
    ),
    chainTitle: SPIRITGUIDE_CHAIN_TITLE,
    ranks: mapRanks(SPIRITGUIDE_RANKS),
  });

  const alphaProgress = readProgress(records, ALPHA_PLAYER_ACHIEVEMENT_ID);
  pushIfStarted(sources, {
    achievementId: ALPHA_PLAYER_ACHIEVEMENT_ID,
    progress: alphaProgress,
    rank: effectiveRank(
      ALPHA_PLAYER_ACHIEVEMENT_ID,
      readStoredRecord(records, ALPHA_PLAYER_ACHIEVEMENT_ID),
      alphaProgress,
    ),
    chainTitle: ALPHA_PLAYER_CHAIN_TITLE,
    ranks: mapRanks(ALPHA_PLAYER_RANKS),
  });

  return sources;
}
