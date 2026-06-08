import { useEffect, useState, type CSSProperties } from 'react';

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

  PROTECTED_SURFACE_ATTR,

  protectedImageProps,

} from '../../protectedImage.js';

import EncounterFooter from './EncounterFooter.js';



const FOOTER_BUTTONS = GAME_FOOTER_BUTTONS;

/** Per-button rattle length and the cascade stagger between buttons. */
const FOOTER_READY_RATTLE_MS = 560;
const FOOTER_READY_RATTLE_STAGGER_MS = 90;



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



const PARTY_SLOT_TOP_OFFSET_PX = 44;



const partyStripStyle: CSSProperties = {

  position: 'absolute',

  left: 0,

  right: 0,

  top: PARTY_SLOT_TOP_OFFSET_PX,

  height: `calc(100% - ${PARTY_SLOT_TOP_OFFSET_PX}px)`,

  display: 'flex',

  justifyContent: 'center',

  alignItems: 'center',

  gap: 'clamp(8px, 2.4vw, 20px)',

  overflow: 'visible',

  zIndex: 8,

  pointerEvents: 'auto',

};



const partySlotStyle: CSSProperties = {

  flex: '0 0 auto',

  height: '100%',

  display: 'grid',

  placeItems: 'center',

  pointerEvents: 'auto',

};



const mainPartySlotStyle: CSSProperties = {

  ...partySlotStyle,

};



function partySlotVisualStyle(visualIndex: number, avatarDetailsOpen: boolean): CSSProperties {

  const centerVisual = visualIndex === 1;

  return {

    ...partySlotStyle,

    width: centerVisual ? 'min(30vw, 176px)' : 'min(24vw, 140px)',

    zIndex: centerVisual ? (avatarDetailsOpen ? 20 : 14) : 8,

    transform: centerVisual ? 'translateY(-10px)' : undefined,

  };

}



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



export function PlayerHub({

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

  onKickParticipant,

  onSlotStateChange,

  room = null,

  roomState,

  localXpGainAmount = 0,

  partyXpPulseByPlayer = {},

  readyRattleToken = 0,

}: {

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

  onKickParticipant?: (targetPlayerId: string) => void;

  onSlotStateChange?: (slotIndex: number, slotState: SlotStateDto) => void;

  room?: EncounterRoomSnapshotDto | null;

  roomState?: RoomStateDto;

  localXpGainAmount?: number;

  partyXpPulseByPlayer?: Record<string, number>;

  readyRattleToken?: number;

}) {

  const [openSlotMenu, setOpenSlotMenu] = useState<number | null>(null);

  const [footerRattling, setFooterRattling] = useState(false);

  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  useEffect(() => {
    if (!readyRattleToken) {
      return undefined;
    }

    setFooterRattling(true);
    const clearTimer = window.setTimeout(() => {
      setFooterRattling(false);
    }, FOOTER_READY_RATTLE_MS + FOOTER_READY_RATTLE_STAGGER_MS * (FOOTER_BUTTONS.length - 1) + 60);

    return () => {
      window.clearTimeout(clearTimer);
    };
  }, [readyRattleToken]);

  const localPlayerId = room?.participants.find((participant) => participant.isLocal)?.playerId;

  const canManageSlots = Boolean(

    room &&

    onSlotStateChange &&

    localPlayerId &&

    room.leaderPlayerId === localPlayerId,

  );



  const visualSlotToLogical: [number, number, number] = [1, 0, 2];



  return (

    <section aria-label="Player Hub" style={hubStyle}>

      <div {...{ [PROTECTED_SURFACE_ATTR]: '' }} style={footerLayerStyle}>

        <EncounterFooter />

      </div>

      <div style={hubContentStyle}>

        <div aria-label="Party avatars" {...{ [PROTECTED_SURFACE_ATTR]: '' }} style={partyStripStyle}>

          {[0, 1, 2].map((visualIndex) => {

            const slotIndex = visualSlotToLogical[visualIndex];

            const participant = room?.participants.find((entry) => entry.slotIndex === slotIndex);

            if (participant?.isLocal) {

              return (

                <div

                  aria-label={`Your party slot ${slotIndex + 1}`}

                  key={`slot-${visualIndex}-${slotIndex}`}

                  {...{ [PROTECTED_SURFACE_ATTR]: '' }}

                  style={{

                    ...mainPartySlotStyle,

                    ...partySlotVisualStyle(visualIndex, homeVisible),

                  }}

                >

                  <div style={mainAvatarAnchorStyle}>

                    <AvatarPanel

                      avatar={avatar}

                      hidePortraitForHandoff={hideAvatarPortraitForHandoff}

                      homeVisible={homeVisible}

                      onDetailsVisibleChange={onAvatarDetailsVisibleChange}

                      onHome={onHome}

                      xpGainAmount={localXpGainAmount}

                    />

                  </div>

                </div>

              );

            }



            if (participant) {

              return (

                <PartyMemberSlot

                  canKick={canManageSlots}

                  key={`slot-${visualIndex}-${slotIndex}`}

                  onKick={onKickParticipant}

                  participant={participant}

                  roomState={roomState}

                  systemEventActorPlayerId={room?.systemEvent?.actorPlayerId}

                  xpPulseToken={partyXpPulseByPlayer[participant.playerId]}

                />

              );

            }



            return (

              <PartyEmptySlot

                animationDelayMs={slotIndex * 420}

                canManage={canManageSlots}

                key={`slot-${visualIndex}-${slotIndex}`}

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

                    transformOrigin: '50% 50%',

                    animation: isPressed(button.alt)

                      ? pressAnimation(true)

                      : footerRattling

                        ? `morkahja-footer-ready-rattle ${FOOTER_READY_RATTLE_MS}ms ease-in-out ${index * FOOTER_READY_RATTLE_STAGGER_MS}ms`

                        : undefined,

                  }}

                />

              </span>

            </button>

          ))}

        </div>

      </div>

    </section>

  );

}



export default PlayerHub;

