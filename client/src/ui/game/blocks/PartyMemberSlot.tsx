import { useState, type CSSProperties } from 'react';
import type { RoomParticipantDto, RoomStateDto } from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import AvatarPortraitStack from '../../avatar/AvatarPortraitStack.js';
import { formatAvatarDisplayName } from '../../avatar/avatarDisplayName.js';
import { GAME_FOCUS_BUTTON_ICONS, GAME_UI_ROOT } from '../gameUiAssets.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const DICE_CHOICE_ICON = `${GAME_UI_ROOT}/im_button_dice_a.webp`;
const PORTRAIT_FALLBACK = 'avatar_verdani_female_mage_a.webp';

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
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

const choiceOverlayStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 7,
  width: 52,
  height: 52,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
};

const focusIconStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 6,
  display: 'block',
  width: 52,
  height: 52,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.65))',
  pointerEvents: 'none',
};

const choiceIconStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  borderRadius: '50%',
  objectFit: 'cover',
  boxShadow:
    '0 0 12px rgba(255, 204, 102, 0.55), 0 4px 10px rgba(0, 0, 0, 0.5)',
};

function solutionImagePath(solutionId: number): string | null {
  const solution = solutionsById[String(solutionId)];
  if (!solution) {
    return null;
  }

  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

function hasVisibleChoice(participant: RoomParticipantDto): boolean {
  if (
    participant.choiceState === 'disengaged'
    || participant.choiceState === 'witnessing'
  ) {
    return false;
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
}: {
  canKick?: boolean;
  onKick?: (targetPlayerId: string) => void;
  participant: RoomParticipantDto;
  roomState?: RoomStateDto;
}) {
  const [portraitSrc, setPortraitSrc] = useState(participant.avatar.portrait);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const disengaged = participant.choiceState === 'disengaged';
  const waitingContinue = roomState === 'waiting_continue' && participant.continuePressed;
  const focusIconSrc = participant.focusState !== 'none'
    ? GAME_FOCUS_BUTTON_ICONS[participant.focusState as keyof typeof GAME_FOCUS_BUTTON_ICONS]
    : undefined;
  const showChoice = hasVisibleChoice(participant) && !detailsOpen;
  const choiceSolutionSrc = participant.selectedSolutionId
    ? solutionImagePath(participant.selectedSolutionId)
    : null;
  const showDiceChoice = showChoice && !choiceSolutionSrc && participant.selectedAction === 'dice';
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
            <span aria-hidden="true" style={choiceOverlayStyle}>
              <img
                alt=""
                {...protectedImageProps}
                src={choiceSolutionSrc ?? DICE_CHOICE_ICON}
                style={choiceIconStyle}
              />
            </span>
          ) : null}
          {focusIconSrc && !detailsOpen ? (
            <img
              alt=""
              aria-hidden="true"
              {...protectedImageProps}
              src={focusIconSrc}
              style={focusIconStyle}
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
        </button>
      </div>
    </div>
  );
}

export default PartyMemberSlot;
