import type { CSSProperties } from 'react';

import { assetUrl } from '../../assetUrl.js';

/** The red-yellow gem, the game's paid currency. */
export const GEM_ICON_ASSET = assetUrl('/UI/03_DASHBOARD/im_gems.webp');

const wrapStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  whiteSpace: 'nowrap',
};

const iconStyle: CSSProperties = {
  width: '1.35em',
  height: '1.35em',
  objectFit: 'contain',
  filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.8))',
};

/** "Cost 1" and the gem (Babuni, 2026-11-23); "Free" when it costs nothing. */
export default function GemCost({ cost }: { cost: number }) {
  if (cost <= 0) {
    return <span>Free</span>;
  }
  return (
    <span aria-label={`Cost ${cost} gem${cost === 1 ? '' : 's'}`} style={wrapStyle}>
      <span aria-hidden="true">Cost {cost}</span>
      <img alt="" aria-hidden="true" draggable={false} src={GEM_ICON_ASSET} style={iconStyle} />
    </span>
  );
}
