import { useEffect, useState, type CSSProperties } from 'react';
import type { PersistedAvatar } from '../../api/http.js';
import { formatAvatarDisplayName } from './avatarDisplayName.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AvatarPortraitStack, { INGAME_FRAME_SCALE } from './AvatarPortraitStack.js';

const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';

const panelStyle: CSSProperties = {
  position: 'relative',
  width: 'min(42vw, 176px)',
  zIndex: 5,
};

const portraitWrapStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
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
  position: 'absolute',
  left: '50%',
  bottom: '6%',
  transform: 'translateX(-50%)',
  zIndex: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 'clamp(8px, 1.8vw, 12px)',
  width: 'min(92vw, 240px)',
  pointerEvents: 'none',
};

const detailsTooltipStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(6, 6, 10, 0.78)',
  pointerEvents: 'none',
  textAlign: 'center',
  boxSizing: 'border-box',
};

const homeButtonRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  pointerEvents: 'auto',
  position: 'relative',
  zIndex: 10,
};

const hubActionButtonStyle: CSSProperties = {
  flex: '0 0 auto',
  width: 'clamp(21px, 5.5vw, 37px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  transition: 'opacity 420ms ease',
};

const homeImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 12px 20px rgba(0, 0, 0, 0.45))',
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
  width: '100%',
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

const xpGainBubbleStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: '16%',
  transform: 'translateX(-50%)',
  zIndex: 9,
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(0.95rem, 3.6vw, 1.25rem)',
  textShadow: '0 0 8px rgba(255, 204, 102, 0.95), 0 3px 10px rgba(0, 0, 0, 0.85)',
  pointerEvents: 'none',
  animation: 'morkahja-xp-gain-popup 760ms ease-out forwards',
};

function experienceRequiredForNextLevel(level: number): number {
  return 7 * 2 ** (Math.max(1, level) - 1);
}

export function AvatarPanel({
  avatar,
  hidePortraitForHandoff = false,
  homeVisible = false,
  onDetailsVisibleChange,
  onHome,
  xpGainAmount = 0,
}: {
  avatar: PersistedAvatar;
  hidePortraitForHandoff?: boolean;
  homeVisible?: boolean;
  onDetailsVisibleChange?: (visible: boolean) => void;
  onHome?: () => void;
  xpGainAmount?: number;
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
    <article
      aria-label={`${formatAvatarDisplayName(avatar)}, level ${avatar.level}`}
      style={{
        ...panelStyle,
        zIndex: showDetails ? 32 : panelStyle.zIndex,
      }}
    >
      <div data-morkahja-avatar-portrait="" style={portraitWrapStyle}>
        {xpGainAmount > 0 ? (
          <span aria-hidden="true" style={xpGainBubbleStyle}>+{xpGainAmount} XP</span>
        ) : null}
        <button
          aria-expanded={showDetails}
          aria-label={`Show details for ${formatAvatarDisplayName(avatar)}`}
          className="morkahja-avatar-slot-button"
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
          <span className="morkahja-avatar-slot-visual">
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
                    frameScale={INGAME_FRAME_SCALE}
                    portrait={avatar.portrait}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>
              </div>
            </div>
          </span>
        </button>
        {showDetails ? (
          <div style={detailsOverlayStyle}>
            <div role="tooltip" style={detailsTooltipStyle}>
              <span className="morkahja-title" style={nameStyle}>{formatAvatarDisplayName(avatar)}</span>
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
            </div>
            {onHome ? (
              <div style={homeButtonRowStyle}>
                <button
                  aria-label="Return home"
                  className="morkahja-footer-button"
                  disabled={!homeVisible}
                  onClick={() => {
                    if (!homeVisible) {
                      return;
                    }

                    playSfx(DEFAULT_BUTTON_SOUND);
                    onHome();
                  }}
                  onPointerDown={() => {
                    if (!homeVisible) {
                      return;
                    }

                    pulse('home');
                  }}
                  style={{
                    ...hubActionButtonStyle,
                    opacity: homeVisible ? 1 : 0,
                    pointerEvents: homeVisible ? 'auto' : 'none',
                  }}
                  type="button"
                >
                  <span className="morkahja-footer-button-visual">
                    <img
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      src={HOME_BUTTON_ASSET}
                      style={{
                        ...homeImageStyle,
                        animation: pressAnimation(isPressed('home')),
                      }}
                    />
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <style>
        {`@keyframes morkahja-xp-gain-popup {
  0% { opacity: 0; transform: translate(-50%, 6px) scale(0.88); }
  22% { opacity: 1; transform: translate(-50%, -2px) scale(1.06); }
  100% { opacity: 0; transform: translate(-50%, -26px) scale(1); }
}`}
      </style>
    </article>
  );
}

export default AvatarPanel;
