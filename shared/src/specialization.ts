import { solutionRarityRollBonus, type SolutionRarityRecord } from './solutionRarity.js';

/**
 * Specialization (D-056, Babuni, 2026-11-23): an avatar chooses one type of
 * skill it is good at. Every roll made with a skill of that type gets +1, in
 * any slot, on top of the slot's bonus and a rare skill's +1. Items have
 * equipment; skills have specialization. It is chosen and changed only in the
 * main menu: the first choice is free, every change costs 1 gem. Since
 * 2026-11-26 only the types of skill the avatar holds can be chosen, and each
 * new type gives a free change (see below).
 *
 * The descriptions are drafts by Claude Code (Claude Opus 5.5) for Babuni to
 * revise. They describe a way of facing the world and make no lore claims.
 */
export interface Specialization {
  /** The skill's solution type (`mSolutionType`). */
  solutionType: number;
  name: string;
  description: string;
}

export const SPECIALIZATIONS: readonly Specialization[] = [
  { solutionType: 9, name: 'Combat', description: 'You meet danger with force. Where others hesitate, you step forward and strike. Your fighting skills are drilled until they are second nature.' },
  { solutionType: 29, name: 'Hunt', description: 'You read tracks, wind and silence. Prey and predator alike are a trail to follow, and you know when to wait and when to loose.' },
  { solutionType: 27, name: 'Purge', description: 'Corruption, curses and the restless dead have learned to fear you. You cleanse what should not be and burn out what cannot be saved.' },
  { solutionType: 35, name: 'Stealth', description: 'You are the shadow at the edge of the firelight. You pass unseen, strike unheard, and are gone before anyone thinks to look.' },
  { solutionType: 5, name: 'Find', description: 'Nothing stays hidden from you for long. A loose stone, a faint smell, a footprint in the dust: you notice what others walk past.' },
  { solutionType: 7, name: 'Open Lock', description: 'Locks, seals and wards are puzzles to you, and you enjoy puzzles. Doors that stay closed for others open for you.' },
  { solutionType: 13, name: 'Climb', description: 'Cliffs, walls and towers are paths to you. You trust your grip and your balance, and the heights hold no fear.' },
  { solutionType: 21, name: 'Heal', description: 'You close wounds and ease pain. Where you walk, the hurt get back on their feet.' },
  // Type 25 is aid (Babuni, 2026-11-24): the Warmth skill, Helping Hand and the Aids belong to it.
  { solutionType: 25, name: 'Aid', description: 'You lend a hand where it is needed. A warm fire, a steady shoulder, a shield raised in time: those around you are never left alone.' },
  { solutionType: 33, name: 'Nurture', description: 'You care for the growing and the fragile: creatures, plants and people. Under your hand, what is weak becomes strong.' },
  { solutionType: 39, name: 'Inspiration', description: 'Your words and deeds kindle courage. Others find their strength again because of you.' },
  { solutionType: 17, name: 'Speech', description: 'You win with words. Guards step aside, merchants soften, and enemies hesitate when you speak.' },
  { solutionType: 1, name: 'Learn', description: 'Knowledge is your weapon. Old texts, strange runes and new ideas open their secrets to your patient mind.' },
  { solutionType: 3, name: 'Trade', description: 'You know what things are worth and what people want. A good bargain is a victory, and you win many.' },
];

/** "a Combat skill", "an Aid skill". */
export function specializationSkillPhrase(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name} skill`;
}

/** Skills are inventory type 1 (`mSolutionInventoryType`). */
export const SKILL_INVENTORY_TYPE = 1;
export const SPECIALIZATION_ROLL_BONUS = 1;
/** The first choice is free; every change after it costs this many gems. */
export const SPECIALIZATION_CHANGE_GEM_COST = 1;

export function findSpecialization(solutionType: number | null | undefined): Specialization | undefined {
  return typeof solutionType === 'number'
    ? SPECIALIZATIONS.find((entry) => entry.solutionType === solutionType)
    : undefined;
}

export function isSpecializationType(value: unknown): value is number {
  return typeof value === 'number' && findSpecialization(value) !== undefined;
}

/** An avatar's specialization, or null when none is chosen (or the stored value is unknown). */
export function readAvatarSpecialization(avatar: { specialization?: unknown } | null | undefined): number | null {
  const value = avatar?.specialization;
  return isSpecializationType(value) ? value : null;
}

/**
 * What a change costs an avatar whose specialization is `current`: the first
 * choice is free, a free change is used before any gem (Babuni, 2026-11-26).
 */
export function specializationChangeCost(current: number | null | undefined, freeChanges = 0): number {
  return isSpecializationType(current) && freeChanges <= 0 ? SPECIALIZATION_CHANGE_GEM_COST : 0;
}

/*
 * Only what the avatar has (Babuni, 2026-11-26): a specialization can be
 * chosen only for a type of skill the avatar holds, with a charge left. Each
 * type of skill it gets for the first time gives one free change; they add
 * up. The avatar remembers the types it has had, so a type lost and found
 * again gives none.
 */

/** What a skill lookup needs to know about a solution. */
export interface SpecializationSolutionRecord {
  mSolutionInventoryType: number;
  mSolutionType: number;
}
export type SpecializationSolutionLookup = (solutionId: number) => SpecializationSolutionRecord | undefined;

/** The specialization types the avatar holds a skill of (with a charge), in the roster's order. */
export function heldSpecializationTypes(
  spellbook: ReadonlyArray<{ solutionId: number; uses: number }> | undefined,
  lookup: SpecializationSolutionLookup,
): number[] {
  const held = new Set<number>();
  for (const entry of spellbook ?? []) {
    const record = lookup(entry.solutionId);
    if (entry.uses > 0 && record?.mSolutionInventoryType === SKILL_INVENTORY_TYPE) {
      held.add(record.mSolutionType);
    }
  }
  return SPECIALIZATIONS.filter((entry) => held.has(entry.solutionType)).map((entry) => entry.solutionType);
}

/** The specializations the picker offers: the held types, and the current one even if no skill of it is left. */
export function choosableSpecializations(held: readonly number[], current: number | null | undefined): Specialization[] {
  return SPECIALIZATIONS.filter((entry) => held.includes(entry.solutionType) || entry.solutionType === current);
}

export interface SpecializationProgress {
  /** Specialization types the avatar has held; undefined before it was first recorded. */
  specializationTypesSeen?: number[];
  /** Free changes earned and not used yet. */
  specializationFreeChanges?: number;
}

/** The free changes, with every newly held type counted, and the types seen after it. */
export function specializationFreeChanges(
  progress: SpecializationProgress | null | undefined,
  held: readonly number[],
): { free: number; seen: number[] } {
  const stored = Math.max(0, Math.floor(progress?.specializationFreeChanges ?? 0));
  const seenBefore = progress?.specializationTypesSeen;
  if (!Array.isArray(seenBefore)) {
    // Not recorded yet: what it holds now is where counting starts.
    return { free: stored, seen: [...held] };
  }
  const fresh = held.filter((type) => !seenBefore.includes(type));
  return { free: stored + fresh.length, seen: [...seenBefore, ...fresh] };
}

/** +1 when the solution is a skill of the avatar's specialization, else 0. */
export function specializationRollBonus(
  record: SolutionRarityRecord | null | undefined,
  specialization: number | null | undefined,
): number {
  return record
    && isSpecializationType(specialization)
    && record.mSolutionInventoryType === SKILL_INVENTORY_TYPE
    && record.mSolutionType === specialization
    ? SPECIALIZATION_ROLL_BONUS
    : 0;
}

/**
 * Everything a solution adds to its slot's roll by itself: a rare item's +1
 * and the specialization's +1. The slot's own bonus is not included.
 */
export function solutionRollBonus(
  record: SolutionRarityRecord | null | undefined,
  specialization?: number | null,
): number {
  return solutionRarityRollBonus(record) + specializationRollBonus(record, specialization);
}
