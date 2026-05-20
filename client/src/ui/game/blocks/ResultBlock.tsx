import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AvatarInventory } from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import {
  interpretRoll,
  isRollFavorable,
  predictEncounterLosses,
  scaledUses,
  usedEncounterSolution,
  type EncounterInventoryChange,
} from '../encounterInventoryPreview.js';
import { CONTINUE_SOUND, playSfx } from '../../sfx.js';
import { fadeTransition } from '../../transitions/fade.js';

const RESULT_BACKGROUND = '/UI/09_GAME/im_bg_result.webp';
const CONTINUE_BUTTON = '/UI/09_GAME/im_button_continue.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const LEVEL_UP_ENCOUNTER_ID = 2;
const CONTINUE_ANIMATION_MS = 1000;

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionName: string;
  mSolutionUses: number;
}

interface VisibleReward {
  quantity: number;
  solution: SolutionRecord;
}

type ItemTooltipState = {
  text: string;
  x: number;
  y: number;
};

const resultBlockStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 0,
  height: 10,
  width: '108%',
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
  alignItems: 'center',
  justifyItems: 'center',
  transform: 'translate(-50%, -4px)',
  zIndex: 21,
  overflow: 'visible',
  transition: fadeTransition,
  pointerEvents: 'none',
};

const resultImageStyle: CSSProperties = {
  gridArea: '1 / 1',
  display: 'block',
  width: '100%',
  height: 'auto',
};

const continueButtonStyle: CSSProperties = {
  gridArea: '1 / 1',
  justifySelf: 'end',
  alignSelf: 'center',
  width: 92,
  marginRight: '7%',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  pointerEvents: 'auto',
  zIndex: 1,
};

const continueImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 5px 9px rgba(0, 0, 0, 0.45))',
};

const continueAnimatingStyle: CSSProperties = {
  animation: 'morkahja-continue-bounce-right 1000ms ease-in-out',
};

const outcomeClusterStyle: CSSProperties = {
  gridArea: '1 / 1',
  justifySelf: 'center',
  alignSelf: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'clamp(8px, 2.4vw, 14px)',
  maxWidth: '88%',
  zIndex: 12,
  pointerEvents: 'auto',
};

const outcomeButtonStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  border: 0,
  background: 'transparent',
  fontSize: 'clamp(1.15rem, 4.8vw, 1.55rem)',
  lineHeight: 1,
  textAlign: 'center',
  textTransform: 'uppercase',
  cursor: 'pointer',
  flex: '0 0 auto',
};

const rewardRowStyle: CSSProperties = {
  gridArea: '1 / 1',
  justifySelf: 'center',
  alignSelf: 'center',
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '58%',
  transform: 'translateY(-48px)',
  zIndex: 11,
  pointerEvents: 'auto',
};

const rewardItemStyle: CSSProperties = {
  display: 'block',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'help',
};

const rewardImageStyle: CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: '50%',
  objectFit: 'cover',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  boxShadow: '0 0 12px rgba(255, 204, 102, 0.42), 0 5px 10px rgba(0, 0, 0, 0.46)',
};

const usedSolutionItemStyle: CSSProperties = {
  ...rewardItemStyle,
  flex: '0 0 auto',
};

const usedSolutionImageStyle: CSSProperties = {
  ...rewardImageStyle,
  width: 48,
  height: 48,
  border: '1px solid rgba(247, 239, 224, 0.72)',
  boxShadow: '0 0 10px rgba(247, 239, 224, 0.28), 0 5px 10px rgba(0, 0, 0, 0.46)',
};

const lossRowStyle: CSSProperties = {
  ...rewardRowStyle,
  transform: 'translateY(42px)',
  zIndex: 11,
};

const lossImageStyle: CSSProperties = {
  ...rewardImageStyle,
  border: '1px solid rgba(255, 96, 72, 0.9)',
  boxShadow:
    '0 0 14px rgba(255, 56, 40, 0.72), 0 0 26px rgba(180, 18, 8, 0.5), 0 5px 10px rgba(0, 0, 0, 0.46)',
};

const rewardTooltipStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  maxWidth: 180,
  padding: '7px 10px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.94)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.78rem',
  lineHeight: 1.25,
  textAlign: 'center',
  textShadow: '0 2px 5px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  pointerEvents: 'none',
  whiteSpace: 'pre-line',
  transform: 'translate(-50%, calc(-100% - 12px))',
};

const solutionsById = solutionData as Record<string, SolutionRecord>;

function solutionImagePath(solution: SolutionRecord): string {
  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

function visibleRewardIds({
  encounterId,
  prosperityRewardId,
  rewardIds,
  outcome,
}: {
  encounterId: number;
  prosperityRewardId?: number | null;
  rewardIds: number[];
  outcome: ReturnType<typeof interpretRoll>;
}): number[] {
  if (outcome === null) {
    return [];
  }

  if (encounterId === LEVEL_UP_ENCOUNTER_ID) {
    return rewardIds;
  }

  const successful = outcome === 'Fortune' || outcome === 'Prosperity';

  if (!successful) {
    return [];
  }

  return [
    ...rewardIds,
    ...(outcome === 'Prosperity' && prosperityRewardId ? [prosperityRewardId] : []),
  ];
}

export function ResultBlock({
  disabled = false,
  encounterDifficulty,
  encounterId,
  hidden = false,
  inventory,
  onContinue,
  prosperityRewardId,
  rewardIds = [],
  roll,
  usedSolutionId = null,
}: {
  disabled?: boolean;
  encounterDifficulty: number;
  encounterId: number;
  hidden?: boolean;
  inventory?: AvatarInventory;
  onContinue: () => void;
  prosperityRewardId?: number | null;
  rewardIds?: number[];
  roll: number | null;
  usedSolutionId?: number | null;
}) {
  const [continueAnimating, setContinueAnimating] = useState(false);
  const [outcomeShowsRoll, setOutcomeShowsRoll] = useState(false);
  const [itemTooltip, setItemTooltip] = useState<ItemTooltipState | null>(null);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const continueTimer = useRef<number | null>(null);
  const outcome = roll === null ? null : interpretRoll(roll);
  const visible = roll !== null;
  const isLevelUp = encounterId === LEVEL_UP_ENCOUNTER_ID;
  const usedSolution = usedEncounterSolution({ inventory, solutionId: usedSolutionId });
  const usedSolutionCost = usedSolutionId === null
    ? 0
    : scaledUses(1, encounterDifficulty);
  const losses = isLevelUp
    ? []
    : predictEncounterLosses({
      encounterDifficulty,
      inventory,
      outcome,
      success: roll !== null && isRollFavorable(roll),
      usedSolutionId,
    });
  const rewards = visibleRewardIds({
    encounterId,
    prosperityRewardId,
    rewardIds,
    outcome,
  }).reduce<VisibleReward[]>((visibleRewards, rewardId) => {
    const solution = solutionsById[String(rewardId)];

    if (!solution) {
      return visibleRewards;
    }

    const quantity = scaledUses(solution.mSolutionUses ?? 1, encounterDifficulty);
    const existing = visibleRewards.find((reward) => reward.solution.mSolutionID === rewardId);

    if (existing) {
      existing.quantity += quantity;
      return visibleRewards;
    }

    visibleRewards.push({ quantity, solution });
    return visibleRewards;
  }, []);

  useEffect(() => {
    setOutcomeShowsRoll(false);
  }, [roll]);

  useEffect(() => () => {
    if (continueTimer.current !== null) {
      window.clearTimeout(continueTimer.current);
    }
  }, []);

  function handleContinueClick(): void {
    if (disabled || hidden || !visible || continueAnimating) {
      return;
    }

    playSfx(CONTINUE_SOUND);
    setContinueAnimating(true);
    continueTimer.current = window.setTimeout(() => {
      continueTimer.current = null;
      setContinueAnimating(false);
      onContinue();
    }, CONTINUE_ANIMATION_MS);
  }

  function showItemTooltip(
    change: EncounterInventoryChange | VisibleReward,
    sign: '+' | '-' | 'used',
    event: { currentTarget: HTMLElement },
  ): void {
    const blockRect = blockRef.current?.getBoundingClientRect();
    const itemRect = event.currentTarget.getBoundingClientRect();
    const x = blockRect ? itemRect.left - blockRect.left + itemRect.width / 2 : itemRect.width / 2;
    const y = blockRect ? itemRect.top - blockRect.top : 0;
    const quantityLabel = sign === 'used'
      ? `Used (−${usedSolutionCost})`
      : `${sign}${change.quantity}`;

    setItemTooltip({
      text: `${change.solution.mSolutionName}\n${quantityLabel}`,
      x,
      y,
    });
  }

  function hideItemTooltip(): void {
    setItemTooltip(null);
  }

  function renderSolutionIcon(
    change: EncounterInventoryChange | VisibleReward,
    sign: '+' | '-' | 'used',
    imageStyle: CSSProperties,
    buttonStyle: CSSProperties = rewardItemStyle,
  ) {
    return (
      <button
        aria-label={`${change.solution.mSolutionName}, ${sign === 'used' ? 'used' : `quantity ${change.quantity}`}`}
        key={`${sign}-${change.solution.mSolutionID}`}
        onBlur={hideItemTooltip}
        onFocus={(event) => {
          showItemTooltip(change, sign, event);
        }}
        onPointerCancel={hideItemTooltip}
        onPointerEnter={(event) => {
          showItemTooltip(change, sign, event);
        }}
        onPointerLeave={hideItemTooltip}
        style={buttonStyle}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={solutionImagePath(change.solution)}
          style={imageStyle}
        />
      </button>
    );
  }

  return (
    <div
      aria-hidden={roll === null}
      ref={blockRef}
      style={{
        ...resultBlockStyle,
        opacity: visible && !hidden ? 1 : 0,
      }}
    >
      <style>
        {'@keyframes morkahja-continue-bounce-right { 0% { transform: translateX(0) scale(1); filter: brightness(1); } 14% { transform: translateX(10px) scale(1.035); filter: brightness(1.12); } 28% { transform: translateX(2px) scale(0.995); } 42% { transform: translateX(13px) scale(1.04); filter: brightness(1.18); } 58% { transform: translateX(3px) scale(0.998); } 74% { transform: translateX(16px) scale(1.045); filter: brightness(1.24); } 88% { transform: translateX(6px) scale(1.01); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }'}
      </style>
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={RESULT_BACKGROUND}
        style={resultImageStyle}
      />
      <button
        aria-label="Continue"
        disabled={disabled || continueAnimating}
        onClick={handleContinueClick}
        style={{
          ...continueButtonStyle,
          ...(continueAnimating ? continueAnimatingStyle : {}),
          cursor: disabled || continueAnimating ? 'default' : 'pointer',
          opacity: disabled ? 0.64 : 1,
          pointerEvents: visible && !hidden ? 'auto' : 'none',
        }}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={CONTINUE_BUTTON}
          style={continueImageStyle}
        />
      </button>
      {rewards.length > 0 ? (
        <div aria-label="Predetermined rewards" style={rewardRowStyle}>
          {rewards.map((reward) => renderSolutionIcon(reward, '+', rewardImageStyle))}
        </div>
      ) : null}
      {outcome && roll !== null ? (
        <div aria-label="Encounter outcome" style={outcomeClusterStyle}>
          {usedSolution && usedSolutionCost > 0
            ? renderSolutionIcon(
              { ...usedSolution, quantity: usedSolutionCost },
              'used',
              usedSolutionImageStyle,
              usedSolutionItemStyle,
            )
            : null}
          <button
            aria-label={outcomeShowsRoll ? `Roll ${roll}` : `${outcome}, show roll`}
            className="morkahja-result-outcome"
            onClick={() => {
              setOutcomeShowsRoll((showingRoll) => !showingRoll);
            }}
            style={outcomeButtonStyle}
            type="button"
          >
            {outcomeShowsRoll ? roll : outcome}
          </button>
        </div>
      ) : null}
      {losses.length > 0 ? (
        <div aria-label="Encounter losses" style={lossRowStyle}>
          {losses.map((loss) => renderSolutionIcon(loss, '-', lossImageStyle))}
        </div>
      ) : null}
      {itemTooltip ? (
        <div
          style={{
            ...rewardTooltipStyle,
            left: itemTooltip.x,
            top: itemTooltip.y,
          }}
        >
          {itemTooltip.text}
        </div>
      ) : null}
    </div>
  );
}

export default ResultBlock;
