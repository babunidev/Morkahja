import { useRef, useState, type CSSProperties } from 'react';
import type {
  EncounterRoomSnapshotDto,
  PersistedAvatar,
  RoomStateDto,
  SlotStateDto,
} from '../../../api/http.js';
import { GAME_FOOTER_BUTTONS } from '../gameUiAssets.js';
import AvatarPanel from '../../avatar/AvatarPanel.js';
import PartyEmptySlot from './PartyEmptySlot.js';
import PartyMemberSlot from './PartyMemberSlot.js';
import { DEFAULT_BUTTON_SOUND, LORE_SOUND, playSfx } from '../../sfx.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import EncounterFooter from './EncounterFooter.js';

const FOOTER_BUTTONS = GAME_FOOTER_BUTTONS;

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
  overflow: 'visible',
  zIndex: 8,
  pointerEvents: 'auto',
};

const partySlotStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  pointerEvents: 'auto',
};

const mainPartySlotStyle: CSSProperties = {
  ...partySlotStyle,
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
  userSelect: 'none',
};

const actionLogListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: 16,
  userSelect: 'none',
};

export function PlayerHub({
  actionLog,
  avatar,
  hideAvatarPortraitForHandoff = false,
  homeVisible,
  onAvatarDetailsVisibleChange,
  onCallForHelp,
  helpCalled = false,
  onHome,
  onInventoryToggle,
  onLoreToggle,
  onSkillbookToggle,
  onSlotStateChange,
  room = null,
  roomState,
}: {
  actionLog: string[];
  avatar: PersistedAvatar;
  hideAvatarPortraitForHandoff?: boolean;
  homeVisible: boolean;
  onAvatarDetailsVisibleChange: (visible: boolean) => void;
  onCallForHelp?: () => void;
  helpCalled?: boolean;
  onHome: () => void;
  onInventoryToggle: () => void;
  onLoreToggle: () => void;
  onSkillbookToggle: () => void;
  onSlotStateChange?: (slotIndex: number, slotState: SlotStateDto) => void;
  room?: EncounterRoomSnapshotDto | null;
  roomState?: RoomStateDto;
}) {
  const [actionLogVisible, setActionLogVisible] = useState(false);
  const [actionLogPosition, setActionLogPosition] = useState({ x: 16, y: 16 });
  const [openSlotMenu, setOpenSlotMenu] = useState<number | null>(null);
  const avatarAnchorRef = useRef<HTMLDivElement | null>(null);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const localPlayerId = room?.participants.find((participant) => participant.isLocal)?.playerId;
  const canManageSlots = Boolean(
    room &&
    onSlotStateChange &&
    localPlayerId &&
    room.leaderPlayerId === localPlayerId,
  );

  function toggleActionLog(): void {
    const anchorRect = avatarAnchorRef.current?.getBoundingClientRect();
    if (anchorRect) {
      setActionLogPosition({
        x: Math.min(anchorRect.right + 12, window.innerWidth - 340),
        y: Math.max(8, anchorRect.top),
      });
    }
    setActionLogVisible((visible) => !visible);
  }

  function handleAvatarDetailsVisibleChange(visible: boolean): void {
    onAvatarDetailsVisibleChange(visible);
    if (!visible) {
      setActionLogVisible(false);
    }
  }

  return (
    <section aria-label="Player Hub" style={hubStyle}>
      <div {...{ [PROTECTED_SURFACE_ATTR]: '' }} style={footerLayerStyle}>
        <EncounterFooter />
      </div>
      <div style={hubContentStyle}>
        <div aria-label="Party avatars" {...{ [PROTECTED_SURFACE_ATTR]: '' }} style={partyStripStyle}>
          {[0, 1, 2].map((slotIndex) => {
            const participant = room?.participants.find((entry) => entry.slotIndex === slotIndex);
            if (participant?.isLocal) {
              return (
                <div
                  aria-label={`Your party slot ${slotIndex + 1}`}
                  key={`slot-${slotIndex}`}
                  {...{ [PROTECTED_SURFACE_ATTR]: '' }}
                  style={mainPartySlotStyle}
                >
                  <div ref={avatarAnchorRef} style={mainAvatarAnchorStyle}>
                    <AvatarPanel
                      actionLogOpen={actionLogVisible}
                      avatar={avatar}
                      hidePortraitForHandoff={hideAvatarPortraitForHandoff}
                      homeVisible={homeVisible}
                      onActionLogToggle={toggleActionLog}
                      onDetailsVisibleChange={handleAvatarDetailsVisibleChange}
                      onHome={onHome}
                    />
                  </div>
                </div>
              );
            }

            if (participant) {
              return (
                <PartyMemberSlot
                  key={`slot-${slotIndex}`}
                  participant={participant}
                  roomState={roomState}
                />
              );
            }

            return (
              <PartyEmptySlot
                animationDelayMs={slotIndex * 420}
                canManage={canManageSlots}
                key={`slot-${slotIndex}`}
                menuOpen={openSlotMenu === slotIndex}
                onMenuOpenChange={(open) => {
                  setOpenSlotMenu(open ? slotIndex : null);
                }}
                onSlotStateChange={onSlotStateChange}
                slotIndex={slotIndex}
                slotState={room?.slotStates[slotIndex] ?? 'open'}
              />
            );
          })}
        </div>
      </div>
      <div {...{ [PROTECTED_SURFACE_ATTR]: '' }} style={footerContentStyle}>
        <div aria-label="Footer actions" style={footerButtonRowStyle}>
          {FOOTER_BUTTONS.map((button, index) => (
            <button
              aria-label={index === 0 ? 'Call for help' : button.alt}
              className="morkahja-footer-button"
              data-morkahja-footer-target={
                index === 1 ? 'skillbook' : index === 2 ? 'inventory' : undefined
              }
              disabled={index === 0 && helpCalled}
              key={button.alt}
              onClick={() => {
                if (index === 0) {
                  if (helpCalled) {
                    return;
                  }
                  playSfx(DEFAULT_BUTTON_SOUND);
                  onCallForHelp?.();
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
              style={{
                ...footerButtonStyle,
                opacity: index === 0 && helpCalled ? 0.42 : 1,
                cursor: index === 0 && helpCalled ? 'default' : 'pointer',
              }}
              type="button"
            >
              <span className="morkahja-footer-button-visual">
                <img
                  alt=""
                  aria-hidden="true"
                  {...protectedImageProps}
                  src={button.src}
                  style={{
                    ...footerButtonImageStyle,
                    animation: pressAnimation(isPressed(button.alt)),
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      </div>
      {actionLogVisible ? (
        <div
          role="tooltip"
          {...{ [PROTECTED_SURFACE_ATTR]: '' }}
          onContextMenu={preventImageContextMenu}
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
