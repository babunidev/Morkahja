import type { CSSProperties } from 'react';
import type { RoomParticipantDto } from '../../../api/http.js';
import AvatarPortraitStack from '../../avatar/AvatarPortraitStack.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
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
  fontSize: '1.1rem',
  lineHeight: 1,
  pointerEvents: 'none',
};

const FOCUS_ICONS: Record<string, string> = {
  lore: '📜',
  inventory: '🎒',
  skillbook: '📖',
};

export function PartyMemberSlot({
  participant,
}: {
  participant: RoomParticipantDto;
}) {
  const disengaged = participant.choiceState === 'disengaged';
  const waitingContinue =
    participant.continuePressed &&
    participant.resolutionSummary !== undefined;

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
        {participant.focusState !== 'none' ? (
          <span aria-hidden="true" style={overlayStyle}>
            {FOCUS_ICONS[participant.focusState] ?? '•'}
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
