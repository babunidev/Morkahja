import type { CSSProperties } from 'react';

const HEADER_BACKGROUND = '/UI/09_GAME/im_encounter_background_top_a.webp';
const FRAME_MASK = '/UI/09_GAME/im_spacer_line.webp';

const headerStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
  placeItems: 'center',
  backgroundImage: `url(${HEADER_BACKGROUND})`,
  backgroundRepeat: 'repeat-x',
  backgroundSize: 'auto 100%',
};

const titleStyle: CSSProperties = {
  margin: 0,
  padding: '0 18px',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(1.25rem, 5.5vw, 2rem)',
  letterSpacing: '0.04em',
  textAlign: 'center',
  gridArea: '1 / 1',
  zIndex: 1,
};

const bottomSeamStyle: CSSProperties = {
  gridArea: '1 / 1',
  alignSelf: 'end',
  justifySelf: 'center',
  width: '108%',
  height: 10,
  objectFit: 'cover',
  transform: 'translateY(7px)',
  zIndex: 20,
  pointerEvents: 'none',
};

export function EncounterHeader({ title }: { title: string }) {
  return (
    <div style={headerStyle}>
      <h1 className="morkahja-title" style={titleStyle}>{title}</h1>
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={FRAME_MASK}
        style={bottomSeamStyle}
      />
    </div>
  );
}

export default EncounterHeader;
