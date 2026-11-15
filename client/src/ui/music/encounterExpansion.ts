export function expansionFromEncounterMap(
  encounters: Record<string, unknown>,
  encounterId: number,
): number | null {
  const padded = String(encounterId).padStart(5, '0');
  const record = encounters[padded] ?? encounters[String(encounterId)];
  if (!record || typeof record !== 'object') {
    return null;
  }

  const expansion = (record as { mEncounterExpansion?: unknown }).mEncounterExpansion;
  return typeof expansion === 'number' && Number.isFinite(expansion) ? expansion : null;
}
