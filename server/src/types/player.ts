export interface PlayerDocument {
  /** Account-wide expansion ids unlocked for all avatars. */
  unlockedExpansions: number[];
  activeAvatarId?: string;
  currencies?: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  loreGemClaims?: Record<string, boolean>;
  [key: string]: unknown;
}
