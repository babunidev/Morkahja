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

export interface PlayerResponse {
  playerId: string;
  currencies?: {
    yellow_red_gem?: number;
    [key: string]: number | undefined;
  };
}

export interface PlayerCurrencyResponse {
  playerId: string;
  currencies: {
    yellow_red_gem: number;
    [key: string]: number | undefined;
  };
  granted: boolean;
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
  message: string;
  importance: ActivityFeedImportance;
  iconUrl?: string;
}

export interface ActivityFeedResponse {
  playerId: string;
  entries: ActivityFeedEntryDto[];
  windowMs: number;
}
