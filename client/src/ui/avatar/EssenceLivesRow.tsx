import { useMemo, type CSSProperties } from 'react';
import type { InventoryItemDto } from '@shared/contracts';
import { gameSolutions } from '../../data/gameContent.js';
import { assetUrl } from '../../assetUrl.js';
import { protectedImageProps } from '../protectedImage.js';

const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');
const DISPLAY_COUNT = 5;
const ESSENCE_SOLUTION_TYPE = 15;

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
}

/** Read on each use: game content arrives from the server after the module loads. */
function solutionsById(): Record<string, SolutionRecord> {
  return gameSolutions() as Record<string, SolutionRecord>;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: '100%',
  marginTop: 6,
  minHeight: 22,
};

const iconStyle: CSSProperties = {
  display: 'block',
  width: 'clamp(16px, 4vw, 20px)',
  height: 'clamp(16px, 4vw, 20px)',
  objectFit: 'contain',
  filter: 'drop-shadow(0 1px 4px rgba(0, 0, 0, 0.75))',
};

const moreStyle: CSSProperties = {
  marginLeft: 2,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.62rem',
  lineHeight: 1,
  letterSpacing: '0.04em',
  textShadow: '0 1px 6px rgba(0, 0, 0, 0.85)',
};

function solutionImagePath(solutionId: number): string | null {
  const solution = solutionsById()[String(solutionId)];
  if (!solution) {
    return null;
  }

  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

function buildEssenceItems(essences: InventoryItemDto[] | undefined): InventoryItemDto[] {
  if (!Array.isArray(essences)) {
    return [];
  }

  return essences.filter(
    (item) => item.solutionType === ESSENCE_SOLUTION_TYPE && item.uses > 0,
  );
}

function seededShuffle<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  let random = 0;

  for (const char of seed) {
    random = (random * 31 + char.charCodeAt(0)) >>> 0;
  }

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    random = (random * 1664525 + 1013904223) >>> 0;
    const swapIndex = random % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function EssenceLivesRow({
  essences,
  seed,
}: {
  essences?: InventoryItemDto[];
  seed: string;
}) {
  const { samples, totalCount } = useMemo(() => {
    const items = buildEssenceItems(essences);
    if (items.length === 0) {
      return { samples: [] as InventoryItemDto[], totalCount: 0 };
    }

    const shuffled = seededShuffle(items, seed);
    const totalCount = items.length;

    return {
      samples: shuffled.slice(0, Math.min(totalCount, DISPLAY_COUNT)),
      totalCount,
    };
  }, [essences, seed]);

  if (totalCount === 0) {
    return (
      <div aria-label="No essences remaining" style={rowStyle}>
        <span style={moreStyle}>No lives left</span>
      </div>
    );
  }

  return (
    <div aria-label={`${totalCount} essences`} style={rowStyle}>
      {samples.map((essence) => {
        const imagePath = solutionImagePath(essence.solutionId);
        if (!imagePath) {
          return null;
        }

        return (
          <img
            alt=""
            aria-hidden="true"
            key={essence.solutionId}
            {...protectedImageProps}
            src={imagePath}
            style={iconStyle}
          />
        );
      })}
      {totalCount > DISPLAY_COUNT ? (
        <span style={moreStyle}>+{totalCount - DISPLAY_COUNT}</span>
      ) : null}
    </div>
  );
}

export default EssenceLivesRow;
