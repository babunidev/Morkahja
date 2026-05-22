import { readFileSync } from 'node:fs';
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

function loadJson<T>(relativePath: string): T {
  const path = join(projectRoot, relativePath);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
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
