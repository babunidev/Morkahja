export interface WallOfFameEntry {
  id: string;
  name: string;
  race: 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';
  role: 'Mage' | 'Warrior' | 'Rogue';
  level: number;
  portrait: string;
  frame: string;
  encountersPlayed: number;
  diedAt: number;
}

export interface PlayerModeration {
  banned?: boolean;
  banReason?: string;
  /** Epoch ms — player cannot play until this time */
  timeoutUntil?: number | null;
}

export interface PlayerDocument {
  playerId: string;
  playerName: string;
  identityPublicKey: string;
  activeSessionId: string | null;
  activeSessionExpiresAt: number | null;
  moderation?: PlayerModeration;
  createdAt: number;
  lastPlayedAt: number;
  /** Last explicit UI interaction (heartbeat, room actions, etc.). */
  lastInteractionAt?: number;
  /** Account-wide expansion ids unlocked for all avatars. */
  unlockedExpansions: number[];
  /** Cosmetic dice skins unlocked for this account. */
  unlockedDiceIds?: string[];
  /** Active dice skin used in encounters. */
  selectedDiceId?: string;
  /** Player ids added as friends (account-wide). */
  friendIds?: string[];
  /**
   * Permanent, one-time soul link to another adventurer. When this player claims
   * their next Hearth Blessing, the target receives the "Gift of the Gods"
   * (+1 Spiritguide progress), recorded via `giftDeliveredAt`.
   */
  soulLink?: {
    targetId: string;
    targetName: string;
    linkedAt: number;
    giftDeliveredAt?: number;
  };
  /** Fallen avatars preserved for the player profile wall of fame. */
  wallOfFame?: WallOfFameEntry[];
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
    readyNotifiedAt?: number;
  };
  scribeNudges?: {
    supportReminderUtcDay?: string;
  };
  [key: string]: unknown;
}
