import type { CSSProperties } from 'react';

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
  pointerEvents: 'none',
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
    <div aria-hidden="true" style={footerStyle}>
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={FRAME_MASK}
        style={topSeamStyle}
      />
    </div>
  );
}

export default EncounterFooter;
