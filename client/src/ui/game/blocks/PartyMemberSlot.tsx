import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fadeStyle } from '../../transitions/fade.js';
import { useOpacityPresence } from '../../transitions/opacityPresence.js';
import type {
  ParticipantFocusStateDto,
  RoomParticipantDto,
  RoomStateDto,
} from '../../../api/http.js';
import AvatarPortraitStack from '../../avatar/AvatarPortraitStack.js';
import AvatarPartyDetailsCard, {
  type AvatarDetailsSlotSide,
} from '../../avatar/AvatarPartyDetailsCard.js';
import { GAME_FOCUS_BUTTON_ICONS } from '../gameUiAssets.js';
import {
  AnchoredEncounterTooltip,
} from '../encounterTooltip.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import {
  PARTY_BADGE_SIZE_PX,
  PartyParticipantChoiceBadge,
} from './partyParticipantChoiceBadge.js';
import { simpleFrameStyle } from '../../common/simpleFrame.js';
import { AnchoredGamePopover } from '../GameTooltip.js';
import { EssenceSlotsRing } from '../../avatar/EssenceSlotsRing.js';
import { LoreGemAvatarBadge } from './LoreGemAvatarBadge.js';

const PORTRAIT_FALLBACK = 'avatar_verdani_female_mage_a.webp';

interface PartyBadgeTooltip {
  label: string;
  description?: string;
}

const slotStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  position: 'relative',
  overflow: 'visible',
};

const columnStyle: CSSProperties = {
  width: '100%',
  justifySelf: 'center',
  display: 'grid',
  placeItems: 'center',
  overflow: 'visible',
};

const portraitWrapStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  overflow: 'visible',
};

const portraitButtonStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1.15',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 8,
};

const badgeOverlayStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 7,
  width: PARTY_BADGE_SIZE_PX,
  height: PARTY_BADGE_SIZE_PX,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
};

const badgeOverlayInteractiveStyle: CSSProperties = {
  ...badgeOverlayStyle,
  pointerEvents: 'auto',
  cursor: 'default',
};

const focusBadgeOverlayStyle: CSSProperties = {
  ...badgeOverlayInteractiveStyle,
  zIndex: 6,
};

const badgeIconStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  objectFit: 'cover',
  boxShadow:
    '0 0 12px rgba(255, 204, 102, 0.55), 0 4px 10px rgba(0, 0, 0, 0.5)',
};

const focusBadgeIconStyle: CSSProperties = {
  ...badgeIconStyle,
  objectFit: 'contain',
  borderRadius: 0,
  boxShadow: 'none',
  filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.65))',
};

const xpPulseDotStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: '16%',
  transform: 'translateX(-50%)',
  zIndex: 9,
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(255,204,102,0.95) 0%, rgba(255,153,51,0.2) 70%)',
  boxShadow: '0 0 12px rgba(255, 204, 102, 0.9)',
  pointerEvents: 'none',
  animation: 'morkahja-party-xp-pulse 700ms ease-out forwards',
};

const kickButtonStyle: CSSProperties = {
  padding: '4px 10px',
  ...simpleFrameStyle({ background: 'rgba(40, 12, 8, 0.82)', opacity: 0.81, scale: 0.6 }),
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.62rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};

function focusBadgeTooltip(focusState: ParticipantFocusStateDto): PartyBadgeTooltip | null {
  switch (focusState) {
    case 'lore':
      return { label: 'Reading lore' };
    case 'inventory':
      return { label: 'Viewing inventory' };
    case 'skillbook':
      return { label: 'Reading skillbook' };
    case 'avatar_details':
      return { label: 'Avatar details' };
    default:
      return null;
  }
}

function PartyMemberFocusBadge({
  fadeVisible = true,
  iconSrc,
  iconStyle = badgeIconStyle,
  overlayStyle = badgeOverlayInteractiveStyle,
  tooltip,
}: {
  fadeVisible?: boolean;
  iconSrc: string;
  iconStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  tooltip: PartyBadgeTooltip | null;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        onMouseEnter={() => {
          if (tooltip) {
            setTooltipVisible(true);
          }
        }}
        onMouseLeave={() => {
          setTooltipVisible(false);
        }}
        style={{
          ...overlayStyle,
          ...fadeStyle(fadeVisible),
        }}
      >
        <img alt="" {...protectedImageProps} src={iconSrc} style={iconStyle} />
      </span>
      {tooltip ? (
        <AnchoredEncounterTooltip
          anchorRef={anchorRef}
          description={tooltip.description}
          label={tooltip.label}
          visible={tooltipVisible && fadeVisible}
        />
      ) : null}
    </>
  );
}

function statusLabel(participant: RoomParticipantDto, roomState?: RoomStateDto): string {
  if (participant.choiceState === 'disengaged') {
    return 'Inactive';
  }

  if (roomState === 'waiting_continue' && participant.continuePressed) {
    return 'Ready';
  }

  if (participant.choiceState === 'ready_to_continue' || participant.choiceState === 'resolved') {
    return 'Ready';
  }

  if (participant.choiceState === 'ready') {
    return 'Chose';
  }

  if (participant.choiceState === 'choosing') {
    return 'Choosing';
  }

  return '';
}

export function PartyMemberSlot({
  canKick = false,
  onKick,
  onDetailsVisibleChange,
  participant,
  roomState,
  systemEventActorPlayerId,
  slotSide = 'center',
  xpPulseToken,
}: {
  canKick?: boolean;
  onKick?: (targetPlayerId: string) => void;
  onDetailsVisibleChange?: (visible: boolean) => void;
  participant: RoomParticipantDto;
  roomState?: RoomStateDto;
  systemEventActorPlayerId?: string;
  slotSide?: AvatarDetailsSlotSide;
  xpPulseToken?: number;
}) {
  const [portraitSrc, setPortraitSrc] = useState(participant.avatar.portrait);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const disengaged = participant.choiceState === 'disengaged';
  const waitingContinue = roomState === 'waiting_continue' && participant.continuePressed;
  const focusState = participant.focusState;
  const focusIconSrc = focusState !== 'none'
    ? GAME_FOCUS_BUTTON_ICONS[focusState as keyof typeof GAME_FOCUS_BUTTON_ICONS]
    : undefined;
  const focusTooltip = focusState !== 'none' ? focusBadgeTooltip(focusState) : null;
  const showFocusBadge = Boolean(focusIconSrc && !detailsOpen);
  const focusPresence = useOpacityPresence(showFocusBadge);
  const [displayFocusIcon, setDisplayFocusIcon] = useState(focusIconSrc);
  const [displayFocusTooltip, setDisplayFocusTooltip] = useState(focusTooltip);
  const detailsAnchorRef = useRef<HTMLButtonElement>(null);
  const badge = statusLabel(participant, roomState);

  useEffect(() => {
    if (focusIconSrc) {
      setDisplayFocusIcon(focusIconSrc);
    }
    if (focusTooltip) {
      setDisplayFocusTooltip(focusTooltip);
    }
  }, [focusIconSrc, focusTooltip]);

  // Report only when the details state changes, not whenever the parent hands
  // over a new callback (inline callbacks are new on every render).
  const onDetailsVisibleChangeRef = useRef(onDetailsVisibleChange);
  onDetailsVisibleChangeRef.current = onDetailsVisibleChange;
  useEffect(() => {
    onDetailsVisibleChangeRef.current?.(detailsOpen);
  }, [detailsOpen]);

  return (
    <div
      aria-label={`${participant.avatar.name} party slot`}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      onContextMenu={preventImageContextMenu}
      style={{
        ...slotStyle,
        zIndex: detailsOpen ? 40 : slotStyle.zIndex,
      }}
    >
      <div style={columnStyle}>
        <div style={portraitWrapStyle}>
          <button
            ref={detailsAnchorRef}
            aria-expanded={detailsOpen}
            aria-label={`${participant.avatar.name}, level ${participant.avatar.level}. ${badge || 'party member'}. ${detailsOpen ? 'Hide' : 'Show'} details`}
            className={[
              'morkahja-avatar-slot-button',
              disengaged ? 'morkahja-party-member-disengaged' : '',
              waitingContinue ? 'morkahja-party-member-continue-glow' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => {
              setDetailsOpen((open) => !open);
            }}
            onContextMenu={preventImageContextMenu}
            style={portraitButtonStyle}
            type="button"
          >
            <span className="morkahja-avatar-slot-visual">
              <AvatarPortraitStack
                frame={participant.avatar.frame}
                frameScale={1.01}
                onPortraitError={() => {
                  setPortraitSrc(PORTRAIT_FALLBACK);
                }}
                portrait={portraitSrc}
              />
              <EssenceSlotsRing avatarId={participant.avatar.id} essences={participant.avatar.inventory?.essences} />
              <LoreGemAvatarBadge held={participant.loreGemCollected === true} roomState={roomState} />
              <PartyParticipantChoiceBadge
                hidden={detailsOpen}
                participant={participant}
                roomState={roomState}
                systemEventActorPlayerId={systemEventActorPlayerId}
              />
              {focusPresence.mounted && displayFocusIcon ? (
                <PartyMemberFocusBadge
                  fadeVisible={focusPresence.visible}
                  iconSrc={displayFocusIcon}
                  iconStyle={focusBadgeIconStyle}
                  overlayStyle={focusBadgeOverlayStyle}
                  tooltip={displayFocusTooltip}
                />
              ) : null}
              {xpPulseToken ? <span aria-hidden="true" style={xpPulseDotStyle} /> : null}
            </span>
          </button>
          {detailsOpen ? (
            <AnchoredGamePopover anchorRef={detailsAnchorRef}>
              <AvatarPartyDetailsCard
                avatar={participant.avatar}
                footer={canKick && onKick ? (
                  <button
                    className="morkahja-party-kick-button"
                    onClick={() => {
                      onKick(participant.playerId);
                      setDetailsOpen(false);
                    }}
                    style={kickButtonStyle}
                    type="button"
                  >
                    Kick
                  </button>
                ) : undefined}
                inventory={participant.avatar.inventory}
                inventorySeed={participant.avatar.id}
                slotSide={slotSide}
                statusInactive={disengaged}
                statusLabel={badge || undefined}
              />
            </AnchoredGamePopover>
          ) : null}
        </div>
      </div>
      <style>
        {`@keyframes morkahja-party-xp-pulse {
  0% { opacity: 0; transform: translateX(-50%) scale(0.55); }
  24% { opacity: 1; transform: translateX(-50%) scale(1.05); }
  100% { opacity: 0; transform: translateX(-50%) scale(1.35); }
}`}
      </style>
    </div>
  );
}

export default PartyMemberSlot;
