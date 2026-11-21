import { gameContentVersion, gameSolutions } from '../../data/gameContent.js';
import {
  solutionFrameLookFor,
  type SolutionElement,
  type SolutionFrameLook,
  type SolutionFrameRecord,
} from './solutionFrameLook.js';

/** The element plates' symbol colours on an essence's frame. */
export const ELEMENT_COLORS: Readonly<Record<SolutionElement, string>> = {
  fire: '#ff8a3d',
  water: '#5cc8e0',
  air: '#e4eef8',
  earth: '#a6c46a',
};

/** Line scale: 1 at a 72 px picture, kept readable when small and fine when large. */
export function solutionFrameUnit(size: number): number {
  return Math.min(1.6, Math.max(0.7, size / 72));
}

/** Radius of the picture inside a box `size` px wide; the frame's lines take the rest. */
export function solutionArtRadius(size: number): number {
  return size / 2 - 7.5 * solutionFrameUnit(size);
}

let lookIndex: { version: string | null; byIcon: Map<string, SolutionFrameLook> } | null = null;

/** The frame for any solution picture, by its icon name. */
export function solutionFrameLookForIcon(iconName: string): SolutionFrameLook {
  const version = gameContentVersion();
  if (!lookIndex || lookIndex.version !== version) {
    const byIcon = new Map<string, SolutionFrameLook>();
    for (const record of Object.values(gameSolutions() as Record<string, SolutionFrameRecord | null>)) {
      if (record?.mSolutionIconName) {
        byIcon.set(record.mSolutionIconName, solutionFrameLookFor(record));
      }
    }
    lookIndex = { version, byIcon };
  }
  return lookIndex.byIcon.get(iconName) ?? { tier: 'standard', element: null };
}
