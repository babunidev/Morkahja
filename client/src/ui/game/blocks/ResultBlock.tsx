import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { AvatarInventory, EncounterAction } from '../../../api/http.js';
import { gameSolutions } from '../../../data/gameContent.js';
import { interpretRoll } from '@shared/diceInterpreter';
import {
  encounterLossesFromSolutionIds,
  usedEncounterSolutions,
  type EncounterInventoryChange,
} from '../encounterInventoryPreview.js';
import { BOTTOM_EDGE_ANCHOR_STYLE } from './decorativeFrameShared.js';
import {
  animationAlreadyPlayed,
  claimAnimationOnce,
  committedActionFor,
  takeCommittedSolutionSpend,
  getAvatarPortraitRect,
  getFooterButtonRect,
  landingRevealMs,
  LOSS_ARRIVAL_MS,
  LOSS_ROW_FADE_IN_MS,
  REWARD_EMERGE_MS,
  playLossArrivals,
  playLossBubblesFromTargets,
  playRewardEmergence,
  playRewardFlights,
  playUsedSolutionsIntoEncounter,
  USED_SOLUTION_FLIGHT_MS,
  resultLossSequenceDurationMs,
  rewardFlyTargetKind,
  type LossBubbleTargetSpec,
  type LossArrivalSpec,
  type RewardFlightSpec,
} from '../rewardFlyAnimation.js';
import {
  preventImageContextMenu,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import { CONTINUE_SOUND, DEFAULT_BUTTON_SOUND, playSfx } from '../../sfx.js';
import { waitForNextPaint } from '../../transitions/avatarEnterTransition.js';
import {
  LEVEL_UP_ENCOUNTER_ID,
  visibleEncounterRewards,
} from '../visibleEncounterRewards.js';
import {
  ENCOUNTER_ACTIONS_FADE_DURATION_MS,
  FADE_DURATION_MS,
  fadeTransition,
} from '../../transitions/fade.js';
import { assetUrl } from '../../../assetUrl.js';

const CONTINUE_BUTTON = assetUrl('/UI/09_GAME/im_button_continue.webp');
const LORE_GEM_REWARD_ASSET = assetUrl('/UI/03_DASHBOARD/im_gems.webp');
const LORE_GEM_REWARD_ID = 90_001;
const LORE_GEM_POPUP_MS = 330;
const LORE_GEM_ACTIVATE_MS = 700;
const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');
const ESSENCE_INVENTORY_TYPE = 3;
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

/**
 * The result uses the solution bar's place and grid (A, B, dice, C, D; see
 * SolutionBlock), which is hidden while a result shows: rewards take the A-D
 * slots and Continue takes the middle. No background bar.
 */
const RESULT_SLOT_SIZE_PX = 64;
/** Babuni's order: middle, left, right, far left, far right. */
const RESULT_SLOT_ORDER = [3, 2, 4, 1, 5] as const;
/** When the Continue arrow holds the middle (nothing to collect, or watching). */
const RESULT_SLOT_ORDER_AROUND_CONTINUE = [2, 4, 1, 5] as const;
/** The solutions' "ready" wobble (SolutionBlock), played once when items can be collected. */
const READY_RATTLE_MS = 520;
const READY_RATTLE_STAGGER_MS = 80;

const resultBlockStyle: CSSProperties = {
  ...BOTTOM_EDGE_ANCHOR_STYLE,
  width: '96%',
  minHeight: RESULT_SLOT_SIZE_PX,
  display: 'grid',
  gridTemplateRows: 'auto',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  columnGap: 6,
  alignItems: 'center',
  justifyItems: 'center',
  zIndex: 31,
  overflow: 'visible',
  transition: fadeTransition,
  pointerEvents: 'auto',
};


const continueButtonStyle: CSSProperties = {
  gridColumn: '3',
  gridRow: '1',
  justifySelf: 'center',
  alignSelf: 'center',
  width: 72,
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

function rewardDismissLayerStyle(rewardDismissInProgress: boolean): CSSProperties {
  return {
    opacity: rewardDismissInProgress ? 0 : 1,
    transition: `opacity ${CONTINUE_BOUNCE_MS}ms ease-in-out`,
    pointerEvents: rewardDismissInProgress ? 'none' : 'auto',
  };
}



const rewardRowStyle: CSSProperties = {
  gridColumn: '1 / -1',
  gridRow: '1',
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
  width: RESULT_SLOT_SIZE_PX,
  height: RESULT_SLOT_SIZE_PX,
  boxShadow: '0 0 14px rgba(255, 204, 102, 0.38), 0 6px 12px rgba(0, 0, 0, 0.46)',
  animation: 'morkahja-reward-shake 3.2s ease-in-out infinite',
  transformOrigin: '50% 50%',
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

/** More than four rewards (some level-ups): the rest float above the bar. */
const rewardOverflowRowStyle: CSSProperties = {
  ...rewardRowStyle,
  transform: 'translateY(-118px)',
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

function solutionsById(): Record<string, SolutionRecord> {
  return gameSolutions() as Record<string, SolutionRecord>;
}

function solutionImagePath(solution: SolutionRecord): string {
  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

export type ResultBlockHandle = {
  playDismissAnimations: () => Promise<void>;
};

export const ResultBlock = forwardRef(function ResultBlock(
  {
    continueGlowClass,
    continueWaitingAfterPress = false,
    deferRewardDismiss = false,
    disabled = false,
    showLoreGemReward = false,
    encounterDifficulty: _encounterDifficulty,
    avatarLevel = 1,
    encounterId,
    encounterSnapshotId,
    hidden = false,
    inventory,
    localContinuePressed = false,
    onContinue,
    prosperityRewardId,
    readOnlyWitness = false,
    witnessShowContinue = false,
    actorShowContinue = true,
    presenceVisible,
    resolutionAction = null,
    rewardIds = [],
    roll,
    usedSolutionIds = [],
    lostSolutionIds = [],
  }: {
    continueGlowClass?: string;
    continueWaitingAfterPress?: boolean;
    deferRewardDismiss?: boolean;
    disabled?: boolean;
    showLoreGemReward?: boolean;
    encounterDifficulty: number;
    avatarLevel?: number;
    encounterId: number;
    encounterSnapshotId?: string;
    hidden?: boolean;
    inventory?: AvatarInventory;
    localContinuePressed?: boolean;
    onContinue: () => void | Promise<void>;
    prosperityRewardId?: number | null;
    readOnlyWitness?: boolean;
    witnessShowContinue?: boolean;
    /** When false, hides Continue for system-event actors until the server is ready. */
    actorShowContinue?: boolean;
    /** When set, drives fade in/out instead of the internal entrance fade (witness mount). */
    presenceVisible?: boolean;
    resolutionAction?: EncounterAction | null;
    rewardIds?: number[];
    roll: number | null;
    usedSolutionIds?: number[];
    lostSolutionIds?: number[];
  },
  ref,
) {
  const [continueSubmitInFlight, setContinueSubmitInFlight] = useState(false);
  const [continuePressAnimating, setContinuePressAnimating] = useState(false);
  const [rewardDismissInProgress, setRewardDismissInProgress] = useState(false);
  const [itemTooltip, setItemTooltip] = useState<ItemTooltipState | null>(null);
  const [rewardsFlyingAway, setRewardsFlyingAway] = useState(false);
  const [lossesFlyingAway, setLossesFlyingAway] = useState(false);
  const [lossesRevealed, setLossesRevealed] = useState(true);
  /** Losses that flew into the row appear in place instead of fading in. */
  const [lossesArrived, setLossesArrived] = useState(false);
  /** Items revealed one by one as their flyer lands on them. */
  const [arrivedLossKeys, setArrivedLossKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [emergedRewardKeys, setEmergedRewardKeys] = useState<ReadonlySet<string>>(() => new Set());
  /** Rewards stay hidden in their slots until they have grown out of the encounter. */
  const [rewardsEmerged, setRewardsEmerged] = useState(false);
  const [collected, setCollected] = useState<ReadonlySet<string>>(() => new Set());
  /** Mirror of `collected` for quick consecutive taps within one render. */
  const collectedRef = useRef<Set<string>>(new Set());
  const [lossesSequenceDone, setLossesSequenceDone] = useState(true);
  const [continueRevealPlaying, setContinueRevealPlaying] = useState(false);
  const [continueInteractive, setContinueInteractive] = useState(false);
  const [continueEnableRattle, setContinueEnableRattle] = useState(false);
  const [continuePressAnimationDone, setContinuePressAnimationDone] = useState(false);
  const [continueFloatingAfterPress, setContinueFloatingAfterPress] = useState(false);
  const [loreGemPopupVisible, setLoreGemPopupVisible] = useState(false);
  const [loreGemActivating, setLoreGemActivating] = useState(false);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const rewardButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const lossButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const activationRevealDoneRef = useRef(false);
  const postPressContinueRef = useRef(false);
  const outcome = roll === null ? null : interpretRoll(roll);
  const isLevelUp = encounterId === LEVEL_UP_ENCOUNTER_ID;
  const usedSolutions = readOnlyWitness
    ? []
    : usedEncounterSolutions({ inventory, usedSolutionIds });
  const losses = readOnlyWitness || isLevelUp
    ? []
    : lostSolutionIds.length > 0
      ? encounterLossesFromSolutionIds({ inventory, lostSolutionIds, usedSolutionIds })
      : [];
  const rewards = visibleEncounterRewards({
    encounterId,
    prosperityRewardId,
    rewardIds,
    outcome,
    avatarLevel,
    getSolutionUses: (rewardId) => solutionsById()[String(rewardId)]?.mSolutionUses,
  }).flatMap(({ solutionId, quantity }) => {
    const solution = solutionsById()[String(solutionId)];

    if (!solution) {
      return [];
    }

    return [{ quantity, solution }];
  });

  const visible = roll !== null || (readOnlyWitness && (rewards.length > 0 || isLevelUp));

  /**
   * Babuni's direction: when a result holds rewards or losses for the player,
   * there is no Continue arrow. Each item is tapped to collect it (a reward
   * flies into the inventory, a loss rises away), and collecting the last one
   * continues the round. With nothing to collect, the Continue arrow appears.
   */
  const collectibleKeys = readOnlyWitness
    ? []
    : [
      ...rewards.map((reward) => `r:${reward.solution.mSolutionID}`),
      ...(showLoreGemReward && roll !== null ? [`r:${LORE_GEM_REWARD_ID}`] : []),
      ...losses.map((loss) => `l:${loss.solution.mSolutionID}`),
    ];
  const collectMode = collectibleKeys.length > 0;

  const showContinueFloat = continuePressAnimationDone
    && continueFloatingAfterPress
    && !continueRevealPlaying
    && !continueEnableRattle
    && !continuePressAnimating;

  const continueButtonVisible = continueRevealPlaying
    || continueInteractive
    || continueEnableRattle
    || continuePressAnimating
    || showContinueFloat;

  const lossesKey = useMemo(
    () => losses.map((loss) => `${loss.solution.mSolutionID}:${loss.quantity}`).join('|'),
    [losses],
  );

  useEffect(() => {
    setRewardsFlyingAway(false);
    setLossesFlyingAway(false);
    setLossesRevealed(losses.length === 0);
    setLossesArrived(false);
    setArrivedLossKeys(new Set());
    setEmergedRewardKeys(new Set());
    setRewardsEmerged(false);
    collectedRef.current = new Set();
    setCollected(new Set());
    setLossesSequenceDone(roll === null);
    setContinueRevealPlaying(false);
    setContinueInteractive(false);
    setContinueEnableRattle(false);
    setContinuePressAnimationDone(false);
    setContinueFloatingAfterPress(false);
    setLoreGemPopupVisible(false);
    setLoreGemActivating(false);
    activationRevealDoneRef.current = false;
    postPressContinueRef.current = false;
    rewardButtonRefs.current.clear();
    lossButtonRefs.current.clear();
  }, [roll, losses.length, encounterSnapshotId]);

  useEffect(() => {
    if (readOnlyWitness || !showLoreGemReward || roll === null || hidden) {
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
    if (!localContinuePressed || !continueWaitingAfterPress) {
      return;
    }

    postPressContinueRef.current = true;
    setContinuePressAnimationDone(true);
    setContinueFloatingAfterPress(true);
    setContinueInteractive(false);
  }, [continueWaitingAfterPress, localContinuePressed]);

  useEffect(() => {
    if (readOnlyWitness) {
      setLossesSequenceDone(visible);
      return undefined;
    }

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
    const arrivalKey = `loss-arrive:${encounterSnapshotId ?? `roll-${roll}`}`;
    const ownResult = readOnlyWitness || committedActionFor(encounterSnapshotId) !== null;
    if (!ownResult || animationAlreadyPlayed(arrivalKey)) {
      // Played before for this encounter (the result re-rendered): just show them.
      setLossesArrived(true);
      setLossesRevealed(true);
      setLossesSequenceDone(true);
      return undefined;
    }
    setLossesSequenceDone(false);
    setLossesRevealed(false);

    async function playLossRevealFlights(): Promise<void> {
      await waitForNextPaint();

      if (cancelled) {
        return;
      }

      // Each loss appears where it was kept and travels to its place in the
      // loss row: an essence from the middle of the avatar, an item or skill
      // from its Inventory or Skillbook button.
      const avatarRect = getAvatarPortraitRect();
      const flights: Array<LossArrivalSpec & { key: string }> = losses.flatMap((loss) => {
        const inventoryType = loss.solution.mSolutionInventoryType;
        const sourceRect = inventoryType === ESSENCE_INVENTORY_TYPE
          ? avatarRect
          : getFooterButtonRect(rewardFlyTargetKind(inventoryType));
        const targetRect = lossButtonRefs.current.get(loss.solution.mSolutionID)?.getBoundingClientRect();
        if (!sourceRect || !targetRect || sourceRect.width <= 0 || targetRect.width <= 0) {
          return [];
        }
        return [{
          key: `l:${loss.solution.mSolutionID}`,
          imageSrc: solutionImagePath(loss.solution),
          // On-screen size of the loss icon (the stage is scaled, flyers are not).
          size: Math.round(Math.min(targetRect.width, targetRect.height)),
          sourceRect,
          targetRect,
        }];
      });

      let rowRevealed = false;
      const markLossRowRevealed = (): void => {
        if (cancelled || rowRevealed) {
          return;
        }

        rowRevealed = true;
        setLossesArrived(flights.length > 0);
        setLossesRevealed(true);
        setLossesSequenceDone(true);
      };

      if (flights.length === 0) {
        // Nothing to fly from (for example a layout without the avatar); fade the row in.
        const rowRevealTimer = window.setTimeout(markLossRowRevealed, lossRowRevealDelayMs(losses.length));
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, lossRowRevealDelayMs(losses.length) + LOSS_ROW_FADE_IN_MS);
        });
        window.clearTimeout(rowRevealTimer);
        markLossRowRevealed();
        return;
      }

      claimAnimationOnce(arrivalKey);
      const flightKeys = flights.map((flight) => flight.key);
      const arrived = new Set<string>();
      await playLossArrivals(flights, (index) => {
        if (cancelled) {
          return;
        }
        arrived.add(flightKeys[index]!);
        setArrivedLossKeys(new Set(arrived));
        if (arrived.size === flightKeys.length) {
          markLossRowRevealed();
        }
      });
      markLossRowRevealed();
    }

    void playLossRevealFlights();

    return () => {
      cancelled = true;
    };
  }, [roll, lossesKey, losses.length, visible]);

  useEffect(() => {
    const continueGated = readOnlyWitness
      ? !witnessShowContinue
      : !actorShowContinue;

    if (continueGated) {
      setContinueRevealPlaying(false);
      setContinueInteractive(false);
      if (!postPressContinueRef.current) {
        activationRevealDoneRef.current = false;
      }
      return undefined;
    }

    if (postPressContinueRef.current) {
      return undefined;
    }

    if (!visible || !lossesSequenceDone || !rewardsEmerged) {
      setContinueRevealPlaying(false);
      setContinueInteractive(false);
      return undefined;
    }

    if (activationRevealDoneRef.current) {
      setContinueInteractive(true);
      return undefined;
    }

    let cancelled = false;

    async function revealContinue(): Promise<void> {
      if (CONTINUE_REVEAL_DELAY_MS > 0) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, CONTINUE_REVEAL_DELAY_MS);
        });

        if (cancelled || postPressContinueRef.current) {
          return;
        }
      }

      await waitForNextPaint();
      if (cancelled || postPressContinueRef.current) {
        return;
      }

      setContinueRevealPlaying(true);

      await waitForNextPaint();
      if (cancelled || postPressContinueRef.current) {
        return;
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, CONTINUE_REVEAL_TOTAL_MS);
      });

      if (cancelled || postPressContinueRef.current) {
        return;
      }

      setContinueRevealPlaying(false);
      setContinueEnableRattle(true);
      setContinueInteractive(true);
      activationRevealDoneRef.current = true;

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, CONTINUE_ENABLE_RATTLE_MS);
      });

      if (!cancelled && !postPressContinueRef.current) {
        setContinueEnableRattle(false);
      }
    }

    void revealContinue();

    return () => {
      cancelled = true;
    };
  }, [
    actorShowContinue,
    encounterSnapshotId,
    lossesSequenceDone,
    rewardsEmerged,
    visible,
    readOnlyWitness,
    witnessShowContinue,
  ]);

  function buildLossFlights(): LossBubbleTargetSpec[] {
    const flights: LossBubbleTargetSpec[] = [];

    for (const loss of losses) {
      const solutionId = loss.solution.mSolutionID;
      if (collectedRef.current.has(`l:${solutionId}`)) {
        continue;
      }
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
        size: Math.round(sourceRect.width),
        sourceRect,
      });
    }

    return flights;
  }

  function buildRewardFlights(): RewardFlightSpec[] {
    const flights: RewardFlightSpec[] = [];

    if (showLoreGemReward && !collectedRef.current.has(`r:${LORE_GEM_REWARD_ID}`)) {
      const button = rewardButtonRefs.current.get(LORE_GEM_REWARD_ID)
        ?? document.querySelector<HTMLButtonElement>(
          `[data-reward-fly-source="${LORE_GEM_REWARD_ID}"]`,
        );
      const sourceRect = button?.getBoundingClientRect();

      if (sourceRect && sourceRect.width > 0 && sourceRect.height > 0) {
        flights.push({
          id: 'reward-fly-lore-gem',
          imageSrc: LORE_GEM_REWARD_ASSET,
          size: Math.round(sourceRect.width),
          sourceRect,
          // Gems belong to the player, not the inventory: onto the avatar.
          target: 'avatar',
        });
      }
    }

    for (const reward of rewards) {
      const solutionId = reward.solution.mSolutionID;
      if (collectedRef.current.has(`r:${solutionId}`)) {
        continue;
      }
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
        size: Math.round(sourceRect.width),
        sourceRect,
        target: rewardFlyTargetKind(reward.solution.mSolutionInventoryType),
      });
    }

    return flights;
  }

  async function playDismissAnimations(): Promise<void> {
    if (!visible || rewardDismissInProgress) {
      return;
    }

    setRewardDismissInProgress(true);
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
      } else if (!collectMode) {
        // Collected items already flew away when tapped; only the arrow bounces.
        await waitContinueBounce();
      }
    } finally {
      setRewardDismissInProgress(false);
    }
  }

  useImperativeHandle(ref, () => ({
    playDismissAnimations: readOnlyWitness
      ? async () => undefined
      : playDismissAnimations,
  }));

  async function handleContinueClick(): Promise<void> {
    if (
      disabled
      || hidden
      || !visible
      || continueSubmitInFlight
      || !continueInteractive
      || (deferRewardDismiss && localContinuePressed)
    ) {
      return;
    }

    playSfx(CONTINUE_SOUND);
    hideItemTooltip();

    postPressContinueRef.current = true;
    activationRevealDoneRef.current = true;
    setContinueRevealPlaying(false);
    setContinueEnableRattle(false);
    setContinueInteractive(false);
    setContinuePressAnimationDone(true);
    setContinueFloatingAfterPress(true);
    setContinueSubmitInFlight(true);
    setContinuePressAnimating(true);
    const pressAnimTimer = window.setTimeout(() => {
      setContinuePressAnimating(false);
    }, CONTINUE_BOUNCE_MS);

    try {
      await waitContinueBounce();
      await Promise.resolve(onContinue());
    } catch {
      postPressContinueRef.current = false;
      activationRevealDoneRef.current = false;
      setContinueFloatingAfterPress(false);
      setContinuePressAnimationDone(false);
      setContinueInteractive(true);
    } finally {
      window.clearTimeout(pressAnimTimer);
      setContinuePressAnimating(false);
      setContinueSubmitInFlight(false);
    }
  }

  const canCollect = collectMode
    && continueInteractive
    && !disabled
    && !hidden
    && !continueSubmitInFlight
    && actorShowContinue
    && !(deferRewardDismiss && localContinuePressed);

  const [readyRattle, setReadyRattle] = useState(false);
  useEffect(() => {
    if (!canCollect) {
      setReadyRattle(false);
      return undefined;
    }
    setReadyRattle(true);
    const timer = window.setTimeout(() => {
      setReadyRattle(false);
    }, READY_RATTLE_MS + RESULT_SLOT_ORDER.length * READY_RATTLE_STAGGER_MS + 60);
    return () => {
      window.clearTimeout(timer);
    };
  }, [canCollect]);

  function readyRattleStyle(index: number): CSSProperties {
    return readyRattle
      ? {
        animation: `morkahja-result-ready-rattle ${READY_RATTLE_MS}ms ease-out ${index * READY_RATTLE_STAGGER_MS}ms`,
        transformOrigin: '50% 50%',
      }
      : {};
  }

  function collectStyle(key: string): CSSProperties {
    if (collected.has(key)) {
      return { opacity: 0, pointerEvents: 'none' };
    }
    return canCollect ? { cursor: 'pointer' } : {};
  }

  async function proceedAfterCollecting(): Promise<void> {
    postPressContinueRef.current = true;
    activationRevealDoneRef.current = true;
    setContinueInteractive(false);
    setContinueSubmitInFlight(true);
    try {
      await Promise.resolve(onContinue());
    } catch {
      // Continuing failed: bring the items back so the player can try again.
      postPressContinueRef.current = false;
      activationRevealDoneRef.current = false;
      collectedRef.current = new Set();
      setCollected(new Set());
      setContinueInteractive(true);
    } finally {
      setContinueSubmitInFlight(false);
    }
  }

  async function collectItem(key: string): Promise<void> {
    if (!canCollect || collectedRef.current.has(key)) {
      return;
    }
    hideItemTooltip();

    // Measure before hiding the item: its flight starts from its place.
    const isReward = key.startsWith('r:');
    const solutionId = Number(key.slice(2));
    const flightId = isReward
      ? (solutionId === LORE_GEM_REWARD_ID ? 'reward-fly-lore-gem' : `reward-fly-${solutionId}`)
      : `loss-dismiss-${solutionId}`;
    const rewardFlights = isReward ? buildRewardFlights().filter((flight) => flight.id === flightId) : [];
    const lossFlights = isReward ? [] : buildLossFlights().filter((flight) => flight.id === flightId);

    collectedRef.current = new Set(collectedRef.current).add(key);
    setCollected(collectedRef.current);
    const isLast = collectibleKeys.every((candidate) => collectedRef.current.has(candidate));
    playSfx(isLast ? CONTINUE_SOUND : DEFAULT_BUTTON_SOUND);

    const flight = isReward
      ? playRewardFlights(rewardFlights, { keepOtherFlyers: true })
      : playLossBubblesFromTargets(lossFlights, { keepOtherFlyers: true });
    if (!isLast) {
      void flight;
      return;
    }

    // Let the last item get on its way before the round moves on.
    await Promise.race([flight, new Promise<void>((resolve) => { window.setTimeout(resolve, 900); })]);
    await proceedAfterCollecting();
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
      ? `Used (−${change.quantity})`
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

  function renderLoreGemRewardIcon(placement: CSSProperties = {}) {
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
        onClick={() => { void collectItem(`r:${LORE_GEM_REWARD_ID}`); }}
        style={{ ...loreGemRewardButtonStyle, ...placement, ...collectStyle(`r:${LORE_GEM_REWARD_ID}`) }}
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
        onClick={trackRewardRef ? () => { void collectItem(`r:${change.solution.mSolutionID}`); } : undefined}
        style={trackRewardRef ? { ...buttonStyle, ...collectStyle(`r:${change.solution.mSolutionID}`) } : buttonStyle}
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

  function renderLossIcon(loss: EncounterInventoryChange, placement: CSSProperties = {}) {
    const lossKey = `l:${loss.solution.mSolutionID}`;
    const landedHere = arrivedLossKeys.has(lossKey);
    const lossVisible = (lossesRevealed || landedHere) && !lossesFlyingAway;
    const imageStyle = {
      ...lossIconStyle(loss.solution.mSolutionInventoryType),
      opacity: lossVisible ? 1 : 0,
      // Hidden icons keep their final place: arriving losses fly to exactly this spot.
      transform: 'translateY(0) scale(1)',
      transition: lossesFlyingAway
        ? 'opacity 0ms, transform 0ms'
        : landedHere || lossesArrived
          // Fades in under its landed flyer, which then fades out over it.
          ? `opacity ${landingRevealMs(LOSS_ARRIVAL_MS)}ms ease-out`
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
        onClick={() => { void collectItem(`l:${loss.solution.mSolutionID}`); }}
        style={{
          ...rewardItemStyle,
          ...placement,
          pointerEvents: lossVisible ? 'auto' : 'none',
          ...(lossVisible ? collectStyle(`l:${loss.solution.mSolutionID}`) : {}),
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
  const [resultFadedIn, setResultFadedIn] = useState(false);

  useEffect(() => {
    if (!resultInteractive) {
      setResultFadedIn(false);
      return undefined;
    }

    if (presenceVisible !== undefined) {
      setResultFadedIn(true);
      return undefined;
    }

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setResultFadedIn(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [presenceVisible, resultInteractive]);

  const resultShown = resultInteractive && (
    presenceVisible !== undefined ? presenceVisible : resultFadedIn
  );

  // As the result appears, the solution the player used travels from its slot
  // into the middle of the encounter picture and shrinks to nothing: it was
  // spent on this encounter.
  useEffect(() => {
    if (
      !resultShown
      || readOnlyWitness
      || roll === null
      || !resolutionAction
      || resolutionAction === 'dice'
      || usedSolutions.length === 0
    ) {
      return;
    }

    // Once per encounter: continuing (collecting) re-renders the result with the
    // server's final values, which must not replay the spending animation.
    // Only for a solution the player really committed in this encounter, once.
    if (!takeCommittedSolutionSpend(encounterSnapshotId, resolutionAction)) {
      return;
    }

    const slotElement = document.querySelector(`[data-solution-slot="${resolutionAction}"]`);
    const sourceRect = slotElement?.getBoundingClientRect();
    if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
      return;
    }

    // Only one icon at a time: the original slot icon hides as the flyer takes
    // over, and is restored afterwards (the solution bar is hidden by then).
    const slotVisual = slotElement instanceof HTMLElement ? slotElement : null;
    const hideSlot = (): void => {
      if (slotVisual) {
        slotVisual.style.visibility = 'hidden';
      }
    };
    void playUsedSolutionsIntoEncounter(usedSolutions.map((usedSolution, index) => ({
      imageSrc: solutionImagePath(usedSolution.solution),
      size: Math.round(Math.min(sourceRect.width, sourceRect.height)),
      sourceRect,
      onTakeOff: index === 0 ? hideSlot : undefined,
    }))).finally(() => {
      if (slotVisual) {
        slotVisual.style.visibility = '';
      }
    });
  }, [encounterSnapshotId, readOnlyWitness, resolutionAction, resultShown, roll, usedSolutions]);

  // Rewards grow out of the middle of the encounter into their slots, the
  // reverse of the used solution; after a used solution, just as it vanishes.
  useEffect(() => {
    if (!resultShown || rewardsEmerged) {
      return undefined;
    }

    // A result the player did not just commit (for example the previous one,
    // still shown for a moment as a new encounter starts) shows without flying.
    const ownResult = readOnlyWitness || committedActionFor(encounterSnapshotId) !== null;
    if (!ownResult || !claimAnimationOnce(`emerge:${encounterSnapshotId ?? `roll-${roll ?? 'witness'}`}`)) {
      // Already played for this encounter (or interrupted): never leave rewards hidden.
      setRewardsEmerged(true);
      return undefined;
    }

    let cancelled = false;
    const solutionFlew = !readOnlyWitness
      && Boolean(resolutionAction)
      && resolutionAction !== 'dice'
      && usedSolutions.length > 0;

    async function emerge(): Promise<void> {
      if (solutionFlew) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, Math.round(USED_SOLUTION_FLIGHT_MS * 0.8));
        });
      }
      await waitForNextPaint();
      if (cancelled) {
        return;
      }

      const flights = [...rewardButtonRefs.current.entries()].flatMap(([solutionId, button]) => {
        const imageSrc = button.querySelector('img')?.src;
        const targetRect = button.getBoundingClientRect();
        if (!imageSrc || targetRect.width <= 0) {
          return [];
        }
        return [{
          key: `r:${solutionId}`,
          imageSrc,
          size: Math.round(Math.min(targetRect.width, targetRect.height)),
          targetRect,
        }];
      });

      // Each reward fades in under its own flyer as it lands.
      const landed = new Set<string>();
      await playRewardEmergence(flights, (index) => {
        if (cancelled) {
          return;
        }
        landed.add(flights[index]!.key);
        setEmergedRewardKeys(new Set(landed));
      });
      if (!cancelled) {
        setRewardsEmerged(true);
      }
    }

    void emerge();
    return () => {
      cancelled = true;
    };
  }, [encounterSnapshotId, readOnlyWitness, resolutionAction, resultShown, roll, rewardsEmerged, usedSolutions.length]);

  return (
    <div
      aria-hidden={roll === null}
      inert={resultShown ? undefined : true}
      ref={blockRef}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      style={{
        ...resultBlockStyle,
        opacity: resultShown ? 1 : 0,
        pointerEvents: resultShown ? 'auto' : 'none',
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
@keyframes morkahja-result-ready-rattle { 0%, 100% { transform: rotate(0deg) scale(1); } 18% { transform: rotate(-3.5deg) scale(1.04); } 36% { transform: rotate(3.5deg) scale(1.03); } 54% { transform: rotate(-2.5deg) scale(1.05); } 72% { transform: rotate(2deg) scale(1.02); } 86% { transform: rotate(-1deg) scale(1.03); } }
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
      {(!readOnlyWitness || visible) && !collectMode ? (
        <button
          aria-disabled={!continueInteractive}
          aria-label="Continue"
          className="morkahja-footer-button"
          disabled={
            disabled
            || continueSubmitInFlight
            || !continueInteractive
            || (readOnlyWitness && !witnessShowContinue)
            || (!readOnlyWitness && !actorShowContinue)
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
              || continueSubmitInFlight
              || !continueInteractive
              || (readOnlyWitness && !witnessShowContinue)
              || (!readOnlyWitness && !actorShowContinue)
              || (deferRewardDismiss && localContinuePressed)
                ? 'default'
                : 'pointer',
            pointerEvents:
              resultInteractive
              && continueInteractive
              && !continueSubmitInFlight
              && !(readOnlyWitness && !witnessShowContinue)
              && !(!readOnlyWitness && !actorShowContinue)
                ? 'auto'
                : 'none',
          }}
          type="button"
        >
          <span
            className="morkahja-footer-button-visual"
            key={`continue-${roll}`}
            style={{
              ...(continueRevealPlaying
                ? continueRevealSpinStyle()
                : continueButtonVisible
                  ? continueSettledStyle
                  : continueHiddenStyle),
              ...(continuePressAnimating && !showContinueFloat ? continueAnimatingStyle : {}),
              ...(showContinueFloat ? { animation: undefined } : {}),
            }}
          >
            <span
              className={[
                showContinueFloat ? 'morkahja-continue-float' : undefined,
                continueGlowClass,
              ].filter(Boolean).join(' ') || undefined}
              style={{
                display: 'block',
                ...(continueEnableRattle && !showContinueFloat
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
      ) : null}
      {(() => {
        // One row in the solution bar's places: rewards, an earned lore gem,
        // then losses, filled middle first; anything beyond five floats above.
        const showRewards = !rewardsFlyingAway && !rewardDismissInProgress;
        const showLosses = losses.length > 0 && !lossesFlyingAway;
        const showLoreGem = showRewards && !readOnlyWitness && showLoreGemReward && roll !== null;
        const rewardShown = (key: string): CSSProperties => ({
          opacity: rewardsEmerged || emergedRewardKeys.has(key) ? 1 : 0,
          // Fades in under its landed flyer, which then fades out over it.
          transition: `opacity ${landingRevealMs(REWARD_EMERGE_MS)}ms ease-out`,
        });
        const entries: Array<(placement: CSSProperties) => ReactNode> = [
          ...(showRewards
            ? rewards.map((reward) => (placement: CSSProperties) => renderSolutionIcon(
              reward,
              '+',
              rewardImageStyle,
              { ...rewardItemStyle, ...placement, ...rewardShown(`r:${reward.solution.mSolutionID}`) },
            ))
            : []),
          ...(showLoreGem
            ? [(placement: CSSProperties) => renderLoreGemRewardIcon({
              ...placement,
              ...rewardShown(`r:${LORE_GEM_REWARD_ID}`),
            })]
            : []),
          ...(showLosses
            ? losses.map((loss) => (placement: CSSProperties) => renderLossIcon(loss, {
              ...placement,
              ...rewardDismissLayerStyle(rewardDismissInProgress),
            }))
            : []),
        ];
        const order: readonly number[] = collectMode ? RESULT_SLOT_ORDER : RESULT_SLOT_ORDER_AROUND_CONTINUE;
        const slotted = entries.slice(0, order.length);
        const overflow = entries.slice(order.length);
        return (
          <>
            {slotted.map((render, index) => render({
              gridColumn: String(order[index]),
              gridRow: '1',
              zIndex: 11,
              ...readyRattleStyle(index),
            }))}
            {overflow.length > 0 ? (
              <div
                aria-label="More rewards and losses"
                {...{ [PROTECTED_SURFACE_ATTR]: '' }}
                style={rewardOverflowRowStyle}
              >
                {overflow.map((render, index) => render(readyRattleStyle(slotted.length + index)))}
              </div>
            ) : null}
          </>
        );
      })()}
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
