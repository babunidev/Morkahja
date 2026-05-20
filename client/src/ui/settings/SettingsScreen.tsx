import { useEffect, useState, type CSSProperties } from 'react';
import EncounterFooter from '../game/blocks/EncounterFooter.js';
import EncounterHeader from '../game/blocks/EncounterHeader.js';
import PortraitStage from '../layout/PortraitStage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import MusicVolumeSlider from './MusicVolumeSlider.js';
import SfxVolumeSlider from './SfxVolumeSlider.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';

const BACKGROUND = '/UI/09_GAME/menuBGgame.webp';
const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';

const layoutStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '15% minmax(0, 1fr) 13%',
  overflow: 'hidden',
  color: '#ffcc66',
  backgroundColor: '#120704',
  backgroundImage: `url(${BACKGROUND})`,
  backgroundPosition: 'center 50px',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
};

const contentStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  padding: '22px',
  boxSizing: 'border-box',
};

const panelStyle: CSSProperties = {
  width: 'min(82%, 420px)',
  display: 'grid',
  gap: 16,
  padding: '22px 20px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.72)',
  boxShadow: '0 16px 34px rgba(0, 0, 0, 0.45)',
};

const settingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
};

const actionButtonStyle: CSSProperties = {
  minWidth: 120,
  minHeight: 38,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
};

const footerSlotStyle: CSSProperties = {
  position: 'relative',
  minHeight: 0,
};

const footerLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1,
};

const homeButtonStyle: CSSProperties = {
  position: 'absolute',
  left: 'clamp(14px, 4vw, 28px)',
  bottom: 'clamp(10px, 3vw, 18px)',
  width: 'clamp(70px, 20vw, 120px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  zIndex: 4,
};

const homeImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 10px 16px rgba(0, 0, 0, 0.45))',
};

export function SettingsScreen({
  onBack,
  onLogout,
}: {
  onBack: () => void;
  onLogout: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [clickable, setClickable] = useState(false);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  useEffect(() => {
    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);
    const enableTimer = window.setTimeout(async () => {
      await waitForFade();
      setClickable(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(enableTimer);
    };
  }, []);

  async function fadeOutThen(action: () => void): Promise<void> {
    if (!clickable) {
      return;
    }

    setClickable(false);
    setVisible(false);
    await waitForFade();
    action();
  }

  return (
    <PortraitStage>
      <main aria-label="Settings" style={{ ...layoutStyle, ...fadeStyle(visible) }}>
        <EncounterHeader title="Settings" />
        <section style={contentStyle}>
          <div style={panelStyle}>
            <MusicVolumeSlider disabled={!clickable} />
            <SfxVolumeSlider disabled={!clickable} />
            <div style={settingRowStyle}>
              <span>Logout</span>
              <button
                onClick={() => {
                  playSfx(DEFAULT_BUTTON_SOUND);
                  void fadeOutThen(onLogout);
                }}
                disabled={!clickable}
                style={actionButtonStyle}
                type="button"
              >
                End Session
              </button>
            </div>
          </div>
        </section>
        <footer style={footerSlotStyle}>
          <div style={footerLayerStyle}>
            <EncounterFooter />
          </div>
          <button
            aria-label="Back"
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              void fadeOutThen(onBack);
            }}
            disabled={!clickable}
            onPointerDown={() => {
              pulse('home');
            }}
            style={homeButtonStyle}
            type="button"
          >
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
          </button>
        </footer>
      </main>
    </PortraitStage>
  );
}

export default SettingsScreen;
