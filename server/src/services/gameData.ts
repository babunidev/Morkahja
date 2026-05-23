import { readFileSync, writeFileSync } from 'node:fs';
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

let encounterCache: EncounterDataMap | null = null;
let solutionCache: SolutionDataMap | null = null;
let framesCache: FramesDataFile | null = null;
let portraitsCache: PortraitsDataFile | null = null;
let expansionCache: ExpansionDataFile | null = null;

function gameFilePath(relativePath: string): string {
  return join(projectRoot, relativePath);
}

function loadJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(gameFilePath(relativePath), 'utf8')) as T;
}

function saveJson(relativePath: string, data: unknown): void {
  writeFileSync(gameFilePath(relativePath), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function invalidateGameDataCaches(): void {
  encounterCache = null;
  solutionCache = null;
  framesCache = null;
  portraitsCache = null;
  expansionCache = null;
}

export function getEncounters(): EncounterDataMap {
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
  if (!framesCache) {
    framesCache = loadJson<FramesDataFile>('game/frames.json');
    assertIndexedData(framesCache.Frames, 'Frames');
  }

  return framesCache;
}

export function getPortraitsData(): PortraitsDataFile {
  if (!portraitsCache) {
    portraitsCache = loadJson<PortraitsDataFile>('game/portraits.json');
    assertIndexedData(portraitsCache.Avatar, 'Avatar portraits');
  }

  return portraitsCache;
}

export function getExpansions(): ExpansionData[] {
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
  const file = loadJson<EncounterDataMap>('game/encountersdata.json');
  file[key] = entry;
  saveJson('game/encountersdata.json', file);
  encounterCache = null;
}

export function saveSolutionEntry(key: string, entry: SolutionData): void {
  const file = loadJson<Record<string, SolutionData>>('game/solutiondata.json');
  file[key] = entry;
  saveJson('game/solutiondata.json', file);
  solutionCache = null;
}

export function saveExpansionEntry(key: string, entry: ExpansionData): void {
  const file = loadJson<ExpansionDataFile>('game/expansiondata.json');
  file.expansions[key] = entry;
  saveJson('game/expansiondata.json', file);
  expansionCache = null;
}

export function saveFrameEntry(entry: FrameData): void {
  const file = getFramesData();
  const next = [...file.Frames];
  next[entry.frameID] = entry;
  saveJson('game/frames.json', { Frames: next });
  framesCache = null;
}

export function savePortraitEntry(entry: PortraitData): void {
  const file = getPortraitsData();
  const next = [...file.Avatar];
  next[entry.avatarID] = entry;
  saveJson('game/portraits.json', { Avatar: next });
  portraitsCache = null;
}
