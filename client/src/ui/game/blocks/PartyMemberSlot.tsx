import type { CSSProperties } from 'react';
import type { RoomParticipantDto, RoomStateDto } from '../../../api/http.js';
import AvatarPortraitStack from '../../avatar/AvatarPortraitStack.js';
import { GAME_FOCUS_BUTTON_ICONS } from '../gameUiAssets.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';

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

const focusIconStyle: CSSProperties = {
  display: 'block',
  width: 26,
  height: 26,
  objectFit: 'contain',
  filter: 'drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55))',
};

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
        {participant.choiceState === 'ready' && participant.selectedSolutionId ? (
          <span
            aria-hidden="true"
            style={{ ...overlayStyle, top: 'auto', bottom: -4, fontSize: '0.72rem' }}
          >
            ✓
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default PartyMemberSlot;
