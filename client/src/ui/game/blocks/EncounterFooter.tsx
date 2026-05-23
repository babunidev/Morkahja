import type { CSSProperties } from 'react';
import {
  PROTECTED_BACKGROUND_ATTR,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';

const FOOTER_BACKGROUND = '/UI/09_GAME/im_foot_background.webp';
const FRAME_MASK = '/UI/09_GAME/im_spacer_line.webp';

const footerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
  placeItems: 'center',
  backgroundImage: `url(${FOOTER_BACKGROUND})`,
  backgroundRepeat: 'repeat-x',
  backgroundSize: 'auto 100%',
  zIndex: 1,
  pointerEvents: 'auto',
};

const topSeamStyle: CSSProperties = {
  gridArea: '1 / 1',
  alignSelf: 'start',
  justifySelf: 'center',
  width: '108%',
  height: 10,
  objectFit: 'cover',
  transform: 'translateY(-7px)',
  zIndex: 20,
  pointerEvents: 'none',
};

export function EncounterFooter() {
  return (
    <div
      aria-hidden="true"
      {...{ [PROTECTED_BACKGROUND_ATTR]: '', [PROTECTED_SURFACE_ATTR]: '' }}
      style={footerStyle}
    >
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={FRAME_MASK}
        style={topSeamStyle}
      />
    </div>
  );
}

export default EncounterFooter;
