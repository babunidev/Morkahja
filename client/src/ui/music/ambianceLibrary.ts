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
