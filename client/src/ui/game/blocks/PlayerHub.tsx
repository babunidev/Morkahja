import { useState, type CSSProperties, type MouseEvent } from 'react';
import type { PersistedAvatar } from '../../../api/http.js';
import AvatarPanel from '../../avatar/AvatarPanel.js';
import { DEFAULT_BUTTON_SOUND, LORE_SOUND, playSfx } from '../../sfx.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';
import EncounterFooter from './EncounterFooter.js';

const GAME_UI_ROOT = '/UI/09_GAME';
const FOOTER_BUTTONS = [
  { alt: 'Get help', src: `${GAME_UI_ROOT}/im_button_gethelp.webp` },
  { alt: 'Skillbook', src: `${GAME_UI_ROOT}/im_button_skillbook.webp` },
  { alt: 'Inventory', src: `${GAME_UI_ROOT}/im_button_inventory.webp` },
  { alt: 'Lore', src: `${GAME_UI_ROOT}/im_button_lore.webp` },
] as const;

const hubStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  minHeight: 0,
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
};

const footerLayerStyle: CSSProperties = {
  gridArea: '1 / 1',
  alignSelf: 'end',
  width: '100%',
  height: '34%',
  zIndex: 1,
};

const hubContentStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '66%',
  minHeight: 0,
  boxSizing: 'border-box',
  gridArea: '1 / 1',
  alignSelf: 'start',
  zIndex: 5,
  pointerEvents: 'none',
};

const PARTY_SLOT_TOP_OFFSET_PX = 57;

const partyStripStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: PARTY_SLOT_TOP_OFFSET_PX,
  height: `calc(100% - ${PARTY_SLOT_TOP_OFFSET_PX}px)`,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  alignItems: 'center',
  pointerEvents: 'none',
};

const partySlotStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
};

const mainPartySlotStyle: CSSProperties = {
  ...partySlotStyle,
  pointerEvents: 'auto',
};

const mainAvatarAnchorStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 176px)',
  maxWidth: 'min(30vw, 176px)',
  justifySelf: 'center',
};

const footerContentStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '34%',
  minHeight: 0,
  padding: '8px 16px 10px',
  boxSizing: 'border-box',
  gridArea: '1 / 1',
  alignSelf: 'end',
  zIndex: 4,
};

const footerButtonRowStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  alignItems: 'center',
  justifyItems: 'center',
  gap: 8,
};

const footerButtonStyle: CSSProperties = {
  width: '100%',
  maxWidth: 84,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const footerButtonImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))',
};

const actionLogStyle: CSSProperties = {
  position: 'fixed',
  zIndex: 100,
  width: 'min(70vw, 320px)',
  maxHeight: 'min(36vh, 260px)',
  overflow: 'auto',
  padding: '10px 12px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  boxSizing: 'border-box',
  background: 'rgba(31, 12, 6, 0.9)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(12px, 2.8vw, 14px)',
  lineHeight: 1.35,
  textAlign: 'left',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
  pointerEvents: 'auto',
};

const actionLogListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 16,
};

function PartySlotPlaceholder({
  animationDelayMs = 0,
  label,
}: {
  animationDelayMs?: number;
  label: string;
}) {
  return (
    <div aria-label={`${label} slot empty`} style={partySlotStyle}>
      <span
        aria-hidden="true"
        className="morkahja-party-slot-dot"
        style={animationDelayMs > 0 ? { animationDelay: `${animationDelayMs}ms` } : undefined}
      />
    </div>
  );
}

export function PlayerHub({
  actionLog,
  avatar,
  hideAvatarPortraitForHandoff = false,
  homeVisible,
  onAvatarDetailsVisibleChange,
  onHome,
  onInventoryToggle,
  onLoreToggle,
  onSkillbookToggle,
}: {
  actionLog: string[];
  avatar: PersistedAvatar;
  hideAvatarPortraitForHandoff?: boolean;
  homeVisible: boolean;
  onAvatarDetailsVisibleChange: (visible: boolean) => void;
  onHome: () => void;
  onInventoryToggle: () => void;
  onLoreToggle: () => void;
  onSkillbookToggle: () => void;
}) {
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const [actionLogPosition, setActionLogPosition] = useState({ x: 16, y: 16 });
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  function handleActionLogClick(event: MouseEvent<HTMLButtonElement>): void {
    setActionLogPosition({
      x: Math.min(event.clientX + 12, window.innerWidth - 340),
      y: Math.min(event.clientY - 12, window.innerHeight - 280),
    });
    setActionLogVisible((visible) => !visible);
  }

  return (
    <section aria-label="Player Hub" style={hubStyle}>
      <div style={footerLayerStyle}>
        <EncounterFooter />
      </div>
      <div style={hubContentStyle}>
        <div aria-label="Party avatars" style={partyStripStyle}>
          <div aria-label="Player 1 main slot" style={mainPartySlotStyle}>
            <div style={mainAvatarAnchorStyle}>
              <AvatarPanel
                avatar={avatar}
                hidePortraitForHandoff={hideAvatarPortraitForHandoff}
                homeVisible={homeVisible}
                onDetailsVisibleChange={onAvatarDetailsVisibleChange}
                onHome={onHome}
              />
            </div>
          </div>
          <PartySlotPlaceholder animationDelayMs={420} label="Player 2" />
          <PartySlotPlaceholder animationDelayMs={840} label="Player 3" />
        </div>
      </div>
      <div style={footerContentStyle}>
        <div aria-label="Footer actions" style={footerButtonRowStyle}>
          {FOOTER_BUTTONS.map((button, index) => (
            <button
              aria-label={index === 0 ? 'Action log' : button.alt}
              data-morkahja-footer-target={
                index === 1 ? 'skillbook' : index === 2 ? 'inventory' : undefined
              }
              key={button.alt}
              onClick={(event) => {
                if (index === 0) {
                  playSfx(DEFAULT_BUTTON_SOUND);
                  handleActionLogClick(event);
                }
                if (index === 1) {
                  playSfx(DEFAULT_BUTTON_SOUND);
                  onSkillbookToggle();
                }
                if (index === 2) {
                  playSfx(DEFAULT_BUTTON_SOUND);
                  onInventoryToggle();
                }
                if (index === 3) {
                  playSfx(LORE_SOUND);
                  onLoreToggle();
                }
              }}
              onPointerDown={() => {
                pulse(button.alt);
              }}
              style={footerButtonStyle}
              type="button"
            >
              <img
                alt=""
                aria-hidden="true"
                draggable={false}
                src={button.src}
                style={{
                  ...footerButtonImageStyle,
                  animation: pressAnimation(isPressed(button.alt)),
                }}
              />
            </button>
          ))}
        </div>
      </div>
      {actionLogVisible ? (
        <div
          role="tooltip"
          style={{
            ...actionLogStyle,
            left: Math.max(8, actionLogPosition.x),
            top: Math.max(8, actionLogPosition.y),
          }}
        >
          {actionLog.length > 0 ? (
            <ul style={actionLogListStyle}>
              {actionLog.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ul>
          ) : 'No actions yet.'}
        </div>
      ) : null}
    </section>
  );
}

export default PlayerHub;
