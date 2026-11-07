import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readContentPointer,
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
let publishedSolutionCache: { revision: string; map: SolutionDataMap } | null = null;

/** Explicit activation only. Never automatically migrate or initialize production content. */
function publishedContentRoot(): string | null {
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

function publishedBundle(): PublishedContent | null {
  const root = publishedContentRoot();
  if (!root) return null;
  const pointer = readContentPointer(root);
  if (!publishedCache || publishedCache.revision !== pointer.revision) {
    publishedCache = readPublishedContent(root);
  }
  return publishedCache;
}


function gameFilePath(relativePath: string): string {
  return join(projectRoot, relativePath);
}

function loadJson<T>(relativePath: string): T {
  const current = publishedBundle();
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
  return JSON.parse(readFileSync(gameFilePath(relativePath), 'utf8')) as T;
}

function assertLegacyWritable(): void {
  if (publishedContentRoot()) {
    throw new Error('CONTENT_PUBLISH_REQUIRED: legacy direct writes are disabled for published content');
  }
}

function saveJson(relativePath: string, data: unknown): void {
  assertLegacyWritable();
  writeFileSync(gameFilePath(relativePath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function invalidateGameDataCaches(): void {
  publishedCache = null;
  publishedSolutionCache = null;
  encounterCache = null;
  solutionCache = null;
  framesCache = null;
  portraitsCache = null;
  expansionCache = null;
}

export function getEncounters(): EncounterDataMap {
  if (publishedContentRoot()) return publishedBundle()!.content.encounters as EncounterDataMap;
  if (!encounterCache) {
    encounterCache = loadJson<EncounterDataMap>('game/encountersdata.json');
  }
  return encounterCache;
}

export function getEncounterById(encounterId: number): EncounterData | undefined {
  const encounters = getEncounters();
  return encounters[String(encounterId)] ?? encounters[String(encounterId).padStart(5, '0')];
}

export function getSolutionMap(): SolutionDataMap {
  if (publishedContentRoot()) {
    const revision = publishedBundle()!;
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
  if (publishedContentRoot()) return publishedBundle()!.content.frames as FramesDataFile;
  if (!framesCache) {
    framesCache = loadJson<FramesDataFile>('game/frames.json');
    assertIndexedData(framesCache.Frames, 'Frames');
  }

  return framesCache;
}

export function getPortraitsData(): PortraitsDataFile {
  if (publishedContentRoot()) return publishedBundle()!.content.portraits as PortraitsDataFile;
  if (!portraitsCache) {
    portraitsCache = loadJson<PortraitsDataFile>('game/portraits.json');
    assertIndexedData(portraitsCache.Avatar, 'Avatar portraits');
  }

  return portraitsCache;
}

export function getExpansions(): ExpansionData[] {
  if (publishedContentRoot()) {
    const file = publishedBundle()!.content.expansions as ExpansionDataFile;
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
  getEncounters();
  getSolutionMap();
  getFramesData();
  getPortraitsData();
  getExpansions();
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
