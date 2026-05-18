import type { CSSProperties } from 'react';
const AVATAR_ASSET_ROOT = '/UI/02_AvatarCreation/Avatare';
const FRAME_ASSET_ROOT = '/UI/02_AvatarCreation/Frames';

interface AvatarCardData {
  name: string;
  race: string;
  role: string;
  portrait: string;
  frame: string;
  level: number;
}

const cardStyle: CSSProperties = {
  width: '100%',
};

const compositionStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1.25',
  display: 'grid',
  placeItems: 'center',
};

const portraitStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  zIndex: 1,
  width: '88.6%',
  height: '88.6%',
  objectFit: 'contain',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

const frameStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  zIndex: 2,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

const nameStyle: CSSProperties = {
  margin: '14px 0 4px',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(1rem, 2vw, 1.25rem)',
};

const metaStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  opacity: 0.86,
  textTransform: 'uppercase',
  textShadow: '0 2px 12px rgba(0, 0, 0, 0.85)',
};

export function AvatarCard({ avatar }: { avatar: AvatarCardData }) {
  return (
    <article style={cardStyle}>
      <div style={compositionStyle}>
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={`${AVATAR_ASSET_ROOT}/${avatar.portrait}`}
          style={portraitStyle}
        />
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={`${FRAME_ASSET_ROOT}/${avatar.frame}`}
          style={frameStyle}
        />
      </div>
      <h2 className="morkahja-title" style={nameStyle}>{avatar.name}</h2>
      <p style={metaStyle}>
        Level {avatar.level} · {avatar.race} {avatar.role}
      </p>
    </article>
  );
}

export default AvatarCard;
