/**
 * Internal Firebase persistence — only imported by encounterGenerator.
 * Authority path: /players/{playerId}/avatars/{avatarId}/activeEncounter/current
 */
import { db } from '../firebase.ts';
import type { EncounterSnapshot } from '../types/encounterSnapshot.ts';
import type { AvatarDocument } from '../types/avatar.ts';

const ACTIVE_ENCOUNTER_DOC = 'current';

/** Avatar profile: /players/{playerId}/avatars/{avatarId} */
export function avatarRef(playerId: string, avatarId: string) {
  return db
    .collection('players')
    .doc(playerId)
    .collection('avatars')
    .doc(avatarId);
}

/** Active snapshot: .../activeEncounter/current */
export function activeEncounterRef(playerId: string, avatarId: string) {
  return avatarRef(playerId, avatarId)
    .collection('activeEncounter')
    .doc(ACTIVE_ENCOUNTER_DOC);
}

export async function loadAvatar(
  playerId: string,
  avatarId: string,
): Promise<AvatarDocument | null> {
  const doc = await avatarRef(playerId, avatarId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as AvatarDocument;
}

export async function saveActiveEncounter(
  snapshot: EncounterSnapshot,
): Promise<void> {
  await activeEncounterRef(snapshot.playerId, snapshot.avatarId).set(snapshot);
}

export async function loadActiveEncounter(
  playerId: string,
  avatarId: string,
): Promise<EncounterSnapshot | null> {
  const doc = await activeEncounterRef(playerId, avatarId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as EncounterSnapshot;
}

export async function clearActiveEncounter(
  playerId: string,
  avatarId: string,
): Promise<void> {
  await activeEncounterRef(playerId, avatarId).delete();
}

export async function saveAvatar(
  playerId: string,
  avatarId: string,
  avatar: AvatarDocument,
): Promise<void> {
  await avatarRef(playerId, avatarId).set(avatar, { merge: true });
}
