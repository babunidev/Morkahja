import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readContentPointer,
  readContentRevision,
  readPublishedContent,
  type PublishedContent,
} from './contentPublication.js';

import type {
  EncounterData,
  EncounterDataMap,
  SolutionData,
  SolutionDataMap,
} from '../engine/types.js';

export interface FrameData {
  frameGem: number;
  frameID: number;
  frameRace: number;
  frameRole: number;
  frameType: number;
}

export interface PortraitData {
  avatarGems: number;
  avatarGenderID: number;
  avatarID: number;
  avatarName: string;
  avatarRace: number;
  avatarRole: number;
  avatarType: number;
}

export interface FramesDataFile {
  Frames: Array<FrameData | null>;
}

export interface PortraitsDataFile {
  Avatar: Array<PortraitData | null>;
}

export interface ExpansionData {
  mExtensioActive: boolean;
  mExtensioCollectionImage: string;
  mExtensioCost: number;
  mExtensioPriceEurCents?: number;
  mExtensioHeaderImage: string;
  mExtensioID: number;
  mExtensioName: string;
  mExtensioReward: number;
  mExtensioSummaryText: string;
  mExtensioText: string;
  mExtensioUnlockButton: string;
}

interface ExpansionDataFile {
  expansions: Record<string, ExpansionData>;
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

let encounterCache: EncounterDataMap | null = null;
let solutionCache: SolutionDataMap | null = null;
let framesCache: FramesDataFile | null = null;
let portraitsCache: PortraitsDataFile | null = null;
let expansionCache: ExpansionDataFile | null = null;
let publishedCache: PublishedContent | null = null;
let publishedCacheRoot: string | null = null;
let publishedCacheManifestSha: string | null = null;
export interface GameRuntimeContentSnapshot {
  readonly revision: string | null;
  readonly encounters: EncounterDataMap;
  readonly solutions: SolutionDataMap;
  readonly frames: FramesDataFile;
  readonly portraits: PortraitsDataFile;
  readonly expansions: ExpansionDataFile;
}
let publishedRuntimeCache: GameRuntimeContentSnapshot | null = null;
let publishedSolutionCache: { revision: string; map: SolutionDataMap } | null = null;

/** Explicit activation only. Never automatically migrate or initialize production content. */
export function getConfiguredContentRoot(): string | null {
  const configured = process.env.MORKAHJA_CONTENT_ROOT?.trim();
  if (!configured) return null;
  if (!isAbsolute(configured)) throw new Error('MORKAHJA_CONTENT_ROOT must be absolute');
  const root = realpathSync(configured);
  const repoRoot = resolve(projectRoot, '..');
  const webRoot = resolve(process.env.MORKAHJA_WEB_ROOT || '/var/www/morkahja');
  const inside = (base: string): boolean => {
    const rel = relative(base, root);
    return rel === '' || (rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..' + sep) && !isAbsolute(rel));
  };
  if (inside(repoRoot) || inside(webRoot)) {
    throw new Error('MORKAHJA_CONTENT_ROOT must be outside Git and the webroot');
  }
  return root;
}

/**
 * Return one immutable publication reference, not five independently loaded records.
 * The current pointer is read exactly once per access. Existing callers retain their
 * previous object when publication swaps the pointer during another request.
 *
 * Null is only possible when publication mode is explicitly disabled. A broken or
 * missing configured root throws rather than loading Git fixtures.
 */
export function getPublishedContentSnapshot(): PublishedContent | null {
  const root = getConfiguredContentRoot();
  if (!root) return null;
  const pointer = readContentPointer(root);
  if (!publishedCache || publishedCacheRoot !== root ||
      publishedCache.revision !== pointer.revision ||
      publishedCacheManifestSha !== pointer.manifestSha256) {
    const next = readPublishedContent(root, pointer);
    publishedCache = next;
    publishedCacheRoot = root;
    publishedCacheManifestSha = pointer.manifestSha256;
    publishedRuntimeCache = null;
    publishedSolutionCache = null;
  }
  return publishedCache;
}

/** Legacy snapshots predate content revisions: their definition source stays the shipped baseline. */
let legacyRuntimeCache: GameRuntimeContentSnapshot | null = null;
function legacyRuntimeContentSnapshot(): GameRuntimeContentSnapshot {
  if (!legacyRuntimeCache) {
    const rawSolutions = loadJsonFromRepo<Record<string, SolutionData>>('game/solutiondata.json');
    legacyRuntimeCache = {
      revision: null,
      encounters: loadJsonFromRepo<EncounterDataMap>('game/encountersdata.json'),
      solutions: Object.fromEntries(
        Object.values(rawSolutions).map(entry => [String(entry.mSolutionID), entry]),
      ),
      frames: loadJsonFromRepo<FramesDataFile>('game/frames.json'),
      portraits: loadJsonFromRepo<PortraitsDataFile>('game/portraits.json'),
      expansions: loadJsonFromRepo<ExpansionDataFile>('game/expansiondata.json'),
    };
  }
  return legacyRuntimeCache;
}
function runtimeFromPublished(published: PublishedContent): GameRuntimeContentSnapshot {
  const sourceSolutions = published.content.solutions as Record<string, SolutionData>;
  return {
    revision: published.revision,
    encounters: published.content.encounters as EncounterDataMap,
    solutions: Object.fromEntries(Object.values(sourceSolutions)
      .map(entry => [String(entry.mSolutionID), entry])),
    frames: published.content.frames as FramesDataFile,
    portraits: published.content.portraits as PortraitsDataFile,
    expansions: published.content.expansions as ExpansionDataFile,
  };
}
/** Capture the selected current revision for newly created adventures only. */
export function getGameRuntimeContentSnapshot(): GameRuntimeContentSnapshot {
  const published = getPublishedContentSnapshot();
  if (!published) return legacyRuntimeContentSnapshot();
  if (!publishedRuntimeCache || publishedRuntimeCache.revision !== published.revision) {
    publishedRuntimeCache = runtimeFromPublished(published);
  }
  return publishedRuntimeCache;
}
/**
 * Load an encounter's original content version, never the latest version.
 * Untagged pre-publication snapshots are explicitly bound to the checked-in
 * legacy baseline. A missing/corrupt historical published revision fails closed.
 */
export function getGameRuntimeContentSnapshotForRevision(
  revision: string | null | undefined,
): GameRuntimeContentSnapshot {
  if (revision == null) return legacyRuntimeContentSnapshot();
  const root = getConfiguredContentRoot();
  if (!root) throw new Error('CONTENT_PINNED_REVISION_UNAVAILABLE');
  const current = getPublishedContentSnapshot();
  if (current?.revision === revision) return getGameRuntimeContentSnapshot();
  try {
    return runtimeFromPublished(readContentRevision(root, revision));
  } catch {
    // Never leak the private storage root through a gameplay error response.
    throw new Error('CONTENT_PINNED_REVISION_UNAVAILABLE');
  }
}


function gameFilePath(relativePath: string): string {
  return join(projectRoot, relativePath);
}

function loadJsonFromRepo<T>(relativePath: string): T {
  return JSON.parse(readFileSync(gameFilePath(relativePath), 'utf8')) as T;
}
function loadJson<T>(relativePath: string): T {
  const current = getPublishedContentSnapshot();
  if (current) {
    const key = relativePath.startsWith('game/') ? relativePath.slice(5) : relativePath;
    switch (key) {
      case 'encountersdata.json': return current.content.encounters as T;
      case 'solutiondata.json': return current.content.solutions as T;
      case 'expansiondata.json': return current.content.expansions as T;
      case 'frames.json': return current.content.frames as T;
      case 'portraits.json': return current.content.portraits as T;
      default: throw new Error('Unknown game content file');
    }
  }
  return loadJsonFromRepo<T>(relativePath);
}

function assertLegacyWritable(): void {
  if (getConfiguredContentRoot()) {
    throw new Error('CONTENT_PUBLISH_REQUIRED: legacy direct writes are disabled for published content');
  }
}

function saveJson(relativePath: string, data: unknown): void {
  assertLegacyWritable();
  writeFileSync(gameFilePath(relativePath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function invalidateGameDataCaches(): void {
  publishedCache = null;
  publishedCacheRoot = null;
  publishedCacheManifestSha = null;
  publishedRuntimeCache = null;
  publishedSolutionCache = null;
  encounterCache = null;
  solutionCache = null;
  framesCache = null;
  portraitsCache = null;
  expansionCache = null;
  legacyRuntimeCache = null;
}

export function getEncounters(): EncounterDataMap {
  if (getConfiguredContentRoot()) return getPublishedContentSnapshot()!.content.encounters as EncounterDataMap;
  if (!encounterCache) {
    encounterCache = loadJson<EncounterDataMap>('game/encountersdata.json');
  }
  return encounterCache;
}

export function getEncounterById(
  encounterId: number,
  encounters: EncounterDataMap = getEncounters(),
): EncounterData | undefined {
  return encounters[String(encounterId)] ?? encounters[String(encounterId).padStart(5, '0')];
}

export function getSolutionMap(): SolutionDataMap {
  if (getConfiguredContentRoot()) {
    const revision = getPublishedContentSnapshot()!;
    if (!publishedSolutionCache || publishedSolutionCache.revision !== revision.revision) {
      const raw = revision.content.solutions as Record<string, SolutionData>;
      publishedSolutionCache = {
        revision: revision.revision,
        map: Object.fromEntries(Object.values(raw).map(entry => [String(entry.mSolutionID), entry])),
      };
    }
    return publishedSolutionCache.map;
  }
  if (!solutionCache) {
    const raw = loadJson<Record<string, SolutionData>>(
      'game/solutiondata.json',
    );
    solutionCache = {};
    for (const entry of Object.values(raw)) {
      solutionCache[String(entry.mSolutionID)] = entry;
    }
  }
  return solutionCache;
}

function assertIndexedData<T>(
  data: Array<T | null>,
  name: string,
): void {
  if (!Array.isArray(data)) {
    throw new Error(`${name} must be an indexed array`);
  }

  if (data[0] !== null) {
    throw new Error(`${name} must keep index 0 as null`);
  }
}

export function getFramesData(): FramesDataFile {
  if (getConfiguredContentRoot()) return getPublishedContentSnapshot()!.content.frames as FramesDataFile;
  if (!framesCache) {
    framesCache = loadJson<FramesDataFile>('game/frames.json');
    assertIndexedData(framesCache.Frames, 'Frames');
  }

  return framesCache;
}

export function getPortraitsData(): PortraitsDataFile {
  if (getConfiguredContentRoot()) return getPublishedContentSnapshot()!.content.portraits as PortraitsDataFile;
  if (!portraitsCache) {
    portraitsCache = loadJson<PortraitsDataFile>('game/portraits.json');
    assertIndexedData(portraitsCache.Avatar, 'Avatar portraits');
  }

  return portraitsCache;
}

export function getExpansions(): ExpansionData[] {
  if (getConfiguredContentRoot()) {
    const file = getPublishedContentSnapshot()!.content.expansions as ExpansionDataFile;
    return Object.values(file.expansions);
  }
  if (!expansionCache) {
    expansionCache = loadJson<ExpansionDataFile>('game/expansiondata.json');
  }

  return Object.values(expansionCache.expansions);
}

export function getExpansionById(expansionId: number): ExpansionData | undefined {
  return getExpansions().find((entry) => entry.mExtensioID === expansionId);
}

export function loadStaticGameEnvironment(): void {
  // Validate/capture all five datasets in one revision at startup.
  getGameRuntimeContentSnapshot();
}

export function saveEncounterEntry(key: string, entry: EncounterData): void {
  assertLegacyWritable();
  const file = loadJson<EncounterDataMap>('game/encountersdata.json');
  file[key] = entry;
  saveJson('game/encountersdata.json', file);
  encounterCache = null;
}

export function saveSolutionEntry(key: string, entry: SolutionData): void {
  assertLegacyWritable();
  const file = loadJson<Record<string, SolutionData>>('game/solutiondata.json');
  file[key] = entry;
  saveJson('game/solutiondata.json', file);
  solutionCache = null;
}

export function saveExpansionEntry(key: string, entry: ExpansionData): void {
  assertLegacyWritable();
  const file = loadJson<ExpansionDataFile>('game/expansiondata.json');
  file.expansions[key] = entry;
  saveJson('game/expansiondata.json', file);
  expansionCache = null;
}

export function saveFrameEntry(entry: FrameData): void {
  assertLegacyWritable();
  const file = getFramesData();
  const next = [...file.Frames];
  next[entry.frameID] = entry;
  saveJson('game/frames.json', { Frames: next });
  framesCache = null;
}

export function savePortraitEntry(entry: PortraitData): void {
  assertLegacyWritable();
  const file = getPortraitsData();
  const next = [...file.Avatar];
  next[entry.avatarID] = entry;
  saveJson('game/portraits.json', { Avatar: next });
  portraitsCache = null;
}
