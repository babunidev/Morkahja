import type { CSSProperties } from 'react';
import { fadeTransition } from '../../transitions/fade.js';

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

const titleWrapStyle: CSSProperties = {
  gridArea: '1 / 1',
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  zIndex: 1,
};

const titleLayerStyle: CSSProperties = {
  margin: 0,
  padding: '0 18px',
  fontSize: 'clamp(1.5rem, 6.6vw, 2.4rem)',
  textAlign: 'center',
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  transition: fadeTransition,
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

export function EncounterHeader({
  overlayTitle = null,
  title,
}: {
  overlayTitle?: string | null;
  title: string;
}) {
  const showOverlay = overlayTitle !== null;

  return (
    <div style={headerStyle}>
      <div style={titleWrapStyle}>
        <h1
          className="morkahja-title"
          style={{
            ...titleLayerStyle,
            opacity: showOverlay ? 0 : 1,
          }}
        >
          {title}
        </h1>
        {showOverlay ? (
          <h1
            className="morkahja-title"
            style={{
              ...titleLayerStyle,
              opacity: 1,
            }}
          >
            {overlayTitle}
          </h1>
        ) : null}
      </div>
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
