import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { AvatarInventory, EncounterAction } from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import { interpretRoll, isRollFavorable } from '@shared/diceInterpreter';
import {
  predictEncounterLosses,
  scaledUses,
  usedEncounterSolution,
  type EncounterInventoryChange,
} from '../encounterInventoryPreview.js';
import {
  playLossFlightsFromAvatar,
  playRewardFlights,
  rewardFlyTargetKind,
  type LossFlightSpec,
  type RewardFlightSpec,
} from '../rewardFlyAnimation.js';
import { CONTINUE_SOUND, playSfx } from '../../sfx.js';
import { fadeTransition } from '../../transitions/fade.js';

const RESULT_BACKGROUND = '/UI/09_GAME/im_bg_result.webp';
const CONTINUE_BUTTON = '/UI/09_GAME/im_button_continue.webp';
const DICE_OUTCOME_ICON = '/UI/09_GAME/im_button_dice_a.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';
const ESSENCE_INVENTORY_TYPE = 3;
const LEVEL_UP_ENCOUNTER_ID = 2;
interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionInventoryType: number;
  mSolutionName: string;
  mSolutionText?: string;
  mSolutionUses: number;
}

interface VisibleReward {
  quantity: number;
  solution: SolutionRecord;
}

type ItemTooltipState = {
  name: string;
  quantityLabel: string;
  description?: string;
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

const CONTINUE_BOUNCE_MS = 1000;

const continueAnimatingStyle: CSSProperties = {
  animation: `morkahja-continue-bounce-right ${CONTINUE_BOUNCE_MS}ms ease-in-out`,
};

function waitContinueBounce(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, CONTINUE_BOUNCE_MS);
  });
}

function continueDismissLayerStyle(continueBusy: boolean): CSSProperties {
  return {
    opacity: continueBusy ? 0 : 1,
    transition: `opacity ${CONTINUE_BOUNCE_MS}ms ease-in-out`,
    pointerEvents: continueBusy ? 'none' : 'auto',
  };
}

const outcomeClusterStyle: CSSProperties = {
  gridArea: '1 / 1',
  justifySelf: 'center',
  alignSelf: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'clamp(8px, 2.4vw, 14px)',
  maxWidth: '88%',
  transform: 'translateX(-14px)',
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

const solutionIconImageBaseStyle: CSSProperties = {
  borderRadius: '50%',
  objectFit: 'cover',
};

const rewardImageStyle: CSSProperties = {
  ...solutionIconImageBaseStyle,
  width: 64,
  height: 64,
  boxShadow: '0 0 14px rgba(255, 204, 102, 0.38), 0 6px 12px rgba(0, 0, 0, 0.46)',
  animation: 'morkahja-reward-shake 3.2s ease-in-out infinite',
  transformOrigin: '50% 50%',
};

const usedSolutionItemStyle: CSSProperties = {
  ...rewardItemStyle,
  flex: '0 0 auto',
};

const usedSolutionImageStyle: CSSProperties = {
  ...solutionIconImageBaseStyle,
  width: 48,
  height: 48,
  boxShadow: '0 0 10px rgba(247, 239, 224, 0.28), 0 5px 10px rgba(0, 0, 0, 0.46)',
};

const lossRowStyle: CSSProperties = {
  ...rewardRowStyle,
  transform: 'translateY(42px)',
  zIndex: 11,
};

const lossItemImageStyle: CSSProperties = {
  ...solutionIconImageBaseStyle,
  width: 52,
  height: 52,
  border: '1px solid rgba(255, 96, 72, 0.9)',
  boxShadow:
    '0 0 14px rgba(255, 56, 40, 0.72), 0 0 26px rgba(180, 18, 8, 0.5), 0 5px 10px rgba(0, 0, 0, 0.46)',
};

const lossEssenceImageStyle: CSSProperties = {
  ...lossItemImageStyle,
  width: 60,
  height: 60,
};

const diceOutcomeIconStyle: CSSProperties = {
  width: 48,
  height: 'auto',
  flex: '0 0 auto',
  filter: 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.5))',
};

function lossIconSize(inventoryType: number): number {
  return inventoryType === ESSENCE_INVENTORY_TYPE ? 60 : 52;
}

function lossIconStyle(inventoryType: number): CSSProperties {
  return inventoryType === ESSENCE_INVENTORY_TYPE
    ? lossEssenceImageStyle
    : lossItemImageStyle;
}

const rewardTooltipStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  display: 'grid',
  gap: 4,
  minWidth: 148,
  maxWidth: 'min(280px, 72vw)',
  padding: '8px 12px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.94)',
  fontFamily: 'Georgia, serif',
  textShadow: '0 2px 5px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  pointerEvents: 'none',
  transform: 'translate(-50%, calc(-100% - 12px))',
};

const rewardTooltipTitleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '0.82rem',
  lineHeight: 1.2,
  textAlign: 'center',
};

const rewardTooltipMetaStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 220, 150, 0.92)',
  fontSize: '0.74rem',
  lineHeight: 1.2,
  textAlign: 'center',
};

const rewardTooltipTextStyle: CSSProperties = {
  margin: '2px 0 0',
  paddingTop: 4,
  borderTop: '1px solid rgba(255, 204, 102, 0.22)',
  color: 'rgba(247, 239, 224, 0.9)',
  fontSize: '0.72rem',
  lineHeight: 1.35,
  textAlign: 'left',
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
  resolutionAction = null,
  rewardIds = [],
  roll,
  usedSolutionId = null,
}: {
  disabled?: boolean;
  encounterDifficulty: number;
  encounterId: number;
  hidden?: boolean;
  inventory?: AvatarInventory;
  onContinue: () => void | Promise<void>;
  prosperityRewardId?: number | null;
  resolutionAction?: EncounterAction | null;
  rewardIds?: number[];
  roll: number | null;
  usedSolutionId?: number | null;
}) {
  const [continueBusy, setContinueBusy] = useState(false);
  const [outcomeShowsRoll, setOutcomeShowsRoll] = useState(false);
  const [itemTooltip, setItemTooltip] = useState<ItemTooltipState | null>(null);
  const [rewardsFlyingAway, setRewardsFlyingAway] = useState(false);
  const [lossesRevealed, setLossesRevealed] = useState(true);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const rewardButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const lossButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
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

  const lossesKey = useMemo(
    () => losses.map((loss) => `${loss.solution.mSolutionID}:${loss.quantity}`).join('|'),
    [losses],
  );

  useEffect(() => {
    setOutcomeShowsRoll(false);
    setRewardsFlyingAway(false);
    setLossesRevealed(losses.length === 0);
    rewardButtonRefs.current.clear();
    lossButtonRefs.current.clear();
  }, [roll, losses.length]);

  useEffect(() => {
    if (roll === null || losses.length === 0) {
      return undefined;
    }

    let cancelled = false;
    setLossesRevealed(false);

    async function playLossRevealFlights(): Promise<void> {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      if (cancelled) {
        return;
      }

      const flights: LossFlightSpec[] = [];

      for (const loss of losses) {
        const solutionId = loss.solution.mSolutionID;
        const button = lossButtonRefs.current.get(solutionId)
          ?? document.querySelector<HTMLButtonElement>(
            `[data-loss-fly-target="${solutionId}"]`,
          );
        const targetRect = button?.getBoundingClientRect();

        if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
          continue;
        }

        flights.push({
          id: `loss-fly-${solutionId}`,
          imageSrc: solutionImagePath(loss.solution),
          size: lossIconSize(loss.solution.mSolutionInventoryType),
          targetRect,
        });
      }

      if (flights.length > 0) {
        await playLossFlightsFromAvatar(flights);
      }

      if (!cancelled) {
        setLossesRevealed(true);
      }
    }

    void playLossRevealFlights();

    return () => {
      cancelled = true;
    };
  }, [roll, lossesKey]);

  function buildRewardFlights(): RewardFlightSpec[] {
    const flights: RewardFlightSpec[] = [];

    for (const reward of rewards) {
      const solutionId = reward.solution.mSolutionID;
      const button = rewardButtonRefs.current.get(solutionId)
        ?? document.querySelector<HTMLButtonElement>(
          `[data-reward-fly-source="${solutionId}"]`,
        );
      const sourceRect = button?.getBoundingClientRect();

      if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
        continue;
      }

      flights.push({
        id: `reward-fly-${reward.solution.mSolutionID}`,
        imageSrc: solutionImagePath(reward.solution),
        size: 64,
        sourceRect,
        target: rewardFlyTargetKind(reward.solution.mSolutionInventoryType),
      });
    }

    return flights;
  }

  async function handleContinueClick(): Promise<void> {
    if (disabled || hidden || !visible || continueBusy) {
      return;
    }

    setContinueBusy(true);
    playSfx(CONTINUE_SOUND);
    hideItemTooltip();

    try {
      const flights = buildRewardFlights();

      if (flights.length > 0) {
        setRewardsFlyingAway(true);
        await playRewardFlights(flights);
      } else {
        await waitContinueBounce();
      }

      await Promise.resolve(onContinue());
    } finally {
      // Keep rewards hidden after fly-out; roll reset in useEffect clears rewardsFlyingAway.
      setContinueBusy(false);
    }
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

    const description = change.solution.mSolutionText?.trim();

    setItemTooltip({
      name: change.solution.mSolutionName,
      quantityLabel,
      description: description || undefined,
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
    const trackRewardRef = sign === '+';

    return (
      <button
        aria-label={`${change.solution.mSolutionName}, ${sign === 'used' ? 'used' : `quantity ${change.quantity}`}`}
        data-reward-fly-source={trackRewardRef ? change.solution.mSolutionID : undefined}
        key={`${sign}-${change.solution.mSolutionID}`}
        ref={(element) => {
          if (!trackRewardRef) {
            return;
          }

          if (element) {
            rewardButtonRefs.current.set(change.solution.mSolutionID, element);
            return;
          }

          rewardButtonRefs.current.delete(change.solution.mSolutionID);
        }}
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

  function renderLossIcon(loss: EncounterInventoryChange) {
    const imageStyle = {
      ...lossIconStyle(loss.solution.mSolutionInventoryType),
      opacity: lossesRevealed ? 1 : 0,
      transition: lossesRevealed ? 'opacity 180ms ease' : 'none',
    };

    return (
      <button
        aria-label={`${loss.solution.mSolutionName}, quantity ${loss.quantity}`}
        data-loss-fly-target={loss.solution.mSolutionID}
        key={`loss-${loss.solution.mSolutionID}`}
        ref={(element) => {
          if (element) {
            lossButtonRefs.current.set(loss.solution.mSolutionID, element);
            return;
          }

          lossButtonRefs.current.delete(loss.solution.mSolutionID);
        }}
        onBlur={hideItemTooltip}
        onFocus={(event) => {
          showItemTooltip(loss, '-', event);
        }}
        onPointerCancel={hideItemTooltip}
        onPointerEnter={(event) => {
          showItemTooltip(loss, '-', event);
        }}
        onPointerLeave={hideItemTooltip}
        style={rewardItemStyle}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={solutionImagePath(loss.solution)}
          style={imageStyle}
        />
      </button>
    );
  }

  const resultInteractive = visible && !hidden;

  return (
    <div
      aria-hidden={roll === null}
      inert={resultInteractive ? undefined : true}
      ref={blockRef}
      style={{
        ...resultBlockStyle,
        opacity: resultInteractive ? 1 : 0,
      }}
    >
      <style>
        {`@keyframes morkahja-continue-bounce-right { 0% { transform: translateX(0) scale(1); filter: brightness(1); } 14% { transform: translateX(10px) scale(1.035); filter: brightness(1.12); } 28% { transform: translateX(2px) scale(0.995); } 42% { transform: translateX(13px) scale(1.04); filter: brightness(1.18); } 58% { transform: translateX(3px) scale(0.998); } 74% { transform: translateX(16px) scale(1.045); filter: brightness(1.24); } 88% { transform: translateX(6px) scale(1.01); } 100% { transform: translateX(0) scale(1); filter: brightness(1); } }
@keyframes morkahja-reward-shake {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-1.4deg); }
  40% { transform: rotate(1.2deg); }
  60% { transform: rotate(-0.9deg); }
  80% { transform: rotate(0.8deg); }
}`}
      </style>
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={RESULT_BACKGROUND}
        style={{
          ...resultImageStyle,
          ...continueDismissLayerStyle(continueBusy),
          pointerEvents: 'none',
        }}
      />
      <button
        aria-label="Continue"
        disabled={disabled || continueBusy}
        onClick={() => {
          void handleContinueClick();
        }}
        style={{
          ...continueButtonStyle,
          ...(continueBusy ? continueAnimatingStyle : {}),
          cursor: disabled || continueBusy ? 'default' : 'pointer',
          opacity: disabled ? 0.64 : 1,
          pointerEvents: resultInteractive && !continueBusy ? 'auto' : 'none',
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
      {rewards.length > 0 && !rewardsFlyingAway && !continueBusy ? (
        <div aria-label="Predetermined rewards" style={rewardRowStyle}>
          {rewards.map((reward) => renderSolutionIcon(reward, '+', rewardImageStyle))}
        </div>
      ) : null}
      {outcome && roll !== null ? (
        <div
          aria-label="Encounter outcome"
          style={{
            ...outcomeClusterStyle,
            ...continueDismissLayerStyle(continueBusy),
          }}
        >
          {usedSolution && usedSolutionCost > 0
            ? renderSolutionIcon(
              { ...usedSolution, quantity: usedSolutionCost },
              'used',
              usedSolutionImageStyle,
              usedSolutionItemStyle,
            )
            : null}
          {resolutionAction === 'dice' ? (
            <img
              alt=""
              aria-hidden="true"
              draggable={false}
              src={DICE_OUTCOME_ICON}
              style={diceOutcomeIconStyle}
            />
          ) : null}
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
          {losses.map((loss) => renderLossIcon(loss))}
        </div>
      ) : null}
      {itemTooltip ? (
        <div
          role="tooltip"
          style={{
            ...rewardTooltipStyle,
            left: itemTooltip.x,
            top: itemTooltip.y,
          }}
        >
          <p style={rewardTooltipTitleStyle}>{itemTooltip.name}</p>
          <p style={rewardTooltipMetaStyle}>{itemTooltip.quantityLabel}</p>
          {itemTooltip.description ? (
            <p style={rewardTooltipTextStyle}>{itemTooltip.description}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default ResultBlock;
