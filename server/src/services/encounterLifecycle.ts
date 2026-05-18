/**
 * @deprecated Use `./encounterGenerator.ts` — single authoritative service.
 */
export {
  clearEncounter,
  clearEncounter as clearActiveEncounter,
  createEncounter,
  createEncounter as createEncounterForAvatar,
  ensureAvatar,
  ensureAvatar as ensureAvatarDocument,
  getActiveEncounter,
  resolveEncounter,
  resolveEncounter as resolveActiveEncounter,
  type EncounterSelectionContext,
  type ResolveEncounterResult,
  type ResolveEncounterResult as ResolveActiveEncounterResult,
} from './encounterGenerator.js';
