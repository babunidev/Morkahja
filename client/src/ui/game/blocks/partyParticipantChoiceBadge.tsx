import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fadeStyle } from '../../transitions/fade.js';
import { useOpacityPresence } from '../../transitions/opacityPresence.js';
import type {
  EncounterSnapshot,
  RoomParticipantDto,
  RoomStateDto,
} from '../../../api/http.js';
import { choiceRollBreakdown } from './rollBreakdown.js';
import { gameSolutions } from '../../../data/gameContent.js';
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
import { TOOLTIP_GOLD, TooltipDivider } from '../GameTooltip.js';
import { useLevelUpRollHold } from '../levelUpRollHold.js';
import { assetUrl } from '../../../assetUrl.js';

const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');
export const PARTY_BADGE_SIZE_PX = 62;

interface PartyBadgeTooltip {
  label: string;
  description?: string;
  breakdown?: string[];
}

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionName: string;
  mSolutionText: string;
}

function solutionsById(): Record<string, SolutionRecord> {
  return gameSolutions() as Record<string, SolutionRecord>;
}

const choiceBadgeOverlayStyle: CSSProperties = {
  // Top right of the portrait: the bottom edge holds the essence slots.
  position: 'absolute',
  right: '4%',
  top: '10%',
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

/**
 * Babuni (2026-11-18): once the roll is known it stands alone, big, in the
 * middle of the portrait; the used solution and the roll's parts move into
 * the avatar's tooltip.
 */
const bigRollOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 7,
  display: 'grid',
  placeItems: 'center',
  pointerEvents: 'none',
};

const bigRollStyle: CSSProperties = {
  position: 'static',
  fontSize: 'clamp(40px, 11vw, 64px)',
  lineHeight: 1,
  textShadow: '0 0 14px rgba(255, 204, 102, 0.75), 0 3px 10px rgba(0, 0, 0, 0.9), 0 0 3px rgba(0, 0, 0, 0.9)',
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
  const solution = solutionsById()[String(solutionId)];
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

  const solution = solutionsById()[String(solutionId)];
  if (!solution) {
    return null;
  }

  return {
    label: solution.mSolutionName,
    description: solution.mSolutionText,
  };
}

function diceChoiceIcon(participant: RoomParticipantDto): string {
  return assetUrl(diceButtonAssetPath(participant.selectedDiceId ?? DEFAULT_DICE_ID));
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

  const hasRoll = rollDisplay !== null && rollDisplay !== undefined;
  if (hasRoll) {
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
            ...bigRollOverlayStyle,
            ...(tooltip ? { pointerEvents: 'auto', cursor: 'default' } : {}),
            opacity: overlayStyle.opacity,
            transition: overlayStyle.transition,
          }}
        >
          <span
            className={
              revealRollSeparately
                ? 'morkahja-party-choice-roll morkahja-party-choice-roll--reveal morkahja-result-outcome'
                : 'morkahja-party-choice-roll morkahja-result-outcome'
            }
            style={bigRollStyle}
          >
            {displayRollAsD20(rollDisplay)}
          </span>
        </span>
        {tooltip ? (
          <AnchoredEncounterTooltip
            anchorRef={anchorRef}
            breakdown={tooltip.breakdown}
            description={tooltip.description}
            label={tooltip.label}
            visible={tooltipVisible}
          />
        ) : null}
      </>
    );
  }

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
          breakdown={tooltip.breakdown}
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

function withBreakdown(
  tooltip: PartyBadgeTooltip | null,
  breakdown: string[],
): PartyBadgeTooltip | null {
  if (!tooltip || breakdown.length === 0) {
    return tooltip;
  }
  return { ...tooltip, breakdown };
}

export function PartyParticipantChoiceBadge({
  encounter,
  hidden = false,
  overlayStyle = choiceBadgeOverlayInteractiveStyle,
  participant,
  roomState,
  systemEventActorPlayerId,
  tooltipInAvatar = false,
}: {
  encounter?: EncounterSnapshot;
  hidden?: boolean;
  /** The avatar's own tooltip shows the details (ChoiceDetailSections): the badge has none. */
  tooltipInAvatar?: boolean;
  overlayStyle?: CSSProperties;
  participant: RoomParticipantDto;
  roomState?: RoomStateDto;
  systemEventActorPlayerId?: string;
}) {
  // The local level-up pick is still rolling (D-049): keep its roll a secret.
  const levelUpRollHeld = useLevelUpRollHold() !== null && participant.isLocal === true;
  const showChoice = hasVisibleParticipantChoice(
    participant,
    roomState,
    systemEventActorPlayerId,
  ) && !hidden && !levelUpRollHeld;
  const choiceSolutionSrc = participant.selectedSolutionId
    ? solutionImagePath(participant.selectedSolutionId)
    : null;
  const choiceSolutionTooltip = solutionTooltipForId(participant.selectedSolutionId);
  const showDiceChoice = showChoice && !choiceSolutionSrc && participant.selectedAction === 'dice';
  const diceChoiceSrc = diceChoiceIcon(participant);
  const choiceRoll = participantChoiceRoll(participant);
  const choiceRollDisplay = choiceRoll !== undefined ? displayRollAsD20(choiceRoll) : null;
  const breakdown = choiceRollBreakdown(participant, encounter, choiceRoll);
  const badgeActive = showChoice && (choiceSolutionSrc !== null || showDiceChoice);
  const presence = useOpacityPresence(badgeActive);
  const snapshotRef = useRef<ChoiceBadgeSnapshot | null>(null);

  if (badgeActive) {
    snapshotRef.current = {
      iconSrc: choiceSolutionSrc ?? diceChoiceSrc,
      rollDisplay: choiceRoll,
      tooltip: withBreakdown(
        choiceSolutionTooltip
        ?? (showDiceChoice ? { label: 'Dice' } : null)
        ?? (choiceRollDisplay !== null
          ? { label: `Roll ${choiceRollDisplay}` }
          : null),
        breakdown,
      ),
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
      tooltip={tooltipInAvatar ? null : snapshotRef.current.tooltip}
    />
  );
}

export interface ParticipantChoiceDetails {
  used?: { name: string; text?: string };
  roll?: { display: number; lines: string[] };
}

/** What the participant used and rolled, for the avatar's tooltip; null before anything shows. */
export function participantChoiceDetails(
  participant: RoomParticipantDto | undefined,
  encounter: EncounterSnapshot | undefined,
  roomState?: RoomStateDto,
  systemEventActorPlayerId?: string,
): ParticipantChoiceDetails | null {
  if (!participant || !hasVisibleParticipantChoice(participant, roomState, systemEventActorPlayerId)) {
    return null;
  }
  const solution = participant.selectedSolutionId !== undefined
    ? solutionsById()[String(participant.selectedSolutionId)]
    : undefined;
  const used = solution
    ? { name: solution.mSolutionName, text: solution.mSolutionText?.trim() || undefined }
    : participant.selectedAction === 'dice'
      ? { name: 'Dice' }
      : undefined;
  const total = participantChoiceRoll(participant);
  const roll = total !== undefined
    ? { display: displayRollAsD20(total), lines: choiceRollBreakdown(participant, encounter, total) }
    : undefined;
  return used || roll ? { ...(used ? { used } : {}), ...(roll ? { roll } : {}) } : null;
}

const detailHeadingStyle: CSSProperties = {
  margin: 0,
  color: TOOLTIP_GOLD,
  fontSize: 'clamp(0.72rem, 2.8vw, 0.84rem)',
  fontWeight: 700,
};

const detailTextStyle: CSSProperties = {
  margin: '1px 0 0',
  color: '#f7efe0',
  fontSize: 'clamp(0.68rem, 2.6vw, 0.8rem)',
};

/** Sections below the avatar's name and level: the used solution, then the roll. */
export function ChoiceDetailSections({ details }: { details: ParticipantChoiceDetails }): ReactNode {
  return (
    <>
      {details.used ? (
        <>
          <TooltipDivider />
          <p style={detailHeadingStyle}>{details.used.name}</p>
          {details.used.text ? <p style={detailTextStyle}>{details.used.text}</p> : null}
        </>
      ) : null}
      {details.roll ? (
        <>
          <TooltipDivider />
          <p style={detailHeadingStyle}>Roll {details.roll.display}</p>
          {details.roll.lines.map((line) => (
            <p key={line} style={detailTextStyle}>{line}</p>
          ))}
        </>
      ) : null}
    </>
  );
}
