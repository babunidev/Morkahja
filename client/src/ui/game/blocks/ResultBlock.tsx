import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { AvatarInventory, EncounterAction } from '../../../api/http.js';
import solutionData from '../../../data/game/solutiondata.json';
import { displayRollAsD20, interpretRoll, isRollFavorable } from '@shared/diceInterpreter';
import {
  predictEncounterLosses,
  scaledUses,
  usedEncounterSolution,
  type EncounterInventoryChange,
} from '../encounterInventoryPreview.js';
import {
  LOSS_ROW_FADE_IN_MS,
  playLossBubblesFromTargets,
  playLossFlightsFromAvatar,
  playRewardFlights,
  resultLossSequenceDurationMs,
  rewardFlyTargetKind,
  type LossBubbleTargetSpec,
  type LossFlightSpec,
  type RewardFlightSpec,
} from '../rewardFlyAnimation.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import { CONTINUE_SOUND, playSfx } from '../../sfx.js';
import { waitForNextPaint } from '../../transitions/avatarEnterTransition.js';
import {
  ENCOUNTER_ACTIONS_FADE_DURATION_MS,
  FADE_DURATION_MS,
  fadeTransition,
} from '../../transitions/fade.js';

const RESULT_BACKGROUND = '/UI/09_GAME/im_bg_result.webp';
const CONTINUE_BUTTON = '/UI/09_GAME/im_button_continue.webp';
const DICE_OUTCOME_ICON = '/UI/09_GAME/im_button_dice_a.webp';
const LORE_GEM_REWARD_ASSET = '/UI/03_DASHBOARD/im_gems.webp';
const LORE_GEM_REWARD_ID = 90_001;
const LORE_GEM_POPUP_MS = 330;
const LORE_GEM_ACTIVATE_MS = 700;
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
  pointerEvents: 'auto',
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

const CONTINUE_REVEAL_SPEED = 1.15;

function continueTimingMs(durationMs: number): number {
  return Math.round(durationMs / CONTINUE_REVEAL_SPEED);
}

const LOSS_REVEAL_LEAD_MS = 360;
const LOSS_ROW_REVEAL_AT_PROGRESS = 0.52;

/** When continue may start — same milestone as loss row reveal (~52% through bubble phase). */
function lossRowRevealDelayMs(lossCount: number): number {
  const bubbleDurationMs = Math.max(
    0,
    resultLossSequenceDurationMs(lossCount) - LOSS_ROW_FADE_IN_MS - LOSS_REVEAL_LEAD_MS,
  );

  return Math.max(
    0,
    Math.round(bubbleDurationMs * LOSS_ROW_REVEAL_AT_PROGRESS),
  );
}

const CONTINUE_REVEAL_DELAY_MS = 0;
const CONTINUE_REVEAL_FADE_MS = continueTimingMs(ENCOUNTER_ACTIONS_FADE_DURATION_MS);
const CONTINUE_READY_MS = continueTimingMs(560);
const CONTINUE_REVEAL_TOTAL_MS = CONTINUE_REVEAL_FADE_MS + CONTINUE_READY_MS;
const CONTINUE_ENABLE_RATTLE_MS = continueTimingMs(520);

const continueHiddenStyle: CSSProperties = {
  opacity: 0,
  transform: 'rotate(18deg) scale(0.82)',
  transformOrigin: '50% 50%',
};

const continueSettledStyle: CSSProperties = {
  opacity: 1,
  transform: 'rotate(0deg) scale(1)',
  transformOrigin: '50% 50%',
};

function continueRevealSpinStyle(): CSSProperties {
  return {
    opacity: 0,
    transformOrigin: '50% 50%',
    animation: `morkahja-continue-reveal-spin ${CONTINUE_REVEAL_TOTAL_MS}ms cubic-bezier(0.55, 0, 0.25, 1) forwards`,
  };
}

const continueEnableRattleStyle: CSSProperties = {
  animation: `morkahja-continue-enable-rattle ${CONTINUE_ENABLE_RATTLE_MS}ms ease-out`,
  transformOrigin: '50% 50%',
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
  userSelect: 'none',
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

const loreGemRewardButtonStyle: CSSProperties = {
  ...rewardItemStyle,
  position: 'relative',
};

const loreGemOutcomeImageStyle: CSSProperties = {
  ...solutionIconImageBaseStyle,
  width: 48,
  height: 48,
  boxShadow: '0 0 12px rgba(255, 204, 102, 0.42), 0 5px 10px rgba(0, 0, 0, 0.46)',
  animation: 'morkahja-reward-shake 3.2s ease-in-out infinite',
  transformOrigin: '50% 50%',
};

const loreGemFadeInStyle: CSSProperties = {
  animation: `morkahja-lore-gem-fade-in ${FADE_DURATION_MS}ms ease forwards`,
};

const loreGemActivateStyle: CSSProperties = {
  animation: `morkahja-lore-gem-collect ${LORE_GEM_ACTIVATE_MS}ms ease-in forwards`,
};

const loreGemPopupStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 0,
  zIndex: 31,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.9rem, 4vw, 1.3rem)',
  fontWeight: 700,
  lineHeight: 1,
  textShadow: '0 0 7px rgba(255, 204, 102, 0.95), 0 3px 8px rgba(0, 0, 0, 0.85)',
  pointerEvents: 'none',
  animation: 'morkahja-lore-gem-popup 330ms ease-out forwards',
};

const lossRowRevealTransition = `opacity ${LOSS_ROW_FADE_IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${LOSS_ROW_FADE_IN_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

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

export type ResultBlockHandle = {
  playDismissAnimations: () => Promise<void>;
};

export const ResultBlock = forwardRef(function ResultBlock(
  {
    continueGlowClass,
    deferRewardDismiss = false,
    disabled = false,
    showLoreGemReward = false,
    encounterDifficulty,
    encounterId,
    hidden = false,
    inventory,
    localContinuePressed = false,
    multiplayerContinueWaiting = false,
    onContinue,
    prosperityRewardId,
    resolutionAction = null,
    rewardIds = [],
    roll,
    usedSolutionId = null,
  }: {
    continueGlowClass?: string;
    deferRewardDismiss?: boolean;
    disabled?: boolean;
    showLoreGemReward?: boolean;
    encounterDifficulty: number;
    encounterId: number;
    hidden?: boolean;
    inventory?: AvatarInventory;
    localContinuePressed?: boolean;
    multiplayerContinueWaiting?: boolean;
    onContinue: () => void | Promise<void>;
    prosperityRewardId?: number | null;
    resolutionAction?: EncounterAction | null;
    rewardIds?: number[];
    roll: number | null;
    usedSolutionId?: number | null;
  },
  ref,
) {
  const [continueBusy, setContinueBusy] = useState(false);
  const [outcomeShowsRoll, setOutcomeShowsRoll] = useState(false);
  const [itemTooltip, setItemTooltip] = useState<ItemTooltipState | null>(null);
  const [rewardsFlyingAway, setRewardsFlyingAway] = useState(false);
  const [lossesFlyingAway, setLossesFlyingAway] = useState(false);
  const [lossesRevealed, setLossesRevealed] = useState(true);
  const [lossesSequenceDone, setLossesSequenceDone] = useState(true);
  const [continueRevealPlaying, setContinueRevealPlaying] = useState(false);
  const [continueInteractive, setContinueInteractive] = useState(false);
  const [continueEnableRattle, setContinueEnableRattle] = useState(false);
  const [loreGemPopupVisible, setLoreGemPopupVisible] = useState(false);
  const [loreGemActivating, setLoreGemActivating] = useState(false);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const rewardButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const lossButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const outcome = roll === null ? null : interpretRoll(roll);
  const displayRoll = roll === null ? null : displayRollAsD20(roll);
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
    setLossesFlyingAway(false);
    setLossesRevealed(losses.length === 0);
    setLossesSequenceDone(roll === null);
    setContinueRevealPlaying(false);
    setContinueInteractive(false);
    setContinueEnableRattle(false);
    setLoreGemPopupVisible(false);
    setLoreGemActivating(false);
    rewardButtonRefs.current.clear();
    lossButtonRefs.current.clear();
  }, [roll, losses.length]);

  useEffect(() => {
    if (!showLoreGemReward || roll === null || hidden) {
      setLoreGemPopupVisible(false);
      setLoreGemActivating(false);
      return undefined;
    }

    setLoreGemActivating(true);
    setLoreGemPopupVisible(true);

    const activateTimer = window.setTimeout(() => {
      setLoreGemActivating(false);
    }, LORE_GEM_ACTIVATE_MS);
    const popupTimer = window.setTimeout(() => {
      setLoreGemPopupVisible(false);
    }, LORE_GEM_POPUP_MS);

    return () => {
      window.clearTimeout(activateTimer);
      window.clearTimeout(popupTimer);
    };
  }, [hidden, roll, showLoreGemReward]);

  useEffect(() => {
    if (roll === null) {
      return undefined;
    }

    if (losses.length === 0) {
      setLossesSequenceDone(false);
      const readyTimer = window.setTimeout(() => {
        setLossesSequenceDone(true);
      }, lossRowRevealDelayMs(0));

      return () => {
        window.clearTimeout(readyTimer);
      };
    }

    let cancelled = false;
    setLossesSequenceDone(false);
    setLossesRevealed(false);

    async function playLossRevealFlights(): Promise<void> {
      await waitForNextPaint();

      if (cancelled) {
        return;
      }

      const flights: LossFlightSpec[] = losses.map((loss) => ({
        id: `loss-fly-${loss.solution.mSolutionID}`,
        imageSrc: solutionImagePath(loss.solution),
        size: lossIconSize(loss.solution.mSolutionInventoryType),
      }));
      const rowRevealDelayMs = lossRowRevealDelayMs(flights.length);
      let rowRevealed = false;

      const markLossRowRevealed = (): void => {
        if (cancelled || rowRevealed) {
          return;
        }

        rowRevealed = true;
        setLossesRevealed(true);
        setLossesSequenceDone(true);
      };

      const rowRevealTimer = window.setTimeout(() => {
        markLossRowRevealed();
      }, rowRevealDelayMs);

      if (flights.length > 0) {
        await playLossFlightsFromAvatar(flights);
      }

      window.clearTimeout(rowRevealTimer);

      if (!cancelled && !rowRevealed) {
        markLossRowRevealed();
      }

      if (!cancelled) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, LOSS_ROW_FADE_IN_MS);
        });
      }
    }

    void playLossRevealFlights();

    return () => {
      cancelled = true;
    };
  }, [roll, lossesKey, losses.length]);

  useEffect(() => {
    if (roll === null || !lossesSequenceDone) {
      setContinueRevealPlaying(false);
      setContinueInteractive(false);
      return undefined;
    }

    let cancelled = false;
    setContinueRevealPlaying(false);
    setContinueInteractive(false);
    setContinueEnableRattle(false);

    async function revealContinue(): Promise<void> {
      if (CONTINUE_REVEAL_DELAY_MS > 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, CONTINUE_REVEAL_DELAY_MS);
        });

        if (cancelled) {
          return;
        }
      }

      await waitForNextPaint();
      if (cancelled) {
        return;
      }

      setContinueRevealPlaying(true);

      await waitForNextPaint();
      if (cancelled) {
        return;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, CONTINUE_REVEAL_TOTAL_MS);
      });

      if (cancelled) {
        return;
      }

      setContinueRevealPlaying(false);
      setContinueEnableRattle(true);
      setContinueInteractive(true);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, CONTINUE_ENABLE_RATTLE_MS);
      });

      if (!cancelled) {
        setContinueEnableRattle(false);
      }
    }

    void revealContinue();

    return () => {
      cancelled = true;
      setContinueRevealPlaying(false);
      setContinueInteractive(false);
      setContinueEnableRattle(false);
    };
  }, [lossesSequenceDone, roll]);

  function buildLossFlights(): LossBubbleTargetSpec[] {
    const flights: LossBubbleTargetSpec[] = [];

    for (const loss of losses) {
      const solutionId = loss.solution.mSolutionID;
      const button = lossButtonRefs.current.get(solutionId)
        ?? document.querySelector<HTMLButtonElement>(
          `[data-loss-fly-target="${solutionId}"]`,
        );
      const sourceRect = button?.getBoundingClientRect();

      if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
        continue;
      }

      flights.push({
        id: `loss-dismiss-${solutionId}`,
        imageSrc: solutionImagePath(loss.solution),
        size: lossIconSize(loss.solution.mSolutionInventoryType),
        sourceRect,
      });
    }

    return flights;
  }

  function buildRewardFlights(): RewardFlightSpec[] {
    const flights: RewardFlightSpec[] = [];

    if (showLoreGemReward) {
      const button = rewardButtonRefs.current.get(LORE_GEM_REWARD_ID)
        ?? document.querySelector<HTMLButtonElement>(
          `[data-reward-fly-source="${LORE_GEM_REWARD_ID}"]`,
        );
      const sourceRect = button?.getBoundingClientRect();

      if (sourceRect && sourceRect.width > 0 && sourceRect.height > 0) {
        flights.push({
          id: 'reward-fly-lore-gem',
          imageSrc: LORE_GEM_REWARD_ASSET,
          size: 64,
          sourceRect,
          target: 'inventory',
        });
      }
    }

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

  async function playDismissAnimations(): Promise<void> {
    if (!visible || continueBusy) {
      return;
    }

    setContinueBusy(true);
    hideItemTooltip();

    try {
      const rewardFlights = buildRewardFlights();
      const lossFlights = buildLossFlights();

      if (rewardFlights.length > 0) {
        setRewardsFlyingAway(true);
      }

      if (lossFlights.length > 0) {
        setLossesFlyingAway(true);
      }

      const dismissAnimations: Promise<void>[] = [];

      if (lossFlights.length > 0) {
        dismissAnimations.push(playLossBubblesFromTargets(lossFlights));
      }

      if (rewardFlights.length > 0) {
        dismissAnimations.push(playRewardFlights(rewardFlights));
      }

      if (dismissAnimations.length > 0) {
        await Promise.all(dismissAnimations);
      } else {
        await waitContinueBounce();
      }
    } finally {
      setContinueBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    playDismissAnimations,
  }));

  async function handleContinueClick(): Promise<void> {
    if (
      disabled
      || hidden
      || !visible
      || continueBusy
      || !continueInteractive
      || (deferRewardDismiss && localContinuePressed)
    ) {
      return;
    }

    playSfx(CONTINUE_SOUND);
    hideItemTooltip();

    if (deferRewardDismiss) {
      try {
        await Promise.resolve(onContinue());
      } catch {
        // Parent logs failures; keep results visible for retry.
      }
      return;
    }

    setContinueBusy(true);

    try {
      await playDismissAnimations();
      await Promise.resolve(onContinue());
    } finally {
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

  function renderLoreGemRewardIcon() {
    const loreGemReward: VisibleReward = {
      quantity: 1,
      solution: {
        mSolutionIconName: 'lore_gem_currency',
        mSolutionID: LORE_GEM_REWARD_ID,
        mSolutionInventoryType: 0,
        mSolutionName: 'Yellow Red Gem',
        mSolutionText: 'A rare gem earned from hidden lore.',
        mSolutionUses: 1,
      },
    };

    return (
      <button
        aria-label="Yellow Red Gem, quantity +1"
        className="morkahja-footer-button"
        data-reward-fly-source={LORE_GEM_REWARD_ID}
        key="lore-gem-reward"
        ref={(element) => {
          if (element) {
            rewardButtonRefs.current.set(LORE_GEM_REWARD_ID, element);
            return;
          }
          rewardButtonRefs.current.delete(LORE_GEM_REWARD_ID);
        }}
        onBlur={hideItemTooltip}
        onFocus={(event) => {
          showItemTooltip(loreGemReward, '+', event);
        }}
        onPointerCancel={hideItemTooltip}
        onPointerEnter={(event) => {
          showItemTooltip(loreGemReward, '+', event);
        }}
        onContextMenu={preventImageContextMenu}
        onPointerLeave={hideItemTooltip}
        style={loreGemRewardButtonStyle}
        type="button"
      >
        <span
          className="morkahja-footer-button-visual"
          style={{
            position: 'relative',
            display: 'block',
            ...(loreGemActivating ? loreGemActivateStyle : loreGemFadeInStyle),
          }}
        >
          <img
            alt=""
            aria-hidden="true"
            {...protectedImageProps}
            src={LORE_GEM_REWARD_ASSET}
            style={loreGemOutcomeImageStyle}
          />
          {loreGemPopupVisible ? <span style={loreGemPopupStyle}>+1</span> : null}
        </span>
      </button>
    );
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
        className={trackRewardRef ? 'morkahja-footer-button' : undefined}
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
        onContextMenu={preventImageContextMenu}
        onPointerLeave={hideItemTooltip}
        style={buttonStyle}
        type="button"
      >
        <span
          className={trackRewardRef ? 'morkahja-footer-button-visual' : undefined}
          style={trackRewardRef ? { display: 'block' } : undefined}
        >
          <img
            alt=""
            aria-hidden="true"
            {...protectedImageProps}
            src={solutionImagePath(change.solution)}
            style={imageStyle}
          />
        </span>
      </button>
    );
  }

  function renderLossIcon(loss: EncounterInventoryChange) {
    const lossVisible = lossesRevealed && !lossesFlyingAway;
    const imageStyle = {
      ...lossIconStyle(loss.solution.mSolutionInventoryType),
      opacity: lossVisible ? 1 : 0,
      transform: lossVisible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
      transition: lossesFlyingAway
        ? 'opacity 0ms, transform 0ms'
        : lossesRevealed
          ? lossRowRevealTransition
          : 'none',
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
        onContextMenu={preventImageContextMenu}
        onPointerLeave={hideItemTooltip}
        style={{
          ...rewardItemStyle,
          pointerEvents: lossVisible ? 'auto' : 'none',
        }}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          {...protectedImageProps}
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
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      style={{
        ...resultBlockStyle,
        opacity: resultInteractive ? 1 : 0,
        pointerEvents: resultInteractive ? 'auto' : 'none',
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
}
@keyframes morkahja-continue-reveal-spin {
  0% {
    opacity: 0;
    transform: rotate(18deg) scale(0.82);
  }
  55% {
    opacity: 0.42;
    transform: rotate(8deg) scale(0.94);
  }
  82% {
    opacity: 0.88;
    transform: rotate(2deg) scale(0.99);
  }
  100% {
    opacity: 1;
    transform: rotate(0deg) scale(1);
  }
}
@keyframes morkahja-continue-enable-rattle {
  0%, 100% { transform: rotate(0deg) scale(1); }
  20% { transform: rotate(-2deg) scale(1.03); }
  40% { transform: rotate(2deg) scale(1.02); }
  60% { transform: rotate(-1.4deg) scale(1.035); }
  80% { transform: rotate(1deg) scale(1.015); }
}
@keyframes morkahja-lore-gem-fade-in {
  0% { opacity: 0; transform: scale(0.88); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes morkahja-lore-gem-collect {
  0% { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
  12% { transform: translateX(-4px) rotate(-9deg) scale(1.06); }
  24% { transform: translateX(4px) rotate(9deg) scale(1.05); }
  36% { transform: translateX(-3px) rotate(-7deg) scale(1.03); }
  48% { transform: translateX(3px) rotate(7deg) scale(1.02); }
  62% { opacity: 0.75; transform: translateX(-2px) rotate(-4deg) scale(0.96); }
  100% { opacity: 0; transform: translateY(12px) rotate(0deg) scale(0.55); }
}
@keyframes morkahja-lore-gem-popup {
  0% { opacity: 0; transform: translate(-50%, -2px) scale(0.9); }
  18% { opacity: 1; transform: translate(-50%, -12px) scale(1.1); }
  100% { opacity: 0; transform: translate(-50%, -28px) scale(1); }
}`}
      </style>
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={RESULT_BACKGROUND}
        style={{
          ...resultImageStyle,
          ...continueDismissLayerStyle(continueBusy),
          pointerEvents: resultInteractive ? 'auto' : 'none',
        }}
      />
      <button
        aria-disabled={!continueInteractive}
        aria-label="Continue"
        className="morkahja-footer-button"
        disabled={
          disabled
          || continueBusy
          || !continueInteractive
          || (deferRewardDismiss && localContinuePressed)
        }
        onClick={() => {
          void handleContinueClick();
        }}
        onContextMenu={preventImageContextMenu}
        style={{
          ...continueButtonStyle,
          cursor:
            disabled
            || continueBusy
            || !continueInteractive
            || (deferRewardDismiss && localContinuePressed)
              ? 'default'
              : 'pointer',
          pointerEvents: resultInteractive && continueInteractive && !continueBusy ? 'auto' : 'none',
        }}
        type="button"
      >
        <span
          className="morkahja-footer-button-visual"
          key={`continue-${roll}`}
          style={{
            ...(continueRevealPlaying
              ? continueRevealSpinStyle()
              : continueInteractive || continueEnableRattle
                ? continueSettledStyle
                : continueHiddenStyle),
            ...(continueBusy && !multiplayerContinueWaiting ? continueAnimatingStyle : {}),
            ...(multiplayerContinueWaiting ? { animation: undefined } : {}),
          }}
        >
          <span
            className={[
              multiplayerContinueWaiting ? 'morkahja-continue-waiting-party' : undefined,
              continueGlowClass,
            ].filter(Boolean).join(' ') || undefined}
            style={{
              display: 'block',
              ...(continueEnableRattle && !multiplayerContinueWaiting
                ? continueEnableRattleStyle
                : {}),
            }}
          >
            <img
              alt=""
              aria-hidden="true"
              {...protectedImageProps}
              src={CONTINUE_BUTTON}
              style={continueImageStyle}
            />
          </span>
        </span>
      </button>
      {rewards.length > 0 && !rewardsFlyingAway && !continueBusy ? (
        <div
          aria-label="Predetermined rewards"
          {...{ [PROTECTED_SURFACE_ATTR]: '' }}
          style={rewardRowStyle}
        >
          {rewards.map((reward) => renderSolutionIcon(reward, '+', rewardImageStyle))}
        </div>
      ) : null}
      {outcome && roll !== null ? (
        <div
          aria-label="Encounter outcome"
          {...{ [PROTECTED_SURFACE_ATTR]: '' }}
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
              {...protectedImageProps}
              src={DICE_OUTCOME_ICON}
              style={diceOutcomeIconStyle}
            />
          ) : null}
          <button
            aria-label={outcomeShowsRoll ? `Roll ${displayRoll}` : `${outcome}, show roll`}
            className="morkahja-result-outcome"
            onClick={() => {
              setOutcomeShowsRoll((showingRoll) => !showingRoll);
            }}
            onContextMenu={preventImageContextMenu}
            style={outcomeButtonStyle}
            type="button"
          >
            {outcomeShowsRoll ? displayRoll : outcome}
          </button>
          {showLoreGemReward && !rewardsFlyingAway && !continueBusy
            ? renderLoreGemRewardIcon()
            : null}
        </div>
      ) : null}
      {losses.length > 0 && !lossesFlyingAway ? (
        <div
          aria-label="Encounter losses"
          {...{ [PROTECTED_SURFACE_ATTR]: '' }}
          style={{
            ...lossRowStyle,
            ...continueDismissLayerStyle(continueBusy),
          }}
        >
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
});

export default ResultBlock;
