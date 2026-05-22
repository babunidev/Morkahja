import {
  ALPHA_PLAYER_ACHIEVEMENT_ID,
  ALPHA_PLAYER_BASE_ICON,
  ALPHA_PLAYER_CHAIN_TEXT,
  ALPHA_PLAYER_CHAIN_TITLE,
  ALPHA_PLAYER_RANKS,
  alphaPlayerProgressBand,
  alphaPlayerRankDefinition,
  alphaPlayerRankFromProgress,
} from '../domain/achievements/alphaPlayerAchievement.js';
import {
  isAlphaPlayerGloballyLocked,
  loadAlphaPlayerGlobalState,
} from '../domain/achievements/alphaPlayerGlobalLock.js';
import {
  ADVENTURER_ACHIEVEMENT_ID,
  ADVENTURER_BASE_ICON,
  ADVENTURER_RANKS,
  adventurerProgressBand,
  adventurerRankDefinition,
  adventurerRankFromProgress,
} from '../domain/achievements/adventurerAchievement.js';
import {
  loadAchievementProgress,
  reconcileAchievementProgress,
} from '../domain/achievements/achievementPersistence.js';
import {
  claimDailyReward,
  getDailyRewardStatus,
  type DailyRewardStatus,
} from '../domain/achievements/dailyRewardService.js';
import {
  FIRESTARTER_ACHIEVEMENT_ID,
  FIRESTARTER_BASE_ICON,
  FIRESTARTER_RANKS,
  firestarterProgressBand,
  firestarterRankDefinition,
} from '../domain/achievements/firestarterAchievement.js';
import { syncFirestarterAchievementProgress } from '../domain/achievements/firestarterProgress.js';
import {
  CONTRIBUTOR_ACHIEVEMENT_ID,
  CONTRIBUTOR_BASE_ICON,
  CONTRIBUTOR_RANKS,
  contributorProgressBand,
  contributorRankDefinition,
  contributorRankFromProgress,
} from '../domain/achievements/contributorAchievement.js';
import {
  BLESSED_ACHIEVEMENT_ID,
  BLESSED_BASE_ICON,
  BLESSED_CHAIN_TEXT,
  BLESSED_RANKS,
  blessedProgressBand,
  blessedRankDefinition,
  blessedRankFromProgress,
} from '../domain/achievements/blessedAchievement.js';
import {
  ENCOUNTER_SOLVE_ACHIEVEMENTS,
  type EncounterSolveAchievementConfig,
  encounterSolveProgressBand,
  encounterSolveRankDefinition,
  encounterSolveRankFromProgress,
} from '../domain/achievements/encounterSolveAchievements.js';

export interface AchievementRankView {
  rank: number;
  title: string;
  text: string;
  rankOverlayUrl?: string;
}

export interface AchievementProgressView {
  achievementId: string;
  rank: number;
  progress: number;
  bandStart: number;
  bandEnd: number | null;
  progressInBand: number;
  baseIconUrl: string;
  rankOverlayUrl?: string;
  title: string;
  text: string;
  ranks: AchievementRankView[];
  chainTitle?: string;
  globallyLocked?: boolean;
}

export interface AchievementsSnapshot {
  achievements: AchievementProgressView[];
  dailyReward: DailyRewardStatus;
}

function toPublicPath(relativePath: string): string {
  return `/${relativePath.replace(/^\/+/, '')}`;
}

/** Hide achievement chains until the player has started them. */
function isAchievementVisible(achievement: AchievementProgressView): boolean {
  return achievement.progress > 0 || achievement.rank > 0;
}

function buildAdventurerView(progress: number): AchievementProgressView {
  const rank = adventurerRankFromProgress(progress);
  const rankDefinition = adventurerRankDefinition(rank);
  const band = adventurerProgressBand(progress);
  const fallback = ADVENTURER_RANKS[0];

  return {
    achievementId: ADVENTURER_ACHIEVEMENT_ID,
    rank,
    progress,
    bandStart: band.bandStart,
    bandEnd: band.bandEnd,
    progressInBand: band.progressInBand,
    baseIconUrl: toPublicPath(ADVENTURER_BASE_ICON),
    rankOverlayUrl: rankDefinition?.rankOverlayPath
      ? toPublicPath(rankDefinition.rankOverlayPath)
      : undefined,
    title: rankDefinition?.title ?? fallback.title,
    text: rankDefinition?.text ?? fallback.text,
    ranks: ADVENTURER_RANKS.map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      text: entry.text,
      rankOverlayUrl: entry.rankOverlayPath
        ? toPublicPath(entry.rankOverlayPath)
        : undefined,
    })),
  };
}

function buildFirestarterView(
  avatarCount: number,
  totalLevels: number,
  rank: number,
): AchievementProgressView {
  const rankDefinition = firestarterRankDefinition(rank);
  const band = firestarterProgressBand(avatarCount, totalLevels);
  const fallback = FIRESTARTER_RANKS[0];

  return {
    achievementId: FIRESTARTER_ACHIEVEMENT_ID,
    rank,
    progress: rank >= 3 ? totalLevels : avatarCount,
    bandStart: band.bandStart,
    bandEnd: band.bandEnd,
    progressInBand: band.progressInBand,
    baseIconUrl: toPublicPath(FIRESTARTER_BASE_ICON),
    rankOverlayUrl: rankDefinition?.rankOverlayPath
      ? toPublicPath(rankDefinition.rankOverlayPath)
      : undefined,
    title: rankDefinition?.title ?? fallback.title,
    text: rankDefinition?.text ?? fallback.text,
    ranks: FIRESTARTER_RANKS.map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      text: entry.text,
      rankOverlayUrl: entry.rankOverlayPath
        ? toPublicPath(entry.rankOverlayPath)
        : undefined,
    })),
  };
}

function buildEncounterSolveView(
  config: EncounterSolveAchievementConfig,
  progress: number,
): AchievementProgressView {
  const rank = encounterSolveRankFromProgress(config, progress);
  const rankDefinition = encounterSolveRankDefinition(config, rank);
  const band = encounterSolveProgressBand(progress);
  const fallback = config.ranks[0];

  return {
    achievementId: config.achievementId,
    rank,
    progress,
    bandStart: band.bandStart,
    bandEnd: band.bandEnd,
    progressInBand: band.progressInBand,
    baseIconUrl: toPublicPath(config.baseIcon),
    rankOverlayUrl: rankDefinition?.rankOverlayPath
      ? toPublicPath(rankDefinition.rankOverlayPath)
      : undefined,
    title: rankDefinition?.title ?? (rank > 0 ? fallback.title : config.chainTitle),
    text: rankDefinition?.text ?? (rank > 0 ? fallback.text : config.chainText),
    ranks: config.ranks.map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      text: entry.text,
      rankOverlayUrl: entry.rankOverlayPath
        ? toPublicPath(entry.rankOverlayPath)
        : undefined,
    })),
  };
}

function buildBlessedView(progress: number): AchievementProgressView {
  const rank = blessedRankFromProgress(progress);
  const rankDefinition = blessedRankDefinition(rank);
  const band = blessedProgressBand(progress);
  const fallback = BLESSED_RANKS[0];

  return {
    achievementId: BLESSED_ACHIEVEMENT_ID,
    rank,
    progress,
    bandStart: band.bandStart,
    bandEnd: band.bandEnd,
    progressInBand: band.progressInBand,
    baseIconUrl: toPublicPath(BLESSED_BASE_ICON),
    rankOverlayUrl: rankDefinition?.rankOverlayPath
      ? toPublicPath(rankDefinition.rankOverlayPath)
      : undefined,
    title: rankDefinition?.title ?? (rank > 0 ? fallback.title : 'Blessed'),
    text: rankDefinition?.text ?? (rank > 0 ? fallback.text : BLESSED_CHAIN_TEXT),
    ranks: BLESSED_RANKS.map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      text: entry.text,
      rankOverlayUrl: entry.rankOverlayPath
        ? toPublicPath(entry.rankOverlayPath)
        : undefined,
    })),
  };
}

function buildContributorView(progress: number): AchievementProgressView {
  const rank = contributorRankFromProgress(progress);
  const rankDefinition = contributorRankDefinition(rank);
  const band = contributorProgressBand(progress);
  const fallback = CONTRIBUTOR_RANKS[0];

  return {
    achievementId: CONTRIBUTOR_ACHIEVEMENT_ID,
    rank,
    progress,
    bandStart: band.bandStart,
    bandEnd: band.bandEnd,
    progressInBand: band.progressInBand,
    baseIconUrl: toPublicPath(CONTRIBUTOR_BASE_ICON),
    rankOverlayUrl: rankDefinition?.rankOverlayPath
      ? toPublicPath(rankDefinition.rankOverlayPath)
      : undefined,
    title: rankDefinition?.title ?? fallback.title,
    text: rankDefinition?.text ?? fallback.text,
    ranks: CONTRIBUTOR_RANKS.map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      text: entry.text,
      rankOverlayUrl: entry.rankOverlayPath
        ? toPublicPath(entry.rankOverlayPath)
        : undefined,
    })),
  };
}

function buildAlphaPlayerView(
  progress: number,
  globallyLocked: boolean,
): AchievementProgressView {
  const rank = alphaPlayerRankFromProgress(progress);
  const rankDefinition = alphaPlayerRankDefinition(rank);
  const band = alphaPlayerProgressBand(progress);

  return {
    achievementId: ALPHA_PLAYER_ACHIEVEMENT_ID,
    rank,
    progress,
    bandStart: band.bandStart,
    bandEnd: band.bandEnd,
    progressInBand: band.progressInBand,
    baseIconUrl: toPublicPath(ALPHA_PLAYER_BASE_ICON),
    rankOverlayUrl: rankDefinition?.rankOverlayPath
      ? toPublicPath(rankDefinition.rankOverlayPath)
      : undefined,
    chainTitle: ALPHA_PLAYER_CHAIN_TITLE,
    globallyLocked,
    title: rankDefinition?.title ?? ALPHA_PLAYER_CHAIN_TITLE,
    text: rankDefinition?.text ?? ALPHA_PLAYER_CHAIN_TEXT,
    ranks: ALPHA_PLAYER_RANKS.map((entry) => ({
      rank: entry.rank,
      title: entry.title,
      text: entry.text,
      rankOverlayUrl: entry.rankOverlayPath
        ? toPublicPath(entry.rankOverlayPath)
        : undefined,
    })),
  };
}

async function loadSyncedAchievementProgress(
  playerId: string,
  achievementId: string,
): Promise<number> {
  const stored = await loadAchievementProgress(playerId, achievementId);

  if (!stored) {
    return 0;
  }

  const synced = await reconcileAchievementProgress(stored);
  return synced.progress;
}

export async function getAchievementsSnapshot(
  playerId: string,
): Promise<AchievementsSnapshot> {
  const [
    adventurerProgress,
    firestarterState,
    blessedProgress,
    combatantProgress,
    tricksterProgress,
    helperProgress,
    contributorProgress,
    alphaProgress,
    alphaGlobal,
  ] = await Promise.all([
    loadSyncedAchievementProgress(playerId, ADVENTURER_ACHIEVEMENT_ID),
    syncFirestarterAchievementProgress(playerId),
    loadSyncedAchievementProgress(playerId, BLESSED_ACHIEVEMENT_ID),
    loadSyncedAchievementProgress(playerId, ENCOUNTER_SOLVE_ACHIEVEMENTS[0].achievementId),
    loadSyncedAchievementProgress(playerId, ENCOUNTER_SOLVE_ACHIEVEMENTS[1].achievementId),
    loadSyncedAchievementProgress(playerId, ENCOUNTER_SOLVE_ACHIEVEMENTS[2].achievementId),
    loadSyncedAchievementProgress(playerId, CONTRIBUTOR_ACHIEVEMENT_ID),
    loadSyncedAchievementProgress(playerId, ALPHA_PLAYER_ACHIEVEMENT_ID),
    loadAlphaPlayerGlobalState(),
  ]);
  const alphaLocked = isAlphaPlayerGloballyLocked(alphaGlobal);

  const allAchievements = [
    buildAdventurerView(adventurerProgress),
    buildFirestarterView(
      firestarterState.avatarCount,
      firestarterState.totalLevels,
      firestarterState.rank,
    ),
    buildBlessedView(blessedProgress),
    buildEncounterSolveView(ENCOUNTER_SOLVE_ACHIEVEMENTS[0], combatantProgress),
    buildEncounterSolveView(ENCOUNTER_SOLVE_ACHIEVEMENTS[1], tricksterProgress),
    buildEncounterSolveView(ENCOUNTER_SOLVE_ACHIEVEMENTS[2], helperProgress),
    buildContributorView(contributorProgress),
    buildAlphaPlayerView(alphaProgress, alphaLocked),
  ];

  return {
    achievements: allAchievements.filter(isAchievementVisible),
    dailyReward: await getDailyRewardStatus(playerId),
  };
}

export async function claimPlayerDailyReward(playerId: string): Promise<{
  achievements: AchievementsSnapshot;
  granted: boolean;
  currencies: { yellow_red_gem: number; [key: string]: number | undefined };
}> {
  const claim = await claimDailyReward(playerId);
  const snapshot = await getAchievementsSnapshot(playerId);

  return {
    achievements: snapshot,
    granted: claim.granted,
    currencies: {
      ...claim.currencies,
      yellow_red_gem: claim.currencies.yellow_red_gem ?? 0,
    },
  };
}
