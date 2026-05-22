export interface PlayerDocument {
  playerId: string;
  playerName: string;
  identityPublicKey: string;
  activeSessionId: string | null;
  activeSessionExpiresAt: number | null;
  createdAt: number;
  lastPlayedAt: number;
  /** Account-wide expansion ids unlocked for all avatars. */
  unlockedExpansions: number[];
  /** Player ids added as friends (account-wide). */
  friendIds?: string[];
  activeAvatarId?: string;
  currencies?: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  loreGemClaims?: Record<string, boolean>;
  dailyReward?: {
    utcDay: string;
    encountersPlayed: number;
    claimedAt?: number;
  };
  [key: string]: unknown;
}
