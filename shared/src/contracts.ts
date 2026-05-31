export type EncounterAction = 'A' | 'B' | 'C' | 'D' | 'dice';

export type EncounterState = 'created' | 'active' | 'resolving' | 'resolved';
export type EncounterFollowMode = 'follow' | 'random' | 'system';
export type AvatarRace = 'Rokur' | 'Verdani' | 'Aevis' | 'Grimnir';
export type AvatarRole = 'Mage' | 'Warrior' | 'Rogue';
export type DiceId = 'a' | 'b' | 'c' | 'd' | 'e' | 'f';

export interface ClientSession {
  playerId: string;
  playerName: string;
  sessionId: string;
  accessToken: string;
}

export interface PlayerResponse {
  playerId: string;
  currencies?: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  unlockedExpansions?: number[];
  unlockedDiceIds?: DiceId[];
  selectedDiceId?: DiceId;
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
  unlockedDiceIds: DiceId[];
  selectedDiceId: DiceId;
}

export interface SetAvatarDisplayTitleResponse {
  playerId: string;
  avatar: PersistedAvatarDto;
}

export interface UnlockDiceResponse {
  playerId: string;
  diceId: DiceId;
  spent: number;
  currencies: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
  unlockedDiceIds: DiceId[];
}

export interface SelectDiceResponse {
  playerId: string;
  selectedDiceId: DiceId;
  unlockedDiceIds: DiceId[];
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

export interface LoreGemOfferDto {
  eligible: boolean;
  claimableAt: number | null;
  offeredAt: number;
  /** Randomized reveal delay for this encounter; client counts down only while lore is open. */
  durationMs: number;
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
  /** Server-rolled reveal timer for this encounter (room-authoritative). */
  loreGemOffer?: LoreGemOfferDto;
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

export interface ActivityFeedJoinRoomActionDto {
  type: 'join_room';
  roomId: string;
  inviteId?: string;
  fromPlayerId: string;
}

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
  /** When set, the scribe entry can open or join the caller's encounter room. */
  joinAction?: ActivityFeedJoinRoomActionDto;
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

export interface FriendJoinableRoomDto {
  roomId: string;
  encounterTitle: string;
  participantCount: number;
  maxParticipants: number;
  inviteId?: string;
}

export interface FriendSummaryDto {
  playerId: string;
  playerName: string;
  online: boolean;
  portrait: string;
  frame: string;
  avatarName: string | null;
  lastPlayedAt: number;
  recentlyActive: boolean;
  joinableRoom: FriendJoinableRoomDto | null;
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

export type RoomStateDto =
  | 'active_encounter'
  | 'resolving'
  | 'advancing'
  | 'system_event'
  | 'waiting_continue'
  | 'closed';

export type ParticipantChoiceStateDto =
  | 'choosing'
  | 'ready'
  | 'ready_to_continue'
  | 'resolved'
  | 'witnessing'
  | 'disengaged';

export type ContinueReadinessDto = 'none' | 'gathering' | 'awaiting_local';

export type ParticipantFocusStateDto =
  | 'none'
  | 'lore'
  | 'inventory'
  | 'skillbook';

export type SlotStateDto = 'open' | 'friends_only' | 'locked';

export interface ParticipantResolutionSummaryDto {
  success: boolean;
  message: string;
  selectedRoll?: number;
  rewards: number[];
  failurePenalty?: number;
  usedInventorySolutions?: number[];
  deathTriggered?: boolean;
  avatarDied?: boolean;
  leveledUp?: boolean;
}

export interface RoomSystemEventDto {
  actorPlayerId: string;
  encounterId: number;
  kind: 'level_up' | 'atranor';
  isLocalActor: boolean;
  isLocalWitness: boolean;
  lastEventRecap?: ParticipantResolutionSummaryDto;
}

export interface ParticipantPreparedResultDto {
  success: boolean;
  message: string;
  selectedRoll?: number;
  rewards: number[];
  failurePenalty?: number;
  usedInventorySolutions?: number[];
  deathTriggered?: boolean;
  avatarDied?: boolean;
  leveledUp?: boolean;
}

export interface RoomParticipantDto {
  playerId: string;
  avatarId: string;
  slotIndex: number;
  playerName: string;
  avatar: PersistedAvatarDto;
  choiceState: ParticipantChoiceStateDto;
  focusState: ParticipantFocusStateDto;
  selectedAction?: EncounterAction;
  selectedSolutionId?: number;
  continuePressed: boolean;
  resolutionSummary?: ParticipantResolutionSummaryDto;
  preparedResult?: ParticipantPreparedResultDto;
  loreGemCollected?: boolean;
  isLocal: boolean;
}

export interface EncounterRoomSnapshotDto {
  roomId: string;
  leaderPlayerId: string;
  roomState: RoomStateDto;
  slotStates: [SlotStateDto, SlotStateDto, SlotStateDto];
  participants: RoomParticipantDto[];
  activeEncounter: EncounterSnapshotDto;
  helpCalledForEncounter: boolean;
  systemEvent?: RoomSystemEventDto;
  lineageEncounterId?: number;
  continueReadiness?: ContinueReadinessDto;
  loreGemActivated?: boolean;
  loreGemActivatedSnapshotId?: string;
  updatedAt: number;
}

export interface RoomActiveResponse {
  room: EncounterRoomSnapshotDto | null;
}

export interface RoomCreateResponse {
  room: EncounterRoomSnapshotDto;
}

export interface RoomHelpInvitationDto {
  inviteId: string;
  roomId: string;
  fromPlayerId: string;
  fromPlayerName: string;
  expiresAt: number;
}

export interface RoomHelpPendingResponse {
  invitations: RoomHelpInvitationDto[];
}

export interface RoomChoiceRequest {
  action: EncounterAction;
  solutionId?: number;
}

export interface RoomFocusRequest {
  focusState: ParticipantFocusStateDto;
}

export interface CallForHelpResponse {
  invitedCount: number;
  targetMode: 'friends' | 'random';
  helpCalled: boolean;
}

export interface RespondHelpResponse {
  room: EncounterRoomSnapshotDto | null;
}

export interface JoinFriendRoomResponse {
  room: EncounterRoomSnapshotDto;
}
