import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { fadeStyle } from '../../transitions/fade.js';
import { useOpacityPresence } from '../../transitions/opacityPresence.js';
import type {
  RoomParticipantDto,
  RoomStateDto,
} from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import {
  diceButtonAssetPath,
  DEFAULT_DICE_ID,
} from '@shared/diceCatalog.js';
import { displayRollAsD20 } from '@shared/diceInterpreter.js';
import {
  AnchoredEncounterTooltip,
} from '../encounterTooltip.js';
import {
  protectedImageProps,
} from '../../protectedImage.js';

const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
export const PARTY_BADGE_SIZE_PX = 62;

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

const choiceBadgeOverlayStyle: CSSProperties = {
  position: 'absolute',
  right: '4%',
  bottom: '10%',
  zIndex: 7,
  width: PARTY_BADGE_SIZE_PX,
  height: PARTY_BADGE_SIZE_PX,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
};

const choiceBadgeOverlayInteractiveStyle: CSSProperties = {
  ...choiceBadgeOverlayStyle,
  pointerEvents: 'auto',
  cursor: 'default',
};

const badgeContentStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  height: '100%',
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

export function hasVisibleParticipantChoice(
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

function participantChoiceRoll(participant: RoomParticipantDto): number | undefined {
  return participant.preparedResult?.selectedRoll
    ?? participant.resolutionSummary?.selectedRoll;
}

function PartyChoiceOverlayBadge({
  iconSrc,
  iconStyle = badgeIconStyle,
  overlayStyle = choiceBadgeOverlayInteractiveStyle,
  pulseVisible = false,
  rollDisplay,
  tooltip,
}: {
  iconSrc: string;
  iconStyle?: CSSProperties;
  overlayStyle?: CSSProperties;
  pulseVisible?: boolean;
  rollDisplay?: number | null;
  tooltip: PartyBadgeTooltip | null;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const mountedWithRollRef = useRef(rollDisplay !== null && rollDisplay !== undefined);
  const revealRollSeparately = rollDisplay !== null
    && rollDisplay !== undefined
    && !mountedWithRollRef.current;

  useEffect(() => {
    if (rollDisplay !== null && rollDisplay !== undefined) {
      mountedWithRollRef.current = true;
    }
  }, [rollDisplay]);

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
        style={overlayStyle}
      >
        <span
          className={pulseVisible ? 'morkahja-party-choice-badge--pulse' : undefined}
          style={badgeContentStyle}
        >
          <img alt="" {...protectedImageProps} src={iconSrc} style={iconStyle} />
          {rollDisplay !== null && rollDisplay !== undefined ? (
            <span
              aria-hidden="true"
              className={
                revealRollSeparately
                  ? 'morkahja-party-choice-roll morkahja-party-choice-roll--reveal morkahja-result-outcome'
                  : 'morkahja-party-choice-roll morkahja-result-outcome'
              }
            >
              {displayRollAsD20(rollDisplay)}
            </span>
          ) : null}
        </span>
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

interface ChoiceBadgeSnapshot {
  iconSrc: string;
  rollDisplay?: number;
  tooltip: PartyBadgeTooltip | null;
}

export function PartyParticipantChoiceBadge({
  hidden = false,
  overlayStyle = choiceBadgeOverlayInteractiveStyle,
  participant,
  roomState,
  systemEventActorPlayerId,
}: {
  hidden?: boolean;
  overlayStyle?: CSSProperties;
  participant: RoomParticipantDto;
  roomState?: RoomStateDto;
  systemEventActorPlayerId?: string;
}) {
  const showChoice = hasVisibleParticipantChoice(
    participant,
    roomState,
    systemEventActorPlayerId,
  ) && !hidden;
  const choiceSolutionSrc = participant.selectedSolutionId
    ? solutionImagePath(participant.selectedSolutionId)
    : null;
  const choiceSolutionTooltip = solutionTooltipForId(participant.selectedSolutionId);
  const showDiceChoice = showChoice && !choiceSolutionSrc && participant.selectedAction === 'dice';
  const diceChoiceSrc = diceChoiceIcon(participant);
  const choiceRoll = participantChoiceRoll(participant);
  const choiceRollDisplay = choiceRoll !== undefined ? displayRollAsD20(choiceRoll) : null;
  const badgeActive = showChoice && (choiceSolutionSrc !== null || showDiceChoice);
  const presence = useOpacityPresence(badgeActive);
  const snapshotRef = useRef<ChoiceBadgeSnapshot | null>(null);

  if (badgeActive) {
    snapshotRef.current = {
      iconSrc: choiceSolutionSrc ?? diceChoiceSrc,
      rollDisplay: choiceRoll,
      tooltip:
        choiceSolutionTooltip
        ?? (showDiceChoice ? { label: 'Dice' } : null)
        ?? (choiceRollDisplay !== null
          ? { label: `Roll ${choiceRollDisplay}` }
          : null),
    };
  }

  if (!presence.mounted || !snapshotRef.current) {
    return null;
  }

  return (
    <PartyChoiceOverlayBadge
      iconSrc={snapshotRef.current.iconSrc}
      overlayStyle={{
        ...overlayStyle,
        ...fadeStyle(presence.visible),
      }}
      pulseVisible={presence.visible}
      rollDisplay={snapshotRef.current.rollDisplay}
      tooltip={snapshotRef.current.tooltip}
    />
  );
}
