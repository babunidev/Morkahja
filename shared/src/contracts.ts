export type EncounterAction = 'A' | 'B' | 'C' | 'D' | 'dice';

export type EncounterState = 'created' | 'active' | 'resolving' | 'resolved';
export type EncounterFollowMode = 'follow' | 'random' | 'system';
export type AvatarRace = 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';
export type AvatarRole = 'Mage' | 'Warrior' | 'Rogue';

export interface ClientSession {
  playerId: string;
  playerName: string;
  sessionId: string;
  accessToken: string;
}

export interface SealOfNorghorStatusDto {
  active: boolean;
  expiresAt: number | null;
  cost: number;
  durationDays: number;
  gemBalance: number;
  canActivate: boolean;
}

export interface ActivateSealOfNorghorResponse {
  playerId: string;
  spent: number;
  currencies: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  sealOfNorghor: SealOfNorghorStatusDto;
  unlockedExpansions: number[];
}

export interface PlayerResponse {
  playerId: string;
  currencies?: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  unlockedExpansions?: number[];
  sealOfNorghor?: SealOfNorghorStatusDto;
}

export interface WallOfFameEntryDto {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  level: number;
  portrait: string;
  frame: string;
  encountersPlayed: number;
  diedAt: number;
}

export interface UnlockedTitleOptionDto {
  title: string;
  achievementId: string;
  rank: number;
}

export interface PlayerProfileAvatarDto {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  level: number;
  portrait: string;
  frame: string;
  createdAt: number;
  displayTitle: string | null;
}

export interface PlayerProfileResponse {
  playerId: string;
  playerName: string;
  joinedAt: number;
  avatars: PlayerProfileAvatarDto[];
  wallOfFame: WallOfFameEntryDto[];
  unlockedTitles: UnlockedTitleOptionDto[];
}

export interface SetAvatarDisplayTitleResponse {
  playerId: string;
  avatar: PersistedAvatarDto;
}

export interface UnlockExpansionResponse {
  playerId: string;
  expansionId: number;
  spent: number;
  currencies: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  unlockedExpansions: number[];
}

export interface PlayerCurrencyResponse {
  playerId: string;
  currencies: {
    yellow_red_gem: number;
    [key: string]: number | undefined;
  };
  granted: boolean;
}

export interface LoreGemOfferResponse {
  eligible: boolean;
  claimableAt: number | null;
  encounterKey: string;
}

export interface LoreGemClaimResponse {
  playerId: string;
  currencies: {
    yellow_red_gem: number;
    [key: string]: number | undefined;
  };
  granted: boolean;
}

export interface DonateGemsResponse {
  playerId: string;
  donated: number;
  currencies: {
    yellow_red_gem: number;
    [key: string]: number | undefined;
  };
}

export interface PreparedEncounterDto {
  encounterId: number;
  followMode: EncounterFollowMode;
}

export interface EncounterSnapshotDto {
  snapshotId: string;
  encounterId: number;
  encounterTitle?: string;
  encounterImageName?: string;
  encounterText?: string;
  encounterDifficulty?: number;
  primarySolutionA?: number;
  primarySolutionB?: number;
  primarySolutionC?: number;
  primarySolutionD?: number;
  secondarySolutionTypeA?: number;
  secondarySolutionTypeB?: number;
  secondarySolutionTypeC?: number;
  secondarySolutionTypeD?: number;
  rollA?: number;
  rollB?: number;
  rollC?: number;
  rollD?: number;
  rollPrimaryA?: number;
  rollPrimaryB?: number;
  rollPrimaryC?: number;
  rollPrimaryD?: number;
  rollSecondaryA?: number;
  rollSecondaryB?: number;
  rollSecondaryC?: number;
  rollSecondaryD?: number;
  rollE?: number;
  rewardIds?: number[];
  prosperityRewardId?: number | null;
  preparedEncounter?: PreparedEncounterDto;
  state: EncounterState;
  resolved: boolean;
}

export interface InventoryItemDto {
  solutionId: number;
  solutionType: number;
  uses: number;
}

export interface AvatarInventoryDto {
  spellbook: InventoryItemDto[];
  items: InventoryItemDto[];
  essences: InventoryItemDto[];
}

export interface PersistedAvatarDto {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  level: number;
  experience: number;
  inventory?: AvatarInventoryDto;
  portrait: string;
  frame: string;
  createdAt?: number;
  lastPlayedAt?: number;
  displayTitle?: string | null;
}

export interface AvatarResponse {
  avatar?: PersistedAvatarDto;
}

export interface AvatarsResponse {
  playerId: string;
  avatars: PersistedAvatarDto[];
}

export interface EncounterResultResponse {
  success: boolean;
  selectedRoll?: number;
  rewards: number[];
  message: string;
  failurePenalty?: number;
  slotResults?: Record<'A' | 'B' | 'C' | 'D', boolean>;
  usedInventorySolutions?: number[];
  snapshot: EncounterSnapshotDto;
  avatar?: PersistedAvatarDto;
  /** True when essence depletion queues the Atranor encounter (player still plays it). */
  deathTriggered?: boolean;
  /** True when Atranor resolves Misery/Hardship — show the avatar death overlay. */
  avatarDied?: boolean;
}

export interface StaticGameDataStatus {
  status: 'ok';
  encounters: number;
  solutions: number;
  frames: number;
  portraits: number;
}

export type ActivityFeedImportance = 'low' | 'medium' | 'high' | 'legendary';

export interface ActivityFeedEntryDto {
  eventId: string;
  timestamp: number;
  /** Display name of the player who triggered this scribe entry. */
  authorName: string;
  message: string;
  importance: ActivityFeedImportance;
  iconUrl?: string;
  /** Portrait asset filename (under Avatare/) when the entry shows an avatar likeness. */
  avatarPortrait?: string;
  /** Frame asset filename (under Frames/) when the entry shows an avatar likeness. */
  avatarFrame?: string;
}

export interface ActivityFeedResponse {
  playerId: string;
  entries: ActivityFeedEntryDto[];
  windowMs: number;
}

export interface AchievementRankDto {
  rank: number;
  title: string;
  text: string;
  rankOverlayUrl?: string;
}

export interface AchievementProgressDto {
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
  ranks: AchievementRankDto[];
  chainTitle?: string;
  globallyLocked?: boolean;
}

export interface DailyRewardStatusDto {
  utcDay: string;
  encountersPlayed: number;
  encountersRequired: number;
  claimable: boolean;
  claimedToday: boolean;
  gemReward: number;
  achievementRank: number;
}

export interface AchievementsResponse {
  playerId: string;
  achievements: AchievementProgressDto[];
  dailyReward: DailyRewardStatusDto;
}

export interface ClaimDailyRewardResponse {
  playerId: string;
  granted: boolean;
  currencies: {
    yellow_red_gem: number;
    [key: string]: number | undefined;
  };
  achievements: AchievementProgressDto[];
  dailyReward: DailyRewardStatusDto;
}

export interface FriendSummaryDto {
  playerId: string;
  playerName: string;
  online: boolean;
  portrait: string;
  frame: string;
  avatarName: string | null;
}

export interface FriendsListResponse {
  playerId: string;
  friends: FriendSummaryDto[];
}

export interface AddFriendResponse {
  playerId: string;
  friend: FriendSummaryDto;
  friendIds: string[];
}

export interface FriendAvatarDto {
  id: string;
  name: string;
  race: AvatarRace;
  role: AvatarRole;
  level: number;
  portrait: string;
  frame: string;
  lastPlayedAt: number;
  lastPlayed: boolean;
}

export interface FriendAchievementsResponse {
  playerId: string;
  playerName: string;
  online: boolean;
  portrait: string;
  frame: string;
  avatarName: string | null;
  avatars: FriendAvatarDto[];
  achievements: AchievementProgressDto[];
}
