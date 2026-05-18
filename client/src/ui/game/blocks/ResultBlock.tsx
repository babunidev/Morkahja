import { useEffect, useRef, useState, type CSSProperties } from 'react';
import solutionData from '../../../data/game/solutiondata.json';
import { CONTINUE_SOUND, playSfx } from '../../sfx.js';
import { fadeTransition } from '../../transitions/fade.js';

const RESULT_BACKGROUND = '/UI/09_GAME/im_bg_result.webp';
const CONTINUE_BUTTON = '/UI/09_GAME/im_button_continue.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const LEVEL_UP_ENCOUNTER_ID = 2;
const CONTINUE_ANIMATION_MS = 1000;

type RollOutcome = 'Misery' | 'Hardship' | 'Disengage' | 'Fortune' | 'Prosperity';

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

const outcomeStyle: CSSProperties = {
  gridArea: '1 / 1',
  justifySelf: 'center',
  alignSelf: 'center',
  fontFamily: 'Georgia, serif',
  fontSize: '1.28rem',
  letterSpacing: '0.08em',
  lineHeight: 1,
  textAlign: 'center',
  textTransform: 'uppercase',
  zIndex: 2,
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

function interpretRoll(roll: number): RollOutcome | null {
  if (roll >= 1 && roll <= 10) {
    return 'Misery';
  }
  if (roll >= 11 && roll <= 39) {
    return 'Hardship';
  }
  if (roll >= 40 && roll <= 60) {
    return 'Disengage';
  }
  if (roll >= 61 && roll <= 95) {
    return 'Fortune';
  }
  if (roll >= 96 && roll <= 100) {
    return 'Prosperity';
  }
  return null;
}

function solutionImagePath(solution: SolutionRecord): string {
  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

function scaledUses(baseUse: number, encounterDifficulty: number): number {
  if (encounterDifficulty < 1) {
    return 0;
  }

  return Math.max(1, baseUse * encounterDifficulty);
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
  outcome: RollOutcome | null;
}): number[] {
  if (outcome === null) {
    return [];
  }

  const isLevelUp = encounterId === LEVEL_UP_ENCOUNTER_ID;
  const successful = outcome === 'Fortune' || outcome === 'Prosperity';

  if (!isLevelUp && !successful) {
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
  onContinue,
  prosperityRewardId,
  rewardIds = [],
  roll,
}: {
  disabled?: boolean;
  encounterDifficulty: number;
  encounterId: number;
  hidden?: boolean;
  onContinue: () => void;
  prosperityRewardId?: number | null;
  rewardIds?: number[];
  roll: number | null;
}) {
  const [continueAnimating, setContinueAnimating] = useState(false);
  const [rewardTooltip, setRewardTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const continueTimer = useRef<number | null>(null);
  const outcome = roll === null ? null : interpretRoll(roll);
  const visible = roll !== null;
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

  function showRewardTooltip(
    reward: VisibleReward,
    event: { currentTarget: HTMLElement },
  ): void {
    const blockRect = blockRef.current?.getBoundingClientRect();
    const itemRect = event.currentTarget.getBoundingClientRect();
    const x = blockRect ? itemRect.left - blockRect.left + itemRect.width / 2 : itemRect.width / 2;
    const y = blockRect ? itemRect.top - blockRect.top : 0;

    setRewardTooltip({
      text: `${reward.solution.mSolutionName}\n+${reward.quantity}`,
      x,
      y,
    });
  }

  function hideRewardTooltip(): void {
    setRewardTooltip(null);
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
          {rewards.map((reward) => (
            <button
              aria-label={`${reward.solution.mSolutionName}, quantity ${reward.quantity}`}
              key={reward.solution.mSolutionID}
              onBlur={hideRewardTooltip}
              onFocus={(event) => {
                showRewardTooltip(reward, event);
              }}
              onPointerCancel={hideRewardTooltip}
              onPointerEnter={(event) => {
                showRewardTooltip(reward, event);
              }}
              onPointerLeave={hideRewardTooltip}
              style={rewardItemStyle}
              type="button"
            >
              <img
                alt=""
                aria-hidden="true"
                draggable={false}
                src={solutionImagePath(reward.solution)}
                style={rewardImageStyle}
              />
            </button>
          ))}
        </div>
      ) : null}
      {rewardTooltip ? (
        <div
          style={{
            ...rewardTooltipStyle,
            left: rewardTooltip.x,
            top: rewardTooltip.y,
          }}
        >
          {rewardTooltip.text}
        </div>
      ) : null}
      {outcome ? <span className="morkahja-title" style={outcomeStyle}>{outcome}</span> : null}
    </div>
  );
}

export default ResultBlock;
