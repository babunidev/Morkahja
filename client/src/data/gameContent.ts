import type { GameContentDto } from '@shared/contracts';

/**
 * Game content (encounters, solutions, expansions, frames, portraits) comes
 * from the server at `/game-data/content`; the server's `server/game/*.json`
 * is the only copy. It is loaded once during the loading screen, so every
 * page load sees the latest content without a client rebuild.
 *
 * Readers call the getters at use time (never at module load), because the
 * content arrives after the modules are imported.
 */
let content: GameContentDto | null = null;

function isRecordMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIndexedList(value: unknown): value is Array<unknown | null> {
  return Array.isArray(value) && value.length > 1 && value[0] === null;
}

/** Validates and installs content; throws if any part is missing or empty. */
export function setGameContent(next: GameContentDto): void {
  if (
    typeof next?.version !== 'string'
    || !isRecordMap(next.encounters) || Object.keys(next.encounters).length === 0
    || !isRecordMap(next.solutions) || Object.keys(next.solutions).length === 0
    || !isRecordMap(next.expansions)
    || !isIndexedList(next.frames)
    || !isIndexedList(next.portraits)
  ) {
    throw new Error('Game content is incomplete.');
  }

  content = next;
}

export function gameContentVersion(): string | null {
  return content?.version ?? null;
}

function requireContent(): GameContentDto {
  if (!content) {
    throw new Error('Game content was read before it finished loading.');
  }
  return content;
}

export function gameEncounters(): Record<string, unknown> {
  return requireContent().encounters;
}

export function gameSolutions(): Record<string, unknown> {
  return requireContent().solutions;
}

export function gameExpansions(): Record<string, unknown> {
  return requireContent().expansions;
}

export function gameFrames(): Array<unknown | null> {
  return requireContent().frames;
}

export function gamePortraits(): Array<unknown | null> {
  return requireContent().portraits;
}
