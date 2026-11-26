import { useEffect, useRef, useState, type CSSProperties } from 'react';

import type { EncounterSnapshot, PersistedAvatar, RoomParticipantDto, RoomStateDto } from '../../api/http.js';

import { useNavButtonPress } from '../transitions/navButtonPress.js';

import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

import AvatarPortraitStack, { INGAME_FRAME_SCALE } from './AvatarPortraitStack.js';
import { EssenceSlotsRing } from './EssenceSlotsRing.js';
import { LoreGemAvatarBadge } from '../game/blocks/LoreGemAvatarBadge.js';
import { FreeSlotAvatarTag } from './FreeSlotTag.js';

import {
  ChoiceDetailSections,
  PartyParticipantChoiceBadge,
  participantChoiceDetails,
  useTopRollGemShown,
} from '../game/blocks/partyParticipantChoiceBadge.js';
import { WordButton } from '../common/WordButton.js';

import { AnchoredGamePopover } from '../game/GameTooltip.js';
import AvatarPartyDetailsCard, {
  type AvatarDetailsSlotSide,
} from './AvatarPartyDetailsCard.js';




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
  onOpenOverview,

  encounter,

  roomParticipant,

  roomState,

  systemEventActorPlayerId,

  xpGainAmount = 0,

  slotSide = 'center',

  encounterKey,

  freeSlotVisible = false,

  freeSlotAway = false,

}: {

  avatar: PersistedAvatar;

  hidePortraitForHandoff?: boolean;

  homeVisible?: boolean;

  onDetailsVisibleChange?: (visible: boolean) => void;

  onHome?: () => void;
  /** A tap opens the avatar's overview instead of the small card (D-057). */
  onOpenOverview?: () => void;

  encounter?: EncounterSnapshot;

  roomParticipant?: RoomParticipantDto;

  roomState?: RoomStateDto;

  systemEventActorPlayerId?: string;

  xpGainAmount?: number;

  slotSide?: AvatarDetailsSlotSide;

  /** The current encounter: the essence slots refill when it changes. */
  encounterKey?: string;

  /** A "Free slot" tag blinks on the portrait (Babuni, 2026-11-26). */
  freeSlotVisible?: boolean;

  /** The card is open: the tag has moved to the slot. */
  freeSlotAway?: boolean;

}) {

  const [showDetails, setShowDetails] = useState(false);
  const detailsAnchorRef = useRef<HTMLButtonElement>(null);

  const { pulse, isPressed, pressAnimation } = useNavButtonPress();




  // Report only when the details state changes, not whenever the parent hands
  // over a new callback (inline callbacks are new on every render).
  // No hover tooltip: everything is in the card a tap opens (Babuni, 2026-11-23).
  const equipmentInventory = avatar.inventory ?? { spellbook: [], items: [], essences: [] };
  const pinnedChoice = participantChoiceDetails(roomParticipant, encounter, roomState, systemEventActorPlayerId);
  const topRollGem = useTopRollGemShown(roomParticipant, roomState, systemEventActorPlayerId);
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

          ref={detailsAnchorRef}
          aria-expanded={showDetails}

          aria-label={`Show details for ${avatar.name}`}

          className="morkahja-avatar-slot-button"

          onClick={() => {

            playSfx(DEFAULT_BUTTON_SOUND);

            if (onOpenOverview) {
              onOpenOverview();
              return;
            }
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

              <EssenceSlotsRing
                avatarId={avatar.id}
                encounterKey={encounterKey}
                essences={avatar.inventory?.essences}
                local
              />
              <LoreGemAvatarBadge held={roomParticipant?.loreGemCollected === true} roomState={roomState} topRoll={topRollGem} />
              <FreeSlotAvatarTag away={freeSlotAway} visible={freeSlotVisible} />
              {roomParticipant ? (

                <PartyParticipantChoiceBadge

                  encounter={encounter}

                  tooltipInAvatar

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

          <AnchoredGamePopover anchorRef={detailsAnchorRef}>

            <AvatarPartyDetailsCard

              avatar={avatar}

              choiceDetails={pinnedChoice ? <ChoiceDetailSections details={pinnedChoice} /> : null}

              equipment={equipmentInventory}

              inventory={avatar.inventory}

              inventorySeed={avatar.id}

              slotSide={slotSide}

              footer={onHome ? (
                <>
                  {onHome ? (

                <WordButton
                  ariaLabel="Back to the main menu"
                  onClick={() => {
                    if (homeVisible) {
                      onHome();
                    }
                  }}
                  pressKey="avatar-panel-home"
                  style={{
                    opacity: homeVisible ? 1 : 0,
                    pointerEvents: homeVisible ? 'auto' : 'none',
                  }}
                  word="Main menu"
                />

              ) : null}
                </>
              ) : undefined}

            />

          </AnchoredGamePopover>

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

