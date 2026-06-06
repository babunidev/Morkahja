import {
  applyExperience,
  createInitialProgression,
  experienceForSelectedRollOutcome,
  type AvatarProgression,
} from '../domain/avatar/AvatarProgression.js';
import type { RollOutcome } from '../engine/diceInterpreter.js';
import { loadAvatar, saveAvatar } from './encounterPersistence.js';
import { loadInventory } from './inventoryService.js';
import { getProgression, setProgression } from '../db/postgresDocumentStore.js';

export interface AvatarEssenceSummary {
  currentEssence: number;
}

export interface EncounterProgressionResult {
  progression: AvatarProgression;
  leveledUp: boolean;
}

export function applyEncounterProgressionState(
  existing: AvatarProgression,
  selectedRollOutcome: RollOutcome | null,
): EncounterProgressionResult {
  const withExperience = applyExperience(
    existing,
    experienceForSelectedRollOutcome(selectedRollOutcome),
  );
  const leveledUp = withExperience.level > existing.level;
  const progressed: AvatarProgression = {
    ...withExperience,
    encountersCompleted: withExperience.encountersCompleted + 1,
    encountersFailed:
      selectedRollOutcome === 'Misery'
        ? withExperience.encountersFailed + 1
        : withExperience.encountersFailed,
    lastPlayedAt: Date.now(),
  };

  return { progression: progressed, leveledUp };
}

/** System reward encounters grant items only — never XP or a fresh level-up queue signal. */
export function applyProgressionForEncounter(
  existing: AvatarProgression,
  encounterId: number,
  levelUpEncounterId: number,
  deathEncounterId: number,
  selectedRollOutcome: RollOutcome | null,
): EncounterProgressionResult {
  if (encounterId === levelUpEncounterId || encounterId === deathEncounterId) {
    return {
      progression: {
        ...existing,
        lastPlayedAt: Date.now(),
      },
      leveledUp: false,
    };
  }

  return applyEncounterProgressionState(existing, selectedRollOutcome);
}

function normalizeProgression(
  value: Partial<AvatarProgression> | undefined,
  now = Date.now(),
): AvatarProgression {
  return {
    level: value?.level ?? 1,
    experience: value?.experience ?? 0,
    encountersCompleted: value?.encountersCompleted ?? 0,
    encountersFailed: value?.encountersFailed ?? 0,
    createdAt: value?.createdAt ?? now,
    lastPlayedAt: value?.lastPlayedAt ?? now,
    pendingLevelUpRewards: value?.pendingLevelUpRewards === true ? true : undefined,
  };
}

async function persistAvatarProgression(
  playerId: string,
  avatarId: string,
  progression: AvatarProgression,
): Promise<void> {
  await setProgression(playerId, avatarId, progression);
}

export async function progressionExists(
  playerId: string,
  avatarId: string,
): Promise<boolean> {
  return (await getProgression(playerId, avatarId)) !== null;
}

export async function loadAvatarProgression(
  playerId: string,
  avatarId: string,
): Promise<AvatarProgression> {
  const progression = await getProgression<Partial<AvatarProgression>>(playerId, avatarId);

  if (!progression) {
    return createInitialProgression();
  }

  return normalizeProgression(progression);
}

export async function initializeAvatarProgression(
  playerId: string,
  avatarId: string,
): Promise<AvatarProgression> {
  const progression = createInitialProgression();
  await persistAvatarProgression(playerId, avatarId, progression);
  return progression;
}

export async function resetAvatarProgression(
  playerId: string,
  avatarId: string,
): Promise<AvatarProgression> {
  return initializeAvatarProgression(playerId, avatarId);
}

export async function touchAvatarProgression(
  playerId: string,
  avatarId: string,
): Promise<AvatarProgression> {
  const progression = await loadAvatarProgression(playerId, avatarId);
  const touched = {
    ...progression,
    lastPlayedAt: Date.now(),
  };

  await persistAvatarProgression(playerId, avatarId, touched);
  return touched;
}

export async function applyEncounterProgression(
  playerId: string,
  avatarId: string,
  selectedRollOutcome: RollOutcome | null,
): Promise<EncounterProgressionResult> {
  const existing = await loadAvatarProgression(playerId, avatarId);
  const { progression: progressed, leveledUp } = applyEncounterProgressionState(
    existing,
    selectedRollOutcome,
  );

  await persistAvatarProgression(playerId, avatarId, progressed);
  return { progression: progressed, leveledUp };
}

export async function persistLastEncounter(
  playerId: string,
  avatarId: string,
  encounterId: number,
): Promise<void> {
  const avatar = await loadAvatar(playerId, avatarId);

  if (!avatar) {
    throw new Error(`Avatar not found: ${avatarId}`);
  }

  await saveAvatar(playerId, avatarId, {
    ...avatar,
    progression: {
      ...avatar.progression,
      lastEncounterId: encounterId,
    },
  });
}

export async function getAvatarEssenceSummary(
  playerId: string,
  avatarId: string,
): Promise<AvatarEssenceSummary> {
  const inventory = await loadInventory(playerId, avatarId);
  const currentEssence = inventory.essences
    .filter((item) => item.solutionType === 15)
    .reduce((total, item) => total + item.uses, 0);

  return { currentEssence };
}
