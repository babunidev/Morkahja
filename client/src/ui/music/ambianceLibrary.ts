import type { AmbianceStage } from './ambianceCycle.js';

export interface AmbianceClip {
  expansion: number;
  stage: AmbianceStage;
  url: string;
}

export function stagePool(
  clips: readonly AmbianceClip[],
  expansion: number,
  stage: AmbianceStage,
): string[] {
  return clips
    .filter((clip) => clip.expansion === expansion && clip.stage === stage)
    .map((clip) => clip.url);
}

export function expansionHasClips(clips: readonly AmbianceClip[], expansion: number): boolean {
  return clips.some((clip) => clip.expansion === expansion);
}

/**
 * Recordings are filed by the expansion's place. The base game is 0.
 * A named land is stored as 1000 plus that place, so Keldor (1001) plays the folder filed as 1.
 */
export function ambiancePackForExpansion(encounterExpansion: number): number {
  return encounterExpansion >= 1000 ? encounterExpansion - 1000 : encounterExpansion;
}
