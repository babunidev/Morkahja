export interface AchievementProgress {
  achievementId: string;
  playerId: string;
  rank: number;
  progress: number;
  updatedAt: number;
  unlockedAt?: number;
}
