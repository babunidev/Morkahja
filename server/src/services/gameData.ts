import { createHash } from 'node:crypto';
import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/**
 * `server/game/*.json` is the single source of game content. Files are cached
 * in memory and re-read when their modification time changes (checked at most
 * once per second), so edits from the admin API or directly on disk go live
 * without a restart. Running rooms keep their own encounter snapshots.
 */
const FILE_CHECK_INTERVAL_MS = 1_000;

interface CachedFile {
  value: unknown;
  mtimeMs: number;
  checkedAt: number;
}

const fileCache = new Map<string, CachedFile>();
let contentGeneration = 0;

function gameFilePath(relativePath: string): string {
  return join(projectRoot, relativePath);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(gameFilePath(relativePath), 'utf8')) as T;
}

function readCached<T>(relativePath: string, parse: (raw: unknown) => T): T {
  const now = Date.now();
  const cached = fileCache.get(relativePath);
  if (cached && now - cached.checkedAt < FILE_CHECK_INTERVAL_MS) {
    return cached.value as T;
  }

  const filePath = gameFilePath(relativePath);
  const { mtimeMs } = statSync(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    cached.checkedAt = now;
    return cached.value as T;
  }

  try {
    const value = parse(JSON.parse(readFileSync(filePath, 'utf8')));
    fileCache.set(relativePath, { value, mtimeMs, checkedAt: now });
    contentGeneration += 1;
    return value;
  } catch (error) {
    if (!cached) {
      throw error;
    }
    // Keep serving the last good copy (e.g. a half-written or invalid edit)
    // and retry on the next check.
    console.error(`[gameData] could not reload ${relativePath}; keeping previous copy`, error);
    cached.checkedAt = now;
    return cached.value as T;
  }
}

function saveJson(relativePath: string, data: unknown): void {
  // Write to a temporary file and rename, so readers never see a partial file.
  const filePath = gameFilePath(relativePath);
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(tempPath, filePath);
  fileCache.delete(relativePath);
}

export function getEncounters(): EncounterDataMap {
  return readCached('game/encountersdata.json', (raw) => raw as EncounterDataMap);
}

export function getEncounterById(encounterId: number): EncounterData | undefined {
  const encounters = getEncounters();
  return encounters[String(encounterId)] ?? encounters[String(encounterId).padStart(5, '0')];
}

export function getSolutionMap(): SolutionDataMap {
  return readCached('game/solutiondata.json', (raw) => {
    const byId: SolutionDataMap = {};
    for (const entry of Object.values(raw as Record<string, SolutionData>)) {
      byId[String(entry.mSolutionID)] = entry;
    }
    return byId;
  });
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
  return readCached('game/frames.json', (raw) => {
    const file = raw as FramesDataFile;
    assertIndexedData(file.Frames, 'Frames');
    return file;
  });
}

export function getPortraitsData(): PortraitsDataFile {
  return readCached('game/portraits.json', (raw) => {
    const file = raw as PortraitsDataFile;
    assertIndexedData(file.Avatar, 'Avatar portraits');
    return file;
  });
}

function getExpansionFile(): ExpansionDataFile {
  return readCached('game/expansiondata.json', (raw) => {
    const file = raw as ExpansionDataFile;
    if (!file.expansions || typeof file.expansions !== 'object') {
      throw new Error('expansiondata.json must contain an expansions object');
    }
    return file;
  });
}

export function getExpansions(): ExpansionData[] {
  return Object.values(getExpansionFile().expansions);
}

export interface GameContentBundle {
  /** Serialized `GameContentDto` (see shared/contracts). */
  body: string;
  /** Strong HTTP ETag for `body`. */
  etag: string;
}

let bundleCache: (GameContentBundle & { generation: number }) | null = null;

/** Everything the client needs to render content, served at `/game-data/content`. */
export function getGameContentBundle(): GameContentBundle {
  const encounters = getEncounters();
  const solutions = getSolutionMap();
  const expansions = getExpansionFile().expansions;
  const frames = getFramesData().Frames;
  const portraits = getPortraitsData().Avatar;

  if (bundleCache && bundleCache.generation === contentGeneration) {
    return bundleCache;
  }

  const payload = { encounters, solutions, expansions, frames, portraits };
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
  const body = JSON.stringify({ version: hash, ...payload });
  bundleCache = { generation: contentGeneration, body, etag: `"${hash}"` };
  return bundleCache;
}

export function getExpansionById(expansionId: number): ExpansionData | undefined {
  return getExpansions().find((entry) => entry.mExtensioID === expansionId);
}

export function loadStaticGameEnvironment(): void {
  getEncounters();
  getSolutionMap();
  getFramesData();
  getPortraitsData();
  getExpansions();
}

export function saveEncounterEntry(key: string, entry: EncounterData): void {
  const file = loadJson<EncounterDataMap>('game/encountersdata.json');
  file[key] = entry;
  saveJson('game/encountersdata.json', file);
}

export function saveSolutionEntry(key: string, entry: SolutionData): void {
  const file = loadJson<Record<string, SolutionData>>('game/solutiondata.json');
  file[key] = entry;
  saveJson('game/solutiondata.json', file);
}

export function saveExpansionEntry(key: string, entry: ExpansionData): void {
  const file = loadJson<ExpansionDataFile>('game/expansiondata.json');
  file.expansions[key] = entry;
  saveJson('game/expansiondata.json', file);
}

export function saveFrameEntry(entry: FrameData): void {
  const file = loadJson<FramesDataFile>('game/frames.json');
  const next = [...file.Frames];
  next[entry.frameID] = entry;
  saveJson('game/frames.json', { Frames: next });
}

export function savePortraitEntry(entry: PortraitData): void {
  const file = loadJson<PortraitsDataFile>('game/portraits.json');
  const next = [...file.Avatar];
  next[entry.avatarID] = entry;
  saveJson('game/portraits.json', { Avatar: next });
}
