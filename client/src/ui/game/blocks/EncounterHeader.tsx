import type { CSSProperties } from 'react';
import { fadeTransition } from '../../transitions/fade.js';

const overlayStyle: CSSProperties = {
  position: 'absolute',
  top: 'clamp(18px, 5vh, 36px)',
  left: 0,
  right: 0,
  zIndex: 40,
  pointerEvents: 'none',
  textAlign: 'center',
  padding: '0 18px',
  boxSizing: 'border-box',
  transition: fadeTransition,
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(1.5rem, 6.6vw, 2.4rem)',
  textAlign: 'center',
};

export function EncounterHeader({
  hidden = false,
  title,
}: {
  hidden?: boolean;
  title: string;
}) {
  return (
    <div style={{ ...overlayStyle, opacity: hidden ? 0 : 1 }}>
      <h1 aria-hidden={hidden} className="morkahja-title" style={titleStyle}>
        {title}
      </h1>
    </div>
  );
}

export default EncounterHeader;
