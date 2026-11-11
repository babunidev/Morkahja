import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { PersistedAvatar, RoomParticipantDto, RoomStateDto } from '../../api/http.js';

import { useNavButtonPress } from '../transitions/navButtonPress.js';

import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

import AvatarPortraitStack, { INGAME_FRAME_SCALE } from './AvatarPortraitStack.js';

import { PartyParticipantChoiceBadge } from '../game/blocks/partyParticipantChoiceBadge.js';
import { assetUrl } from '../../assetUrl.js';

import AvatarPartyDetailsCard, {
  avatarDetailsOverlayStyle,
  type AvatarDetailsSlotSide,
} from './AvatarPartyDetailsCard.js';

const HOME_BUTTON_ASSET = assetUrl('/UI/03_DASHBOARD/im_button_home.webp');



const panelStyle: CSSProperties = {

  position: 'relative',

  width: '100%',

  zIndex: 5,

};



const portraitWrapStyle: CSSProperties = {

  position: 'relative',

  width: '100%',

  overflow: 'visible',

};



const imageStackButtonStyle: CSSProperties = {

  width: '100%',

  padding: 0,

  border: 0,

  background: 'transparent',

  cursor: 'pointer',

};



const imageStackInnerStyle: CSSProperties = {

  position: 'relative',

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



export function AvatarPanel({

  avatar,

  hidePortraitForHandoff = false,

  homeVisible = false,

  onDetailsVisibleChange,

  onHome,

  roomParticipant,

  roomState,

  systemEventActorPlayerId,

  xpGainAmount = 0,

  slotSide = 'center',

}: {

  avatar: PersistedAvatar;

  hidePortraitForHandoff?: boolean;

  homeVisible?: boolean;

  onDetailsVisibleChange?: (visible: boolean) => void;

  onHome?: () => void;

  roomParticipant?: RoomParticipantDto;

  roomState?: RoomStateDto;

  systemEventActorPlayerId?: string;

  xpGainAmount?: number;

  slotSide?: AvatarDetailsSlotSide;

}) {

  const [showDetails, setShowDetails] = useState(false);

  const { pulse, isPressed, pressAnimation } = useNavButtonPress();

  const compact = slotSide !== 'center';



  // Report only when the details state changes, not whenever the parent hands
  // over a new callback (inline callbacks are new on every render).
  const onDetailsVisibleChangeRef = useRef(onDetailsVisibleChange);
  onDetailsVisibleChangeRef.current = onDetailsVisibleChange;
  useEffect(() => {
    onDetailsVisibleChangeRef.current?.(showDetails);
  }, [showDetails]);



  return (

    <article

      aria-label={`${avatar.name}, level ${avatar.level}`}

      style={{

        ...panelStyle,

        zIndex: showDetails ? 40 : panelStyle.zIndex,

        overflow: 'visible',

      }}

    >

      <div data-morkahja-avatar-portrait="" style={portraitWrapStyle}>

        {xpGainAmount > 0 ? (

          <span aria-hidden="true" style={xpGainBubbleStyle}>+{xpGainAmount} XP</span>

        ) : null}

        <button

          aria-expanded={showDetails}

          aria-label={`Show details for ${avatar.name}`}

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

              {roomParticipant ? (

                <PartyParticipantChoiceBadge

                  hidden={showDetails}

                  participant={roomParticipant}

                  roomState={roomState}

                  systemEventActorPlayerId={systemEventActorPlayerId}

                />

              ) : null}

            </div>

          </span>

        </button>

        {showDetails ? (

          <div style={avatarDetailsOverlayStyle(slotSide, compact)}>

            <AvatarPartyDetailsCard

              avatar={avatar}

              inventory={avatar.inventory}

              inventorySeed={avatar.id}

              slotSide={slotSide}

              footer={onHome ? (

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

              ) : undefined}

            />

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

