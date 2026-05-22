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
import { loadAchievementProgress } from '../domain/achievements/achievementPersistence.js';
import {
  claimDailyReward,
  getDailyRewardStatus,
  type DailyRewardStatus,
} from '../domain/achievements/dailyRewardService.js';

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

export async function getAchievementsSnapshot(
  playerId: string,
): Promise<AchievementsSnapshot> {
  const [adventurerStored, alphaStored, alphaGlobal] = await Promise.all([
    loadAchievementProgress(playerId, ADVENTURER_ACHIEVEMENT_ID),
    loadAchievementProgress(playerId, ALPHA_PLAYER_ACHIEVEMENT_ID),
    loadAlphaPlayerGlobalState(),
  ]);
  const adventurerProgress = adventurerStored?.progress ?? 0;
  const alphaProgress = alphaStored?.progress ?? 0;
  const alphaLocked = isAlphaPlayerGloballyLocked(alphaGlobal);

  return {
    achievements: [
      buildAdventurerView(adventurerProgress),
      buildAlphaPlayerView(alphaProgress, alphaLocked),
    ],
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
