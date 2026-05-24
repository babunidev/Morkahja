export const SEAL_OF_NORGHOR_GEM_COST = 67;
export const SEAL_OF_NORGHOR_DURATION_MS = 28 * 24 * 60 * 60 * 1000;
export const SEAL_OF_NORGHOR_DURATION_DAYS = 28;

export interface SealOfNorghorRecord {
  expiresAt: number;
}

export function readSealOfNorghorExpiresAt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'object' && value !== null) {
    const expiresAt = (value as SealOfNorghorRecord).expiresAt;
    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt) && expiresAt > 0) {
      return expiresAt;
    }
  }

  return null;
}

export function isSealOfNorghorActive(
  expiresAt: number | null | undefined,
  now = Date.now(),
): boolean {
  return typeof expiresAt === 'number' && expiresAt > now;
}
