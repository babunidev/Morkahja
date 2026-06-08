/** Public Scribes "encounters …" lines fire on this cadence (21, 42, 63, …). */
export const ROOM_ENCOUNTER_SCRIBE_INTERVAL = 21;

export function shouldPublishRoomEncounterScribe(
  encountersCompleted: number | undefined,
): boolean {
  const completed = encountersCompleted ?? 0;
  const upcomingEncounterNumber = completed + 1;
  return upcomingEncounterNumber % ROOM_ENCOUNTER_SCRIBE_INTERVAL === 0;
}
