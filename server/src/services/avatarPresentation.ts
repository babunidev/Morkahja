import type { AvatarDocument } from '../types/avatar.js';
import { heldSpecializationTypes, readAvatarSpecialization, specializationFreeChanges } from '@shared/specialization.js';
import { getSolutionMap } from './gameData.js';
import {
  readAvatarLifeStatus,
  sacrificeCostForLevel,
} from './avatarDeathService.js';
import {
  formatAvatarDisplayName,
  readAvatarDisplayTitle,
} from '../domain/achievements/achievementTitles.js';

export { formatAvatarDisplayName, readAvatarDisplayTitle };

export interface PersistedAvatarDtoShape {
  id: string;
  name: string;
  race: NonNullable<AvatarDocument['race']>;
  role: NonNullable<AvatarDocument['role']>;
  level: number;
  experience: number;
  inventory?: AvatarDocument['inventory'];
  portrait: string;
  frame: string;
  createdAt?: number;
  lastPlayedAt?: number;
  displayTitle: string | null;
  status?: AvatarDocument['status'];
  sacrificeGemCost?: number;
  /** The skill type the avatar is good at (D-056); null when none is chosen. */
  specialization: number | null;
  /** Free changes, counting skill types that are new since they were last recorded. */
  specializationFreeChanges: number;
}

/** The specialization types an avatar holds a skill of, from the game's solution data. */
export function avatarHeldSpecializationTypes(inventory: AvatarDocument['inventory']): number[] {
  const solutions = getSolutionMap();
  return heldSpecializationTypes(inventory?.spellbook, (id) => solutions[String(id)]);
}

export function toPersistedAvatarDto(avatar: AvatarDocument): PersistedAvatarDtoShape | null {
  if (!avatar.id || !avatar.portrait || !avatar.frame || !avatar.race || !avatar.role) {
    return null;
  }

  const displayTitle = readAvatarDisplayTitle(avatar);
  const status = readAvatarLifeStatus(avatar);
  const dto: PersistedAvatarDtoShape = {
    id: avatar.id,
    name: avatar.name?.trim() || 'Adventurer',
    race: avatar.race,
    role: avatar.role,
    level: typeof avatar.level === 'number' ? avatar.level : 1,
    experience: typeof avatar.experience === 'number' ? avatar.experience : 0,
    portrait: avatar.portrait,
    frame: avatar.frame,
    createdAt: avatar.createdAt,
    lastPlayedAt: avatar.lastPlayedAt,
    displayTitle,
    status,
    specialization: readAvatarSpecialization(avatar),
    specializationFreeChanges: specializationFreeChanges(avatar, avatarHeldSpecializationTypes(avatar.inventory)).free,
  };

  if (status === 'failed' && avatar.preDeathSnapshot) {
    dto.sacrificeGemCost = sacrificeCostForLevel(avatar.preDeathSnapshot.level);
  }

  if (avatar.inventory) {
    dto.inventory = avatar.inventory;
  }

  return dto;
}
