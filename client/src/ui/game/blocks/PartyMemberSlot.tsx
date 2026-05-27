import type { CSSProperties } from 'react';
import type { RoomParticipantDto, RoomStateDto } from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import AvatarPortraitStack from '../../avatar/AvatarPortraitStack.js';
import { GAME_FOCUS_BUTTON_ICONS, GAME_UI_ROOT } from '../gameUiAssets.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const DICE_CHOICE_ICON = `${GAME_UI_ROOT}/im_button_dice_a.webp`;

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

const anchorStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 140px)',
  maxWidth: 'min(28vw, 140px)',
  justifySelf: 'center',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  top: -6,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 6,
  lineHeight: 1,
  pointerEvents: 'none',
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
  display: 'block',
  width: 26,
  height: 26,
  objectFit: 'contain',
  filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55))',
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
  return participant.choiceState === 'ready'
    || participant.choiceState === 'resolved';
}

export function PartyMemberSlot({
  participant,
  roomState,
}: {
  participant: RoomParticipantDto;
  roomState?: RoomStateDto;
}) {
  const disengaged = participant.choiceState === 'disengaged';
  const waitingContinue = roomState === 'waiting_continue' && participant.continuePressed;
  const focusIconSrc = participant.focusState !== 'none'
    ? GAME_FOCUS_BUTTON_ICONS[participant.focusState]
    : undefined;
  const showChoice = hasVisibleChoice(participant);
  const choiceSolutionSrc = participant.selectedSolutionId
    ? solutionImagePath(participant.selectedSolutionId)
    : null;
  const showDiceChoice = showChoice && !choiceSolutionSrc && participant.selectedAction === 'dice';

  return (
    <div
      aria-label={`${participant.playerName} party slot`}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      onContextMenu={preventImageContextMenu}
      style={slotStyle}
    >
      <div
        className={
          disengaged
            ? 'morkahja-party-member-disengaged'
            : waitingContinue
              ? 'morkahja-party-member-continue-glow'
              : undefined
        }
        style={anchorStyle}
      >
        <AvatarPortraitStack
          frame={participant.avatar.frame}
          frameScale={1.01}
          portrait={participant.avatar.portrait}
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
        {focusIconSrc ? (
          <span aria-hidden="true" style={overlayStyle}>
            <img
              alt=""
              {...protectedImageProps}
              src={focusIconSrc}
              style={focusIconStyle}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default PartyMemberSlot;
