import { useRef, useState, type CSSProperties } from 'react';
import type {
  ParticipantFocusStateDto,
  RoomParticipantDto,
  RoomStateDto,
} from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import {
  diceButtonAssetPath,
  DEFAULT_DICE_ID,
} from '@shared/diceCatalog.js';
import AvatarPortraitStack from '../../avatar/AvatarPortraitStack.js';
import { formatAvatarDisplayName } from '../../avatar/avatarDisplayName.js';
import { GAME_FOCUS_BUTTON_ICONS } from '../gameUiAssets.js';
import {
  AnchoredEncounterTooltip,
} from '../encounterTooltip.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const PORTRAIT_FALLBACK = 'avatar_verdani_female_mage_a.webp';
const PARTY_BADGE_SIZE_PX = 62;

interface PartyBadgeTooltip {
  label: string;
  description?: string;
}

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionName: string;
  mSolutionText: string;
}

const solutionsById = solutionData as Record<string, SolutionRecord>;

const slotStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
  minWidth: 0,
  position: 'relative',
};

const columnStyle: CSSProperties = {
  width: 'min(100%, 140px)',
  maxWidth: 'min(28vw, 140px)',
  justifySelf: 'center',
  display: 'grid',
  placeItems: 'center',
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

const detailsOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 8,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '8px 6px',
  boxSizing: 'border-box',
  background: 'rgba(8, 4, 2, 0.72)',
  borderRadius: 8,
  pointerEvents: 'auto',
};

const nameStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(11px, 2.8vw, 14px)',
  lineHeight: 1.2,
  letterSpacing: '0.03em',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.85)',
};

const metaStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'center',
  color: 'rgba(247, 239, 224, 0.9)',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(10px, 2.4vw, 12px)',
  lineHeight: 1.25,
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.85)',
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

function PartyMemberOverlayBadge({
  iconSrc,
  iconStyle = badgeIconStyle,
  overlayStyle = badgeOverlayInteractiveStyle,
  tooltip,
}: {
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
        className="morkahja-party-choice-badge"
        onMouseEnter={() => {
          if (tooltip) {
            setTooltipVisible(true);
          }
        }}
        onMouseLeave={() => {
          setTooltipVisible(false);
        }}
        style={overlayStyle}
      >
        <img alt="" {...protectedImageProps} src={iconSrc} style={iconStyle} />
      </span>
      {tooltip ? (
        <AnchoredEncounterTooltip
          anchorRef={anchorRef}
          description={tooltip.description}
          label={tooltip.label}
          visible={tooltipVisible}
        />
      ) : null}
    </>
  );
}

function solutionImagePath(solutionId: number): string | null {
  const solution = solutionsById[String(solutionId)];
  if (!solution) {
    return null;
  }

  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

function solutionTooltipForId(
  solutionId: number | undefined,
): PartyBadgeTooltip | null {
  if (solutionId === undefined) {
    return null;
  }

  const solution = solutionsById[String(solutionId)];
  if (!solution) {
    return null;
  }

  return {
    label: solution.mSolutionName,
    description: solution.mSolutionText,
  };
}

function diceChoiceIcon(participant: RoomParticipantDto): string {
  return diceButtonAssetPath(participant.selectedDiceId ?? DEFAULT_DICE_ID);
}

function hasVisibleChoice(
  participant: RoomParticipantDto,
  roomState?: RoomStateDto,
  systemEventActorPlayerId?: string,
): boolean {
  if (
    participant.choiceState === 'disengaged'
    || participant.choiceState === 'witnessing'
  ) {
    return false;
  }

  if (roomState === 'system_event') {
    if (systemEventActorPlayerId !== participant.playerId) {
      return false;
    }

    return (
      participant.preparedResult !== undefined
      || participant.resolutionSummary !== undefined
      || participant.choiceState === 'ready_to_continue'
      || participant.choiceState === 'resolved'
    );
  }

  if (
    participant.selectedSolutionId !== undefined
    || participant.selectedAction !== undefined
  ) {
    return true;
  }

  return participant.choiceState === 'ready'
    || participant.choiceState === 'resolved'
    || participant.choiceState === 'ready_to_continue';
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

function participantAvatarMeta(avatar: RoomParticipantDto['avatar']): string {
  return `${avatar.race} ${avatar.role} · Level ${avatar.level}`;
}

export function PartyMemberSlot({
  canKick = false,
  onKick,
  participant,
  roomState,
  systemEventActorPlayerId,
  xpPulseToken,
}: {
  canKick?: boolean;
  onKick?: (targetPlayerId: string) => void;
  participant: RoomParticipantDto;
  roomState?: RoomStateDto;
  systemEventActorPlayerId?: string;
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
  const showChoice = hasVisibleChoice(participant, roomState, systemEventActorPlayerId) && !detailsOpen;
  const choiceSolutionSrc = participant.selectedSolutionId
    ? solutionImagePath(participant.selectedSolutionId)
    : null;
  const choiceSolutionTooltip = solutionTooltipForId(participant.selectedSolutionId);
  const showDiceChoice = showChoice && !choiceSolutionSrc && participant.selectedAction === 'dice';
  const diceChoiceSrc = diceChoiceIcon(participant);
  const badge = statusLabel(participant, roomState);
  const avatarDisplayName = formatAvatarDisplayName(participant.avatar);
  const avatarMeta = participantAvatarMeta(participant.avatar);

  return (
    <div
      aria-label={`${avatarDisplayName} party slot`}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      onContextMenu={preventImageContextMenu}
      style={slotStyle}
    >
      <div style={columnStyle}>
        <button
          aria-expanded={detailsOpen}
          aria-label={`${avatarDisplayName}, ${avatarMeta}. ${badge || 'party member'}. ${detailsOpen ? 'Hide' : 'Show'} details`}
          className={
            disengaged
              ? 'morkahja-party-member-disengaged'
              : waitingContinue
                ? 'morkahja-party-member-continue-glow'
                : undefined
          }
          onClick={() => {
            setDetailsOpen((open) => !open);
          }}
          onContextMenu={preventImageContextMenu}
          style={portraitButtonStyle}
          type="button"
        >
          <AvatarPortraitStack
            frame={participant.avatar.frame}
            frameScale={1.01}
            onPortraitError={() => {
              setPortraitSrc(PORTRAIT_FALLBACK);
            }}
            portrait={portraitSrc}
          />
          {showChoice && (choiceSolutionSrc || showDiceChoice) ? (
            <PartyMemberOverlayBadge
              iconSrc={choiceSolutionSrc ?? diceChoiceSrc}
              tooltip={
                choiceSolutionTooltip
                ?? (showDiceChoice ? { label: 'Dice' } : null)
              }
            />
          ) : null}
          {focusIconSrc && !detailsOpen ? (
            <PartyMemberOverlayBadge
              iconSrc={focusIconSrc}
              iconStyle={focusBadgeIconStyle}
              overlayStyle={focusBadgeOverlayStyle}
              tooltip={focusTooltip}
            />
          ) : null}
          {detailsOpen ? (
            <div
              className="morkahja-party-details-overlay"
              style={detailsOverlayStyle}
            >
              <p style={nameStyle}>{avatarDisplayName}</p>
              <p style={metaStyle}>{avatarMeta}</p>
              {badge ? (
                <span
                  className={
                    disengaged
                      ? 'morkahja-party-status-badge morkahja-party-status-badge-inactive'
                      : 'morkahja-party-status-badge'
                  }
                >
                  {badge}
                </span>
              ) : null}
              {canKick && onKick ? (
                <button
                  className="morkahja-party-kick-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onKick(participant.playerId);
                    setDetailsOpen(false);
                  }}
                  type="button"
                >
                  Kick
                </button>
              ) : null}
            </div>
          ) : null}
          {xpPulseToken ? <span aria-hidden="true" style={xpPulseDotStyle} /> : null}
        </button>
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
