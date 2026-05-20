import type { CSSProperties } from 'react';
import AvatarPortraitStack from './AvatarPortraitStack.js';

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

export function AvatarCard({ avatar, enterSource = false }: { avatar: AvatarCardData; enterSource?: boolean }) {
  return (
    <article style={cardStyle}>
      <div style={compositionStyle}>
        <AvatarPortraitStack
          enterSource={enterSource}
          frame={avatar.frame}
          portrait={avatar.portrait}
          style={{ width: '100%', height: '100%', aspectRatio: '1 / 1.25' }}
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
