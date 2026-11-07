import { useSyncExternalStore } from 'react';
import encountersBaseline from '../data/game/encountersdata.json';
import solutionsBaseline from '../data/game/solutiondata.json';
import expansionsBaseline from '../data/game/expansiondata.json';
import framesBaseline from '../data/game/frames.json';
import portraitsBaseline from '../data/game/portraits.json';
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL ?? '';

/**
 * One coherent client data snapshot. Legacy fixtures are kept *only here* for
 * an explicitly unconfigured content API, not as a corruption/network fallback.
 */
export interface ClientContent {
  revision: string | null;
  source: 'legacy' | 'published';
  encounters: typeof encountersBaseline;
  solutions: typeof solutionsBaseline;
  expansions: typeof expansionsBaseline;
  frames: typeof framesBaseline;
  portraits: typeof portraitsBaseline;
  assets: Record<string, Record<string, string>>;
}
export interface ClientContentState {
  status: 'loading' | 'ready' | 'error';
  content: ClientContent;
  error: string | null;
}
export type ArtworkKind = 'encounters' | 'solutions' | 'expansions' | 'portraits' | 'frames';
const KINDS: readonly ArtworkKind[] = ['encounters', 'solutions', 'expansions', 'portraits', 'frames'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NAME = /^[A-Za-z0-9_-]{1,120}$/;
const LEGACY_ROOT: Record<ArtworkKind, string> = {
  encounters: '/game/encounterimages',
  solutions: '/game/solutionimages',
  expansions: '/UI/03_DASHBOARD/expansions',
  portraits: '/UI/02_AvatarCreation/Avatare',
  frames: '/UI/02_AvatarCreation/Frames',
};
const legacy: ClientContent = {
  revision: null, source: 'legacy',
  encounters: encountersBaseline, solutions: solutionsBaseline,
  expansions: expansionsBaseline, frames: framesBaseline,
  portraits: portraitsBaseline, assets: {},
};
let current: ClientContentState = { status: 'loading', content: legacy, error: null };
const listeners = new Set<() => void>();
let inflight: Promise<ClientContent> | null = null;
function emit(value: ClientContentState): void {
  current = value;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function getClientContentState(): ClientContentState { return current; }
export function getClientContent(): ClientContent { return current.content; }
export function useClientContentState(): ClientContentState {
  return useSyncExternalStore(subscribe, getClientContentState, getClientContentState);
}
export function useClientContent(): ClientContent {
  return useClientContentState().content;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function map(value: unknown, idField: string): value is Record<string, Record<string, unknown>> {
  return object(value) && Object.entries(value).length > 0 &&
    Object.entries(value).every(([key, row]) =>
      /^[0-9]{1,9}$/.test(key) && object(row) && Number(key) === row[idField]);
}
function indexed(value: unknown, wrapper: string, idField: string): boolean {
  if (!object(value) || !Array.isArray(value[wrapper])) return false;
  const rows = value[wrapper] as unknown[];
  return rows.length > 1 && rows[0] === null && rows.some((row, index) => index > 0 && row !== null) &&
    rows.every((row, index) => index === 0 || row === null || (object(row) && row[idField] === index));
}
function cleanName(value: unknown): string {
  if (typeof value !== 'string') throw Error('Invalid artwork name in content bundle');
  const stem = value.endsWith('.webp') ? value.slice(0, -5) : value;
  if (!NAME.test(stem)) throw Error('Invalid artwork name in content bundle');
  return stem;
}
function legacyNames(kind: ArtworkKind): Set<string> {
  if (kind === 'encounters') {
    return new Set(Object.values(legacy.encounters).map(e => cleanName(e.mEncounterImageName)));
  }
  if (kind === 'solutions') {
    return new Set(Object.values(legacy.solutions).map(e => cleanName(e.mSolutionIconName)));
  }
  if (kind === 'expansions') {
    const names = new Set<string>();
    for (const row of Object.values(legacy.expansions.expansions)) {
      for (const key of ['mExtensioCollectionImage', 'mExtensioHeaderImage', 'mExtensioUnlockButton'] as const) {
        if (row[key]) names.add(cleanName(row[key]));
      }
    }
    return names;
  }
  const array = kind === 'portraits' ? legacy.portraits.Avatar : legacy.frames.Frames;
  const prefix = kind === 'portraits' ? 'avatar_' : 'frame_';
  return new Set(array.flatMap((entry, index) => index > 0 && entry ? [prefix + index] : []));
}
const baselineArtwork = Object.fromEntries(KINDS.map(kind => [kind, legacyNames(kind)])) as Record<ArtworkKind, Set<string>>;
function requiredArt(content: ClientContent, kind: ArtworkKind, raw: string): void {
  if (!raw) return; // Some pre-existing optional expansion image fields are empty.
  const stem = cleanName(raw);
  if (!baselineArtwork[kind].has(stem) && !content.assets[kind]?.[stem]) {
    throw Error('Content references an image without a published asset');
  }
}
function validateResponse(data: unknown): ClientContent {
  if (!object(data) || typeof data.revision !== 'string' || !UUID.test(data.revision) ||
      !map(data.encounters, 'mEncounterID') || !map(data.solutions, 'mSolutionID') ||
      !object(data.expansions) || !map(data.expansions.expansions, 'mExtensioID') ||
      !indexed(data.frames, 'Frames', 'frameID') || !indexed(data.portraits, 'Avatar', 'avatarID') ||
      !object(data.assets)) {
    throw Error('Incomplete or invalid published game content');
  }
  const assets: Record<string, Record<string, string>> = {};
  for (const [kind, list] of Object.entries(data.assets)) {
    if (!KINDS.includes(kind as ArtworkKind) || !object(list)) throw Error('Invalid artwork index');
    assets[kind] = {};
    for (const [name, url] of Object.entries(list)) {
      const expected = '/game-data/media/' + data.revision + '/' + kind + '/' + name + '.webp';
      if (cleanName(name) !== name || url !== expected) throw Error('Invalid revision-aware image URL');
      assets[kind][name] = url;
    }
  }
  const content = {
    revision: data.revision, source: 'published',
    encounters: data.encounters, solutions: data.solutions,
    expansions: data.expansions, frames: data.frames, portraits: data.portraits,
    assets,
  } as ClientContent;
  for (const row of Object.values(content.encounters)) requiredArt(content, 'encounters', row.mEncounterImageName);
  for (const row of Object.values(content.solutions)) requiredArt(content, 'solutions', row.mSolutionIconName);
  for (const row of Object.values(content.expansions.expansions)) {
    for (const key of ['mExtensioCollectionImage', 'mExtensioHeaderImage', 'mExtensioUnlockButton'] as const) {
      requiredArt(content, 'expansions', row[key]);
    }
  }
  content.frames.Frames.forEach((row, index) => {
    if (row) requiredArt(content, 'frames', 'frame_' + index);
  });
  content.portraits.Avatar.forEach((row, index) => {
    if (row) requiredArt(content, 'portraits', 'avatar_' + index);
  });
  return content;
}
/**
 * Revalidate without ever exposing a partial response. Concurrent consumers
 * share one request; 304 keeps the last validated object reference unchanged.
 */
export function refreshClientContent(): Promise<ClientContent> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const previous = current.content;
      const response = await fetch(API_BASE_URL + '/game-data/content', {
        headers: previous.source === 'published'
          ? { 'If-None-Match': '"' + previous.revision + '"' } : {},
        cache: 'no-cache',
      });
      if (response.status === 304 && previous.source === 'published') {
        emit({ status: 'ready', content: previous, error: null });
        return previous;
      }
      if (response.status === 503) {
        const body = await response.json().catch(() => null) as unknown;
        if (object(body) && body.error === 'CONTENT_NOT_CONFIGURED' && previous.source !== 'published') {
          emit({ status: 'ready', content: legacy, error: null });
          return legacy;
        }
        throw Error('Published game content is unavailable');
      }
      if (!response.ok) throw Error('Game content request failed (' + response.status + ')');
      const candidate = validateResponse(await response.json() as unknown);
      emit({ status: 'ready', content: candidate, error: null });
      return candidate;
    } catch (error) {
      emit({ status: 'error', content: current.content,
        error: error instanceof Error ? error.message : 'Content unavailable' });
      throw error;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
/**
 * All game images resolve through the same revision as their content records.
 * Legacy URLs are permitted only for known original assets.
 */
export function contentImageUrl(kind: ArtworkKind, name: string): string {
  const stem = cleanName(name);
  const content = getClientContent();
  const managed = content.assets[kind]?.[stem];
  if (managed) return API_BASE_URL + managed;
  if (!baselineArtwork[kind].has(stem)) return '';
  return LEGACY_ROOT[kind] + '/' + stem + '.webp';
}

/** Isolated test reset; production code must not switch authority manually. */
export function resetClientContentForTests(): void {
  inflight = null;
  emit({ status: 'loading', content: legacy, error: null });
}
