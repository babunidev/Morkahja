import { useEffect, useState, type CSSProperties } from 'react';
import type { PersistedAvatar } from '../../api/http.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AvatarPortraitStack from './AvatarPortraitStack.js';

const panelStyle: CSSProperties = {
  width: 'min(42vw, 176px)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  position: 'relative',
  zIndex: 5,
};

const imageStackButtonStyle: CSSProperties = {
  width: '100%',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const imageStackInnerStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  aspectRatio: '1 / 1.15',
};

const portraitCellStyle: CSSProperties = {
  gridArea: '1 / 1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
};

const portraitPressStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  transformOrigin: 'center center',
};

const detailsOverlayStyle: CSSProperties = {
  gridArea: '1 / 1',
  zIndex: 3,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '82%',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(6, 6, 10, 0.62)',
  pointerEvents: 'none',
};

const nameStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(1rem, 4.6vw, 1.45rem)',
  lineHeight: 1,
};

const levelStyle: CSSProperties = {
  margin: '5px 0 0',
  fontSize: '0.72rem',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  opacity: 0.86,
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.85)',
};

const xpBarShellStyle: CSSProperties = {
  display: 'block',
  width: '86%',
  height: 6,
  marginTop: 7,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 999,
  background: 'rgba(20, 8, 4, 0.72)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.65)',
  overflow: 'hidden',
};

const xpBarFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #7e1d12 0%, #ffcc66 100%)',
  boxShadow: '0 0 8px rgba(255, 204, 102, 0.7)',
};

const xpTextStyle: CSSProperties = {
  marginTop: 3,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.62rem',
  lineHeight: 1,
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
};

function experienceRequiredForNextLevel(level: number): number {
  return 7 * 2 ** (Math.max(1, level) - 1);
}

export function AvatarPanel({
  avatar,
  hidePortraitForHandoff = false,
  onDetailsVisibleChange,
}: {
  avatar: PersistedAvatar;
  hidePortraitForHandoff?: boolean;
  onDetailsVisibleChange?: (visible: boolean) => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const nextLevelExperience = experienceRequiredForNextLevel(avatar.level);
  const currentExperience = Math.max(0, Math.min(avatar.experience, nextLevelExperience));
  const experiencePercent = nextLevelExperience > 0
    ? (currentExperience / nextLevelExperience) * 100
    : 0;

  useEffect(() => {
    onDetailsVisibleChange?.(showDetails);
  }, [onDetailsVisibleChange, showDetails]);

  return (
    <article aria-label={`${avatar.name}, level ${avatar.level}`} style={panelStyle}>
      <button
        aria-expanded={showDetails}
        aria-label={`Show details for ${avatar.name}`}
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          setShowDetails((current) => !current);
        }}
        onPointerDown={() => {
          pulse('avatar');
        }}
        style={imageStackButtonStyle}
        type="button"
      >
        <div style={imageStackInnerStyle}>
          <div
            style={{
              ...portraitCellStyle,
              opacity: hidePortraitForHandoff ? 0 : 1,
            }}
          >
            <div
              style={{
                ...portraitPressStyle,
                animation: pressAnimation(isPressed('avatar')),
              }}
            >
              <AvatarPortraitStack
                enterTarget
                frame={avatar.frame}
                portrait={avatar.portrait}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
          <span
            style={{
              ...detailsOverlayStyle,
              opacity: showDetails ? 1 : 0,
              visibility: showDetails ? 'visible' : 'hidden',
            }}
          >
            <span className="morkahja-title" style={nameStyle}>{avatar.name}</span>
            <span style={levelStyle}>
              Level {avatar.level} · {avatar.race} {avatar.role}
            </span>
            <span aria-label={`Experience ${currentExperience} of ${nextLevelExperience}`} style={xpBarShellStyle}>
              <span
                style={{
                  ...xpBarFillStyle,
                  width: `${experiencePercent}%`,
                }}
              />
            </span>
            <span style={xpTextStyle}>
              XP {currentExperience}/{nextLevelExperience}
            </span>
          </span>
        </div>
      </button>
    </article>
  );
}

export default AvatarPanel;
