import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { gameSolutions } from '../../../data/gameContent.js';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterSnapshot,
  InventoryItem,
} from '../../../api/http.js';
import { DICE_SOUND, playSfx, SOLUTION_SOUND } from '../../sfx.js';
import { useGameTooltip, type GameTooltipContent } from '../GameTooltip.js';
import {
  PROTECTED_SURFACE_ATTR,
} from '../../protectedImage.js';
import { waitForNextPaint } from '../../transitions/avatarEnterTransition.js';
import {
  diceButtonAssetPath,
  DEFAULT_DICE_ID,
} from '@shared/diceCatalog.js';
import {
  ENCOUNTER_ACTIONS_FADE_DURATION_MS,
  ENCOUNTER_ACTIONS_REVEAL_DELAY_MS,
  FADE_DURATION_MS,
  fadeTransition,
} from '../../transitions/fade.js';
import {
  encounterTooltipDescriptionStyle,
  encounterTooltipDetailStyle,
  encounterTooltipTitleStyle,
} from '../encounterTooltip.js';
import { predictUsedSolutionIds, slotHasEnoughSolutionCharges } from '../encounterInventoryPreview.js';
import { assetUrl } from '../../../assetUrl.js';
import type { ActionRevealPhase } from './actionRevealPhase.js';
import {
  recordCommittedAction,
  getFooterButtonRect,
  landingRevealMs,
  SOLUTION_SLOT_INBOUND_FLIGHT_MS,
  SOLUTION_SLOT_INBOUND_STAGGER_MS,
  playSolutionSlotInboundFlights,
  type RewardFlyTargetKind,
  type SolutionSlotInboundFlightSpec,
} from '../rewardFlyAnimation.js';
import { BOTTOM_EDGE_ANCHOR_STYLE } from './decorativeFrameShared.js';
import { startFrameTimer } from '../frameTimer.js';

const DEFAULT_DICE_BUTTON = assetUrl(diceButtonAssetPath(DEFAULT_DICE_ID));
const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');

type SlotLetter = 'A' | 'B' | 'C' | 'D';

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionInventoryType: number;
  mSolutionName: string;
  mSolutionText: string;
  mSolutionType: number;
}

interface VisibleSolutionSlot {
  available: boolean;
  description: string;
  displayedUses: number;
  imageSrc: string;
  isPrimary: boolean;
  itemsUsed: number;
  name: string;
  poolUses: number;
  requiredUses: number;
  solutionId: number;
  slot: SlotLetter;
}

const UNAVAILABLE_SOLUTION_OPACITY = 0.37;
const AVAILABLE_SOLUTION_READY_MS = 560;
const SOLUTION_REVEAL_TOTAL_MS = ENCOUNTER_ACTIONS_FADE_DURATION_MS + AVAILABLE_SOLUTION_READY_MS;
const SOLUTION_ENABLE_RATTLE_MS = 520;
const DICE_ROLL_ANIMATION_MS = 1350;
const SOLUTION_ROLL_REVEAL_MS = 1800;

const SOLUTION_ACTION_SIZE_PX = 64;

type SolutionRevealDirection = 'left' | 'right' | 'bottom';

function solutionSpinAnimationName(
  direction: SolutionRevealDirection,
  available: boolean,
): string {
  const unavailableSuffix = available ? '' : '-unavailable';

  if (direction === 'left') {
    return `morkahja-solution-reveal-left${unavailableSuffix}`;
  }

  if (direction === 'right') {
    return `morkahja-solution-reveal-right${unavailableSuffix}`;
  }

  return 'morkahja-solution-reveal-dice';
}

function solutionHiddenStyle(direction: SolutionRevealDirection): CSSProperties {
  const hiddenRotation = direction === 'left'
    ? '-14deg'
    : direction === 'right'
      ? '14deg'
      : '-12deg';
  const hiddenScale = direction === 'bottom' ? 0.92 : 0.86;

  return {
    opacity: 0,
    transform: `rotate(${hiddenRotation}) scale(${hiddenScale})`,
    transformOrigin: '50% 50%',
  };
}

function solutionRevealSpinStyle(
  direction: SolutionRevealDirection,
): CSSProperties {
  return {
    opacity: 0,
    transformOrigin: '50% 50%',
    animation: `${solutionSpinAnimationName(direction, false)} ${SOLUTION_REVEAL_TOTAL_MS}ms cubic-bezier(0.55, 0, 0.25, 1) forwards`,
  };
}

function solutionSettledStyle(available: boolean): CSSProperties {
  return {
    opacity: available ? 1 : UNAVAILABLE_SOLUTION_OPACITY,
    transform: 'rotate(0deg) scale(1)',
    transformOrigin: '50% 50%',
  };
}

function solutionRevealStyle(
  revealing: boolean,
  interactive: boolean,
  direction: SolutionRevealDirection,
  available: boolean,
): CSSProperties {
  if (!revealing) {
    return solutionHiddenStyle(direction);
  }

  if (!interactive) {
    return solutionRevealSpinStyle(direction);
  }

  return solutionSettledStyle(available);
}

function solutionInboundButtonStyle(
  revealing: boolean,
): CSSProperties {
  if (!revealing) {
    return { opacity: 0 };
  }

  return { opacity: 1 };
}

function solutionIconShellRevealStyle(
  revealing: boolean,
  revealSettled: boolean,
  direction: SolutionRevealDirection,
  available: boolean,
  slot: SlotLetter,
  inboundFlownSlots: Set<SlotLetter>,
): CSSProperties {
  if (!revealing) {
    return {};
  }

  if (!revealSettled) {
    return solutionRevealSpinStyle(direction);
  }

  const opacityTransition = `opacity ${FADE_DURATION_MS}ms ease`;

  if (available && inboundFlownSlots.has(slot)) {
    return {
      opacity: 1,
      transform: 'rotate(0deg) scale(1)',
      transformOrigin: '50% 50%',
      // Quick: the landed flyer still covers the slot while this fades in.
      transition: `opacity ${landingRevealMs(SOLUTION_SLOT_INBOUND_FLIGHT_MS)}ms ease-out`,
    };
  }

  return {
    opacity: UNAVAILABLE_SOLUTION_OPACITY,
    transform: 'rotate(0deg) scale(1)',
    transformOrigin: '50% 50%',
    transition: opacityTransition,
  };
}

function diceRevealStyle(revealing: boolean, interactive: boolean): CSSProperties {
  return solutionRevealStyle(revealing, interactive, 'bottom', true);
}

const enableRattleAnimationStyle: CSSProperties = {
  animation: `morkahja-solution-enable-rattle ${SOLUTION_ENABLE_RATTLE_MS}ms ease-out`,
  transformOrigin: '50% 50%',
};

interface SolutionTooltipState {
  description: string;
  detail: string;
  name: string;
  unavailable: boolean;
}

const unavailableSolutionTooltipStyle: CSSProperties = {
  width: 160,
  maxWidth: 160,
  padding: '6px 9px',
  textAlign: 'center',
};

const unavailableTooltipTitleStyle: CSSProperties = {
  margin: '0 0 3px',
  color: '#ffcc66',
  fontSize: '0.8rem',
  fontWeight: 700,
  lineHeight: 1.15,
};

const unavailableTooltipDetailStyle: CSSProperties = {
  margin: 0,
  color: '#ff9a92',
  fontSize: '0.7rem',
  lineHeight: 1.15,
};

const compactDiceTooltipStyle: CSSProperties = {
  width: 'max-content',
  maxWidth: 'min(70vw, 220px)',
  padding: '6px 11px',
  textAlign: 'center',
};

const compactDiceTooltipTitleStyle: CSSProperties = {
  margin: '0 0 2px',
  color: '#ffcc66',
  fontSize: '0.8rem',
  fontWeight: 700,
  lineHeight: 1.1,
  textAlign: 'center',
};

const compactDiceTooltipDetailStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontSize: '0.72rem',
  lineHeight: 1.1,
  textAlign: 'center',
};

function isCompactDiceTooltip(tooltip: SolutionTooltipState): boolean {
  return tooltip.name === 'Dice' && !tooltip.description && !tooltip.unavailable;
}

const solutionBlockStyle: CSSProperties = {
  ...BOTTOM_EDGE_ANCHOR_STYLE,
  width: '96%',
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
  alignItems: 'center',
  justifyItems: 'center',
  zIndex: 30,
  overflow: 'visible',
  pointerEvents: 'auto',
};

const solutionActionsLayerStyle: CSSProperties = {
  gridArea: '1 / 1',
  width: '100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  alignItems: 'center',
  justifyItems: 'center',
  columnGap: 6,
};

const solutionIconShellStyle: CSSProperties = {
  width: SOLUTION_ACTION_SIZE_PX,
  height: SOLUTION_ACTION_SIZE_PX,
  borderRadius: '50%',
  overflow: 'hidden',
};

const primarySolutionGlowStyle: CSSProperties = {
  boxShadow: '0 0 16px rgba(255, 204, 102, 0.72), 0 0 24px rgba(255, 204, 102, 0.38)',
};

const diceButtonStyle: CSSProperties = {
  width: SOLUTION_ACTION_SIZE_PX,
  padding: 0,
  border: 0,
  background: 'transparent',
};

const diceSlotStyle: CSSProperties = {
  position: 'relative',
  width: SOLUTION_ACTION_SIZE_PX,
  display: 'grid',
  placeItems: 'center',
};

const solutionButtonStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: SOLUTION_ACTION_SIZE_PX,
  padding: 0,
  border: 0,
  background: 'transparent',
};

const solutionImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  pointerEvents: 'none',
};

const lockpickAnimationStyle: CSSProperties = {
  animation: 'morkahja-solution-lockpick 1500ms cubic-bezier(0.2, 0.8, 0.2, 1)',
  transformOrigin: '50% 50%',
};

const diceImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.5))',
  pointerEvents: 'none',
};

const diceRollAnimationStyle: CSSProperties = {
  animation: `morkahja-dice-roll ${DICE_ROLL_ANIMATION_MS}ms linear`,
  animationFillMode: 'forwards',
  transformOrigin: '50% 50%',
};



function solutionsById(): Record<string, SolutionRecord> {
  return gameSolutions() as Record<string, SolutionRecord>;
}

function inventoryItems(inventory: AvatarInventory | undefined): InventoryItem[] {
  if (!inventory) {
    return [];
  }

  return [
    ...inventory.spellbook,
    ...inventory.items,
    ...inventory.essences,
  ].filter((item) => item.uses > 0);
}

function solutionImagePath(solution: SolutionRecord): string {
  return `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp`;
}

function inventorySourceKind(solutionId: number): RewardFlyTargetKind {
  const solution = solutionsById()[String(solutionId)];

  return solution?.mSolutionInventoryType === 1 ? 'skillbook' : 'inventory';
}

function buildInboundSolutionFlights(
  block: HTMLDivElement | null,
  encounter: EncounterSnapshot,
  inventory: AvatarInventory | undefined,
): SolutionSlotInboundFlightSpec[] {
  if (!block) {
    return [];
  }

  return (['A', 'B', 'C', 'D'] as const).flatMap((slot) => {
    const visibleSlot = solutionForSlot(encounter, inventory, slot);

    if (!visibleSlot?.available) {
      return [];
    }

    const targetElement = block.querySelector(`[data-solution-slot="${slot}"]`);
    const targetRect = targetElement?.getBoundingClientRect();

    if (!targetRect || targetRect.width <= 0 || targetRect.height <= 0) {
      return [];
    }

    const sourceKind = inventorySourceKind(visibleSlot.solutionId);
    const sourceRect = getFooterButtonRect(sourceKind);

    if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
      return [];
    }

    return [{
      id: slot,
      imageSrc: visibleSlot.imageSrc,
      // On-screen size: the stage is scaled, the flyer is not.
      size: Math.round(Math.min(targetRect.width, targetRect.height)),
      source: sourceKind,
      sourceRect,
      targetRect,
    }];
  });
}

function primaryRequirement(
  encounter: EncounterSnapshot,
  slot: SlotLetter,
): number {
  switch (slot) {
    case 'A':
      return encounter.primarySolutionA ?? 0;
    case 'B':
      return encounter.primarySolutionB ?? 0;
    case 'C':
      return encounter.primarySolutionC ?? 0;
    case 'D':
      return encounter.primarySolutionD ?? 0;
  }
}

function secondaryRequirement(
  encounter: EncounterSnapshot,
  slot: SlotLetter,
): number {
  switch (slot) {
    case 'A':
      return encounter.secondarySolutionTypeA ?? 0;
    case 'B':
      return encounter.secondarySolutionTypeB ?? 0;
    case 'C':
      return encounter.secondarySolutionTypeC ?? 0;
    case 'D':
      return encounter.secondarySolutionTypeD ?? 0;
  }
}

function previewSolutionForRequirement(
  primaryId: number,
  secondaryType: number,
): { isPrimary: boolean; solution: SolutionRecord } | null {
  if (primaryId > 0) {
    const solution = solutionsById()[String(primaryId)];

    if (solution) {
      return { isPrimary: true, solution };
    }
  }

  if (secondaryType > 0) {
    const solution = Object.values(solutionsById()).find(
      (record) => record.mSolutionType === secondaryType,
    );

    if (solution) {
      return { isPrimary: false, solution };
    }
  }

  return null;
}

function formatSolutionChargeTooltipDetail(solution: VisibleSolutionSlot): string {
  const {
    available,
    displayedUses,
    isPrimary,
    itemsUsed,
    poolUses,
    requiredUses,
  } = solution;
  const poolLabel = isPrimary ? 'Total available' : 'Total (same type)';

  if (!available) {
    if (poolUses <= 0) {
      return 'Not in inventory';
    }

    return [
      `Charges: ${displayedUses}`,
      `${poolLabel}: ${poolUses} / ${requiredUses} needed`,
    ].join('\n');
  }

  if (requiredUses <= 1 && itemsUsed <= 1) {
    return `Charges: ${displayedUses}`;
  }

  const lines = [
    `Charges: ${displayedUses}`,
    `${poolLabel}: ${poolUses} (${requiredUses} needed)`,
  ];

  if (itemsUsed > 1) {
    lines.push(`Items used: ${itemsUsed}`);
  }

  return lines.join('\n');
}

function solutionForSlot(
  encounter: EncounterSnapshot,
  inventory: AvatarInventory | undefined,
  slot: SlotLetter,
): VisibleSolutionSlot | null {
  const items = inventoryItems(inventory);
  const primaryId = primaryRequirement(encounter, slot);
  const secondaryType = secondaryRequirement(encounter, slot);
  const chargeState = slotHasEnoughSolutionCharges({ encounter, inventory, slot });

  if (primaryId <= 0 && secondaryType <= 0) {
    return null;
  }

  const primaryMatch = primaryId > 0
    ? items.find((item) => item.solutionId === primaryId)
    : undefined;
  const secondaryMatch = secondaryType > 0
    ? items
        .filter((item) => item.solutionType === secondaryType)
        .sort((a, b) => a.solutionId - b.solutionId)[0]
    : undefined;
  const matchedItem = chargeState.isPrimary
    ? primaryMatch ?? secondaryMatch
    : secondaryMatch ?? primaryMatch;

  if (matchedItem && chargeState.available) {
    const solution = solutionsById()[String(matchedItem.solutionId)];

    if (!solution) {
      return null;
    }

    return {
      available: true,
      description: solution.mSolutionText,
      displayedUses: matchedItem.uses,
      imageSrc: solutionImagePath(solution),
      isPrimary: chargeState.isPrimary,
      itemsUsed: new Set(
        predictUsedSolutionIds({ encounter, inventory, action: slot }),
      ).size,
      name: solution.mSolutionName,
      poolUses: chargeState.totalUses,
      requiredUses: chargeState.requiredUses,
      solutionId: matchedItem.solutionId,
      slot,
    };
  }

  const preview = previewSolutionForRequirement(primaryId, secondaryType);

  if (!preview) {
    return null;
  }

  return {
    available: false,
    description: preview.solution.mSolutionText,
    displayedUses: 0,
    imageSrc: solutionImagePath(preview.solution),
    isPrimary: preview.isPrimary,
    itemsUsed: 0,
    name: preview.solution.mSolutionName,
    poolUses: chargeState.totalUses,
    requiredUses: chargeState.requiredUses,
    solutionId: preview.solution.mSolutionID,
    slot,
  };
}

function rollForSolutionSlot(
  encounter: EncounterSnapshot,
  solution: VisibleSolutionSlot,
): number | null {
  if (solution.isPrimary) {
    return {
      A: encounter.rollPrimaryA ?? encounter.rollA ?? null,
      B: encounter.rollPrimaryB ?? encounter.rollA ?? null,
      C: encounter.rollPrimaryC ?? encounter.rollC ?? null,
      D: encounter.rollPrimaryD ?? encounter.rollC ?? null,
    }[solution.slot];
  }

  return {
    A: encounter.rollSecondaryA ?? encounter.rollB ?? null,
    B: encounter.rollSecondaryB ?? encounter.rollB ?? null,
    C: encounter.rollSecondaryC ?? encounter.rollD ?? null,
    D: encounter.rollSecondaryD ?? encounter.rollD ?? null,
  }[solution.slot];
}

export function SolutionBlock({
  diceButtonAsset = DEFAULT_DICE_BUTTON,
  encounterRevealKey,
  hidden = false,
  onActionReveal,
  encounter,
  inventory,
}: {
  diceButtonAsset?: string;
  encounterRevealKey: string;
  hidden?: boolean;
  /**
   * Called twice per choice: `phase: 'select'` when the player picks it, then
   * `phase: 'commit'` when the reveal timer fires. The server withholds rolls
   * until a choice is committed, so `roll` is usually null at commit time and
   * the revealed roll comes back with the committed room snapshot.
   */
  onActionReveal?: (
    action: EncounterAction,
    roll: number | null,
    solutionId?: number,
    phase?: ActionRevealPhase,
  ) => void;
  encounter: EncounterSnapshot;
  inventory: AvatarInventory | undefined;
}) {
  const blockRef = useRef<HTMLDivElement | null>(null);
  const rollRevealTimer = useRef<number | null>(null);
  const [actionsVisible, setActionsVisible] = useState(false);
  const [actionsRevealSettled, setActionsRevealSettled] = useState(false);
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const [enableRattleSlots, setEnableRattleSlots] = useState<Set<SlotLetter>>(
    () => new Set(),
  );
  const [diceEnableRattle, setDiceEnableRattle] = useState(false);
  const [diceRollCount, setDiceRollCount] = useState(0);
  const [activeSolutionSlot, setActiveSolutionSlot] = useState<SlotLetter | null>(null);
  const [inboundFlownSlots, setInboundFlownSlots] = useState<Set<SlotLetter>>(
    () => new Set(),
  );

  useEffect(() => {
    setActionsVisible(false);
    setActionsRevealSettled(false);
    setActionsInteractive(false);
    setEnableRattleSlots(new Set());
    setDiceEnableRattle(false);
    setDiceRollCount(0);
    solutionTips.hide();
    setInboundFlownSlots(new Set());

    let cancelled = false;
    const frameTimers: Array<() => void> = [];
    const diceButton = (): Element | null => blockRef.current?.querySelector('[aria-label="Roll dice"]') ?? null;

    async function runActionsReveal(): Promise<void> {
      // The frame's bottom line counts down to the moment the actions can be used.
      frameTimers.push(startFrameTimer(diceButton(), ENCOUNTER_ACTIONS_REVEAL_DELAY_MS + SOLUTION_REVEAL_TOTAL_MS));
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, ENCOUNTER_ACTIONS_REVEAL_DELAY_MS);
      });

      if (cancelled) {
        return;
      }

      await waitForNextPaint();

      if (cancelled) {
        return;
      }

      setActionsVisible(true);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SOLUTION_REVEAL_TOTAL_MS);
      });

      if (cancelled) {
        return;
      }

      setActionsRevealSettled(true);
      await waitForNextPaint();

      if (cancelled) {
        return;
      }

      const inboundFlights = buildInboundSolutionFlights(
        blockRef.current,
        encounter,
        inventory,
      );
      const completedInboundFlights = new Set<SlotLetter>();

      if (inboundFlights.length > 0) {
        frameTimers.push(startFrameTimer(
          diceButton(),
          SOLUTION_SLOT_INBOUND_FLIGHT_MS + (inboundFlights.length - 1) * SOLUTION_SLOT_INBOUND_STAGGER_MS,
        ));
        await playSolutionSlotInboundFlights(inboundFlights, (flightId) => {
          if (cancelled) {
            return;
          }

          completedInboundFlights.add(flightId as SlotLetter);
          setInboundFlownSlots(new Set(completedInboundFlights));
        });
      }

      if (cancelled) {
        return;
      }

      setActionsInteractive(true);
      setDiceEnableRattle(true);

      const slotsToRattle = (['A', 'B', 'C', 'D'] as const).filter((slot) => {
        return completedInboundFlights.has(slot);
      });

      if (slotsToRattle.length > 0) {
        setEnableRattleSlots(new Set(slotsToRattle));
      }

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, SOLUTION_ENABLE_RATTLE_MS);
      });

      if (!cancelled) {
        setEnableRattleSlots(new Set());
        setDiceEnableRattle(false);
      }
    }

    void runActionsReveal();

    return () => {
      cancelled = true;
      frameTimers.forEach((cancel) => cancel());
    };
    // Only re-run reveal when the encounter snapshot changes — not on room poll object churn.
  }, [encounterRevealKey]);

  useEffect(() => {
    if (hidden) {
      solutionTips.hide();
    }
  }, [hidden]);

  const solutionSlots = ['A', 'B', 'dice', 'C', 'D'] as const;
  const visibleSlots = {
    A: solutionForSlot(encounter, inventory, 'A'),
    B: solutionForSlot(encounter, inventory, 'B'),
    C: solutionForSlot(encounter, inventory, 'C'),
    D: solutionForSlot(encounter, inventory, 'D'),
  };

  useEffect(() => () => {
    clearRollRevealTimer();
  }, []);

  function clearRollRevealTimer(): void {
    if (rollRevealTimer.current !== null) {
      window.clearTimeout(rollRevealTimer.current);
      rollRevealTimer.current = null;
    }
    setActiveSolutionSlot(null);
  }

  const actionsReady = actionsInteractive && !hidden;
  const actionsRevealing = actionsVisible && !hidden;
  // The game's shared tooltip: toward the picture's centre, corner-anchored
  // (centred for the dice), gold marker, short hover delay and soft fade.
  const solutionTips = useGameTooltip();
  const consumeLongPressActivation = solutionTips.consumeLongPressActivation;

  function solutionTooltipContent(key: string, info: SolutionTooltipState): GameTooltipContent | null {
    if (!actionsReady) {
      return null;
    }
    const compact = isCompactDiceTooltip(info);
    return {
      key,
      shellStyle: {
        width: 220,
        maxWidth: 220,
        // Sized by its text; never scrolls (the gold marker sits just outside the frame).
        overflow: 'visible',
        textAlign: 'left',
        ...(info.unavailable ? unavailableSolutionTooltipStyle : {}),
        ...(compact ? compactDiceTooltipStyle : {}),
      },
      body: info.unavailable ? (
        <>
          <div style={unavailableTooltipTitleStyle}>{info.name}</div>
          <div style={unavailableTooltipDetailStyle}>{info.detail}</div>
        </>
      ) : compact ? (
        <>
          <div style={compactDiceTooltipTitleStyle}>{info.name}</div>
          <div style={compactDiceTooltipDetailStyle}>{info.detail}</div>
        </>
      ) : (
        <>
          <div style={encounterTooltipTitleStyle}>{info.name}</div>
          {info.description ? (
            <div style={encounterTooltipDescriptionStyle}>{info.description}</div>
          ) : null}
          <div style={encounterTooltipDetailStyle}>{info.detail}</div>
        </>
      ),
    };
  }

  function solutionTooltipFor(solution: VisibleSolutionSlot): GameTooltipContent | null {
    return solutionTooltipContent(`solution-${solution.slot}`, {
      name: solution.name,
      description: solution.available ? solution.description : '',
      detail: formatSolutionChargeTooltipDetail(solution),
      unavailable: !solution.available,
    });
  }

  function diceTooltip(): GameTooltipContent | null {
    return solutionTooltipContent('dice', { name: 'Dice', description: '', detail: 'try your luck', unavailable: false });
  }

  function hideSolutionTooltip(): void {
    solutionTips.hide();
  }


  function handleDiceButtonClick(): void {
    if (consumeLongPressActivation()) {
      return;
    }

    if (!actionsReady) {
      return;
    }

    handleDiceClick();
  }

  function handleDiceClick(): void {
    clearRollRevealTimer();
    hideSolutionTooltip();

    onActionReveal?.('dice', null, undefined, 'select');
    playSfx(DICE_SOUND);
    setDiceRollCount((count) => count + 1);
    startFrameTimer(blockRef.current?.querySelector('[aria-label="Roll dice"]'), DICE_ROLL_ANIMATION_MS);
    rollRevealTimer.current = window.setTimeout(() => {
      recordCommittedAction(encounter.snapshotId, 'dice');
      onActionReveal?.('dice', encounter.rollE ?? null, undefined, 'commit');
      rollRevealTimer.current = null;
    }, DICE_ROLL_ANIMATION_MS);
  }

  function handleSolutionButtonClick(solution: VisibleSolutionSlot): void {
    if (consumeLongPressActivation()) {
      return;
    }

    if (!actionsReady || !solution.available) {
      return;
    }

    handleSolutionClick(solution);
  }

  function handleSolutionClick(solution: VisibleSolutionSlot): void {
    clearRollRevealTimer();
    hideSolutionTooltip();

    const roll = rollForSolutionSlot(encounter, solution);
    playSfx(SOLUTION_SOUND);
    setActiveSolutionSlot(solution.slot);
    startFrameTimer(blockRef.current?.querySelector(`[data-solution-slot="${solution.slot}"]`), SOLUTION_ROLL_REVEAL_MS);
    onActionReveal?.(solution.slot, null, solution.solutionId, 'select');
    rollRevealTimer.current = window.setTimeout(() => {
      recordCommittedAction(encounter.snapshotId, solution.slot);
      onActionReveal?.(solution.slot, roll, solution.solutionId, 'commit');
      setActiveSolutionSlot(null);
      rollRevealTimer.current = null;
    }, SOLUTION_ROLL_REVEAL_MS);
  }

  return (
    <div
      inert={hidden ? true : undefined}
      ref={blockRef}
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      style={{
        ...solutionBlockStyle,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <style>
        {'@keyframes morkahja-solution-reveal-left { 0% { opacity: 0; transform: rotate(-14deg) scale(0.86); } 55% { opacity: 0.42; transform: rotate(-6deg) scale(0.94); } 82% { opacity: 0.88; transform: rotate(-2deg) scale(0.99); } 100% { opacity: 1; transform: rotate(0deg) scale(1); } }'}
        {'@keyframes morkahja-solution-reveal-left-unavailable { 0% { opacity: 0; transform: rotate(-14deg) scale(0.86); } 55% { opacity: 0.16; transform: rotate(-6deg) scale(0.94); } 82% { opacity: 0.33; transform: rotate(-2deg) scale(0.99); } 100% { opacity: 0.37; transform: rotate(0deg) scale(1); } }'}
        {'@keyframes morkahja-solution-reveal-right { 0% { opacity: 0; transform: rotate(14deg) scale(0.86); } 55% { opacity: 0.42; transform: rotate(6deg) scale(0.94); } 82% { opacity: 0.88; transform: rotate(2deg) scale(0.99); } 100% { opacity: 1; transform: rotate(0deg) scale(1); } }'}
        {'@keyframes morkahja-solution-reveal-right-unavailable { 0% { opacity: 0; transform: rotate(14deg) scale(0.86); } 55% { opacity: 0.16; transform: rotate(6deg) scale(0.94); } 82% { opacity: 0.33; transform: rotate(2deg) scale(0.99); } 100% { opacity: 0.37; transform: rotate(0deg) scale(1); } }'}
        {'@keyframes morkahja-solution-reveal-dice { 0% { opacity: 0; transform: rotate(-12deg) scale(0.92); } 55% { opacity: 0.42; transform: rotate(-5deg) scale(0.96); } 82% { opacity: 0.88; transform: rotate(-1deg) scale(0.99); } 100% { opacity: 1; transform: rotate(0deg) scale(1); } }'}
        {'@keyframes morkahja-solution-lockpick { 0% { transform: rotate(0deg) scale(1); filter: brightness(1); } 12% { transform: rotate(-16deg) scale(1.05); filter: brightness(1.15); } 24% { transform: rotate(14deg) scale(1.03); } 36% { transform: rotate(-10deg) scale(1.06); } 48% { transform: rotate(8deg) scale(1.04); } 60% { transform: rotate(-5deg) scale(1.07); filter: brightness(1.35); } 72% { transform: rotate(3deg) scale(1.02); } 84% { transform: rotate(0deg) scale(1.1); filter: brightness(1.55); } 100% { transform: rotate(0deg) scale(1); filter: brightness(1); } }'}
        {'@keyframes morkahja-solution-enable-rattle { 0%, 100% { transform: rotate(0deg) scale(1); } 18% { transform: rotate(-3.5deg) scale(1.04); } 36% { transform: rotate(3.5deg) scale(1.03); } 54% { transform: rotate(-2.5deg) scale(1.05); } 72% { transform: rotate(2deg) scale(1.02); } 86% { transform: rotate(-1deg) scale(1.03); } }'}
        {'@keyframes morkahja-dice-roll { 0% { transform: rotate(0deg) translateY(0); } 12.5% { transform: rotate(90deg) translateY(-8px); } 25% { transform: rotate(180deg) translateY(0); } 37.5% { transform: rotate(270deg) translateY(-7px); } 50% { transform: rotate(360deg) translateY(0); } 62.5% { transform: rotate(450deg) translateY(-6px); } 75% { transform: rotate(540deg) translateY(0); } 87.5% { transform: rotate(630deg) translateY(-3px); } 100% { transform: rotate(720deg) translateY(0); } }'}
      </style>
      <div
        aria-label="Solution actions"
        style={{
          ...solutionActionsLayerStyle,
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden || !actionsReady ? 'none' : 'auto',
          transition: fadeTransition,
        }}
      >
        {solutionSlots.map((slot) => {
          if (slot === 'dice') {
            return (
            <div
              key={slot}
              style={{
                ...diceSlotStyle,
                ...diceRevealStyle(actionsRevealing, actionsReady),
              }}
            >
              <button
                aria-disabled={!actionsReady}
                aria-label="Roll dice"
                className="morkahja-footer-button"
                disabled={!actionsReady}
                onClick={handleDiceButtonClick}
                {...solutionTips.bindTooltip(diceTooltip)}
                style={diceButtonStyle}
                type="button"
              >
                <span className="morkahja-footer-button-visual">
                  <span
                    key={`${encounterRevealKey}-dice-rattle`}
                    style={{
                      display: 'block',
                      ...(diceEnableRattle && diceRollCount === 0
                        ? enableRattleAnimationStyle
                        : {}),
                    }}
                  >
                    <span
                      key={diceRollCount}
                      style={{
                        display: 'block',
                        ...(diceRollCount > 0 ? diceRollAnimationStyle : {}),
                      }}
                    >
                      <img
                        alt=""
                        aria-hidden="true"
                        draggable={false}
                        src={diceButtonAsset}
                        style={diceImageStyle}
                      />
                    </span>
                  </span>
                </span>
              </button>
            </div>
            );
          }

          const visibleSlot = visibleSlots[slot];

          if (!visibleSlot) {
            const emptyDirection: SolutionRevealDirection = slot === 'A' || slot === 'B'
              ? 'left'
              : 'right';

            return (
              <span
                aria-hidden="true"
                key={slot}
                style={{
                  ...solutionButtonStyle,
                  ...solutionInboundButtonStyle(actionsRevealing),
                  ...(!actionsRevealSettled && actionsRevealing
                    ? solutionRevealSpinStyle(emptyDirection)
                    : {}),
                  width: SOLUTION_ACTION_SIZE_PX,
                  height: SOLUTION_ACTION_SIZE_PX,
                }}
              />
            );
          }

          const revealDirection: SolutionRevealDirection = slot === 'A' || slot === 'B'
            ? 'left'
            : 'right';

          const showAsOwned = visibleSlot.available && inboundFlownSlots.has(slot);

          return (
              <button
                aria-disabled={!actionsReady || !visibleSlot.available}
                aria-label={
                  visibleSlot.available
                    ? `Use ${visibleSlot.name} in slot ${slot}`
                    : `${visibleSlot.name} required for slot ${slot}, not available`
                }
                className={`morkahja-footer-button${
                  showAsOwned ? '' : ' morkahja-footer-button--unavailable'
                }`}
                data-solution-slot={slot}
                disabled={!actionsReady}
                key={slot}
                {...solutionTips.bindTooltip(() => solutionTooltipFor(visibleSlot))}
                onClick={() => {
                  handleSolutionButtonClick(visibleSlot);
                }}
                style={{
                  ...solutionButtonStyle,
                  ...solutionInboundButtonStyle(actionsRevealing),
                }}
                type="button"
              >
                <span
                  className="morkahja-footer-button-visual"
                  style={{
                    ...solutionIconShellStyle,
                    ...solutionIconShellRevealStyle(
                      actionsRevealing,
                      actionsRevealSettled,
                      revealDirection,
                      visibleSlot.available,
                      slot,
                      inboundFlownSlots,
                    ),
                    ...(enableRattleSlots.has(slot) ? enableRattleAnimationStyle : {}),
                    ...(activeSolutionSlot === slot ? lockpickAnimationStyle : {}),
                    ...(visibleSlot.available
                      && visibleSlot.isPrimary
                      && actionsReady
                      && inboundFlownSlots.has(slot)
                      ? primarySolutionGlowStyle
                      : {}),
                  }}
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    src={visibleSlot.imageSrc}
                    style={solutionImageStyle}
                  />
                </span>
              </button>
            );
        })}
      </div>
      {!hidden ? solutionTips.layer : null}
    </div>
  );
}

export default SolutionBlock;
