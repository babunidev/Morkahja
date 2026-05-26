import { useEffect, useRef, useState, type CSSProperties } from 'react';
import solutionData from '../../../data/game/solutiondata.json';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterSnapshot,
  InventoryItem,
} from '../../../api/http.js';
import { DICE_SOUND, playSfx, SOLUTION_SOUND } from '../../sfx.js';
import {
  useTooltipRevealBinding,
  type TooltipRevealCallbacks,
} from '../../hooks/useTooltipReveal.js';
import {
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import {
  ENCOUNTER_ACTIONS_FADE_DURATION_MS,
  ENCOUNTER_ACTIONS_REVEAL_DELAY_MS,
} from '../../transitions/fade.js';

const FRAME_MASK = '/UI/09_GAME/im_spacer_line.webp';
const DICE_BUTTON = '/UI/09_GAME/im_button_dice_a.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';

type SlotLetter = 'A' | 'B' | 'C' | 'D';
type SolutionTooltipTriggerEvent = Parameters<TooltipRevealCallbacks['onShow']>[0];

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionName: string;
  mSolutionText: string;
  mSolutionType: number;
}

interface VisibleSolutionSlot {
  available: boolean;
  description: string;
  imageSrc: string;
  isPrimary: boolean;
  name: string;
  solutionId: number;
  slot: SlotLetter;
  uses: number;
}

const UNAVAILABLE_SOLUTION_OPACITY = 0.37;
const SOLUTION_ENABLE_RATTLE_MS = 520;
const DICE_ROLL_ANIMATION_MS = 1350;
const SOLUTION_ROLL_REVEAL_MS = 1800;

const encounterActionsRevealTransition = `opacity ${ENCOUNTER_ACTIONS_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${ENCOUNTER_ACTIONS_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

type SolutionRevealDirection = 'left' | 'right' | 'bottom';

function solutionRevealStyle(
  visible: boolean,
  direction: SolutionRevealDirection,
): CSSProperties {
  const hiddenRotation = direction === 'left'
    ? '-14deg'
    : direction === 'right'
      ? '14deg'
      : '-10deg';

  return {
    opacity: visible ? 1 : 0,
    transform: visible
      ? 'rotate(0deg) scale(1)'
      : `rotate(${hiddenRotation}) scale(0.86)`,
    transformOrigin: '50% 50%',
    transition: encounterActionsRevealTransition,
  };
}

function diceRevealStyle(visible: boolean): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? 'scale(1)' : 'scale(0.92)',
    transformOrigin: '50% 50%',
    transition: `opacity ${ENCOUNTER_ACTIONS_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${ENCOUNTER_ACTIONS_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
  };
}

const enableRattleAnimationStyle: CSSProperties = {
  animation: `morkahja-solution-enable-rattle ${SOLUTION_ENABLE_RATTLE_MS}ms ease-out`,
  transformOrigin: '50% 50%',
};

type SolutionTooltipAnchorX = 'left' | 'center' | 'right';

interface SolutionTooltipState {
  anchorX: SolutionTooltipAnchorX;
  description: string;
  detail: string;
  name: string;
  unavailable: boolean;
  x: number;
  y: number;
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

const solutionBlockStyle: CSSProperties = {
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
  transform: 'translateX(-50%) translateY(3px)',
  zIndex: 20,
  overflow: 'visible',
  pointerEvents: 'auto',
};

const frameMaskStyle: CSSProperties = {
  gridArea: '1 / 1',
  alignSelf: 'center',
  justifySelf: 'center',
  width: '100%',
  height: 10,
  objectFit: 'cover',
  zIndex: 6,
  pointerEvents: 'none',
};

const solutionActionsLayerStyle: CSSProperties = {
  gridArea: '1 / 1',
  zIndex: 7,
  width: '82%',
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  alignItems: 'center',
  justifyItems: 'center',
  columnGap: 10,
};

const SOLUTION_ACTION_SIZE_PX = 83;

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

const solutionTooltipStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  width: 220,
  maxWidth: 220,
  maxHeight: 'min(42vh, 200px)',
  overflow: 'auto',
  padding: '7px 10px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.94)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.78rem',
  lineHeight: 1.25,
  textAlign: 'left',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

function solutionTooltipTransform(anchorX: SolutionTooltipAnchorX): string {
  const offsetY = 'calc(-100% - 12px)';

  if (anchorX === 'left') {
    return `translate(0, ${offsetY})`;
  }

  if (anchorX === 'right') {
    return `translate(-100%, ${offsetY})`;
  }

  return `translate(-50%, ${offsetY})`;
}

function solutionTooltipAnchorX(slot: SlotLetter): SolutionTooltipAnchorX {
  if (slot === 'A' || slot === 'B') {
    return 'left';
  }

  if (slot === 'C' || slot === 'D') {
    return 'right';
  }

  return 'center';
}

const solutionTooltipTitleStyle: CSSProperties = {
  margin: '0 0 4px',
  color: '#ffcc66',
  fontSize: '0.86rem',
  fontWeight: 700,
  textAlign: 'center',
};

const solutionTooltipDescriptionStyle: CSSProperties = {
  margin: '0 0 6px',
  whiteSpace: 'pre-wrap',
};

const solutionsById = solutionData as Record<string, SolutionRecord>;

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
    const solution = solutionsById[String(primaryId)];

    if (solution) {
      return { isPrimary: true, solution };
    }
  }

  if (secondaryType > 0) {
    const solution = Object.values(solutionsById).find(
      (record) => record.mSolutionType === secondaryType,
    );

    if (solution) {
      return { isPrimary: false, solution };
    }
  }

  return null;
}

function solutionForSlot(
  encounter: EncounterSnapshot,
  inventory: AvatarInventory | undefined,
  slot: SlotLetter,
): VisibleSolutionSlot | null {
  const items = inventoryItems(inventory);
  const primaryId = primaryRequirement(encounter, slot);
  const secondaryType = secondaryRequirement(encounter, slot);

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
  const matchedItem = primaryMatch ?? secondaryMatch;

  if (matchedItem) {
    const solution = solutionsById[String(matchedItem.solutionId)];

    if (!solution) {
      return null;
    }

    return {
      available: true,
      description: solution.mSolutionText,
      imageSrc: solutionImagePath(solution),
      isPrimary: matchedItem.solutionId === primaryMatch?.solutionId,
      name: solution.mSolutionName,
      solutionId: matchedItem.solutionId,
      slot,
      uses: matchedItem.uses,
    };
  }

  const preview = previewSolutionForRequirement(primaryId, secondaryType);

  if (!preview) {
    return null;
  }

  return {
    available: false,
    description: preview.solution.mSolutionText,
    imageSrc: solutionImagePath(preview.solution),
    isPrimary: preview.isPrimary,
    name: preview.solution.mSolutionName,
    solutionId: preview.solution.mSolutionID,
    slot,
    uses: 0,
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
  encounterRevealKey,
  hidden = false,
  onActionReveal,
  encounter,
  inventory,
}: {
  encounterRevealKey: string;
  hidden?: boolean;
  onActionReveal?: (
    action: EncounterAction,
    roll: number | null,
    solutionId?: number,
  ) => void;
  encounter: EncounterSnapshot;
  inventory: AvatarInventory | undefined;
}) {
  const [actionsVisible, setActionsVisible] = useState(false);
  const [actionsInteractive, setActionsInteractive] = useState(false);
  const [enableRattleSlots, setEnableRattleSlots] = useState<Set<SlotLetter>>(
    () => new Set(),
  );
  const [diceEnableRattle, setDiceEnableRattle] = useState(false);
  const [diceRollCount, setDiceRollCount] = useState(0);
  const [solutionTooltip, setSolutionTooltip] = useState<SolutionTooltipState | null>(null);
  const [activeSolutionSlot, setActiveSolutionSlot] = useState<SlotLetter | null>(null);

  useEffect(() => {
    setActionsVisible(false);
    setActionsInteractive(false);
    setEnableRattleSlots(new Set());
    setDiceEnableRattle(false);
    setDiceRollCount(0);
    setSolutionTooltip(null);

    const revealTimer = window.setTimeout(() => {
      setActionsVisible(true);
    }, ENCOUNTER_ACTIONS_REVEAL_DELAY_MS);
    const interactiveTimer = window.setTimeout(() => {
      setActionsInteractive(true);
      setDiceEnableRattle(true);

      const slotsToRattle = (['A', 'B', 'C', 'D'] as const).filter((slot) => {
        const solution = solutionForSlot(encounter, inventory, slot);
        return solution?.available ?? false;
      });

      if (slotsToRattle.length > 0) {
        setEnableRattleSlots(new Set(slotsToRattle));
      }
    }, ENCOUNTER_ACTIONS_REVEAL_DELAY_MS + ENCOUNTER_ACTIONS_FADE_DURATION_MS);
    const rattleClearTimer = window.setTimeout(() => {
      setEnableRattleSlots(new Set());
      setDiceEnableRattle(false);
    }, ENCOUNTER_ACTIONS_REVEAL_DELAY_MS + ENCOUNTER_ACTIONS_FADE_DURATION_MS + SOLUTION_ENABLE_RATTLE_MS);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(interactiveTimer);
      window.clearTimeout(rattleClearTimer);
    };
  }, [encounter, encounterRevealKey, inventory]);

  useEffect(() => {
    if (hidden) {
      setSolutionTooltip(null);
    }
  }, [hidden]);

  const blockRef = useRef<HTMLDivElement | null>(null);
  const rollRevealTimer = useRef<number | null>(null);
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
  const { bind: bindTooltipReveal, consumeLongPressActivation } = useTooltipRevealBinding(
    actionsReady,
  );

  function showActionTooltip(
    name: string,
    description: string,
    detail: string,
    unavailable: boolean,
    anchorX: SolutionTooltipAnchorX,
    event: SolutionTooltipTriggerEvent,
  ): void {
    if (!actionsReady) {
      return;
    }

    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLButtonElement)) {
      return;
    }

    const blockRect = blockRef.current?.getBoundingClientRect();
    const buttonRect = trigger.getBoundingClientRect();
    const y = blockRect
      ? buttonRect.top - blockRect.top
      : 0;
    const x = !blockRect
      ? buttonRect.width / 2
      : anchorX === 'left'
        ? buttonRect.left - blockRect.left
        : anchorX === 'right'
          ? buttonRect.right - blockRect.left
          : buttonRect.left - blockRect.left + buttonRect.width / 2;

    setSolutionTooltip({
      anchorX,
      description,
      detail,
      name,
      unavailable,
      x,
      y,
    });
  }

  function showSolutionTooltip(
    solution: VisibleSolutionSlot,
    event: SolutionTooltipTriggerEvent,
  ): void {
    showActionTooltip(
      solution.name,
      solution.available ? solution.description : '',
      solution.available
        ? `Charges: ${solution.uses}`
        : 'Not in inventory',
      !solution.available,
      solutionTooltipAnchorX(solution.slot),
      event,
    );
  }

  function showDiceTooltip(event: SolutionTooltipTriggerEvent): void {
    showActionTooltip('Dice', '', 'try your luck', false, 'center', event);
  }

  function hideSolutionTooltip(): void {
    setSolutionTooltip(null);
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

    onActionReveal?.('dice', null);
    playSfx(DICE_SOUND);
    setDiceRollCount((count) => count + 1);
    rollRevealTimer.current = window.setTimeout(() => {
      onActionReveal?.('dice', encounter.rollE ?? null);
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
    onActionReveal?.(solution.slot, null, solution.solutionId);
    rollRevealTimer.current = window.setTimeout(() => {
      onActionReveal?.(solution.slot, roll, solution.solutionId);
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
        {'@keyframes morkahja-solution-lockpick { 0% { transform: rotate(0deg) scale(1); filter: brightness(1); } 12% { transform: rotate(-16deg) scale(1.05); filter: brightness(1.15); } 24% { transform: rotate(14deg) scale(1.03); } 36% { transform: rotate(-10deg) scale(1.06); } 48% { transform: rotate(8deg) scale(1.04); } 60% { transform: rotate(-5deg) scale(1.07); filter: brightness(1.35); } 72% { transform: rotate(3deg) scale(1.02); } 84% { transform: rotate(0deg) scale(1.1); filter: brightness(1.55); } 100% { transform: rotate(0deg) scale(1); filter: brightness(1); } }'}
        {'@keyframes morkahja-solution-enable-rattle { 0%, 100% { transform: rotate(0deg) scale(1); } 18% { transform: rotate(-3.5deg) scale(1.04); } 36% { transform: rotate(3.5deg) scale(1.03); } 54% { transform: rotate(-2.5deg) scale(1.05); } 72% { transform: rotate(2deg) scale(1.02); } 86% { transform: rotate(-1deg) scale(1.03); } }'}
        {'@keyframes morkahja-dice-roll { 0% { transform: rotate(0deg) translateY(0); } 12.5% { transform: rotate(90deg) translateY(-8px); } 25% { transform: rotate(180deg) translateY(0); } 37.5% { transform: rotate(270deg) translateY(-7px); } 50% { transform: rotate(360deg) translateY(0); } 62.5% { transform: rotate(450deg) translateY(-6px); } 75% { transform: rotate(540deg) translateY(0); } 87.5% { transform: rotate(630deg) translateY(-3px); } 100% { transform: rotate(720deg) translateY(0); } }'}
      </style>
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={FRAME_MASK}
        style={frameMaskStyle}
      />
      <div
        aria-label="Solution actions"
        style={{
          ...solutionActionsLayerStyle,
          opacity: hidden ? 0 : 1,
          pointerEvents: hidden || !actionsReady ? 'none' : 'auto',
          transition: hidden ? 'opacity 0ms' : undefined,
        }}
      >
        {solutionSlots.map((slot) => {
          if (slot === 'dice') {
            return (
            <div
              key={slot}
              style={{
                ...diceSlotStyle,
                ...diceRevealStyle(actionsVisible && !hidden),
              }}
            >
              <button
                aria-disabled={!actionsReady}
                aria-label="Roll dice"
                className="morkahja-footer-button"
                disabled={!actionsReady}
                onClick={handleDiceButtonClick}
                {...bindTooltipReveal({
                  onShow: showDiceTooltip,
                  onHide: hideSolutionTooltip,
                })}
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
                        src={DICE_BUTTON}
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
            return (
              <span
                aria-hidden="true"
                key={slot}
                style={{
                  ...solutionRevealStyle(actionsVisible && !hidden, slot === 'A' || slot === 'B' ? 'left' : 'right'),
                  width: SOLUTION_ACTION_SIZE_PX,
                  height: SOLUTION_ACTION_SIZE_PX,
                }}
              />
            );
          }

          const revealDirection: SolutionRevealDirection = slot === 'A' || slot === 'B'
            ? 'left'
            : 'right';

          return (
              <button
                aria-disabled={!actionsReady || !visibleSlot.available}
                aria-label={
                  visibleSlot.available
                    ? `Use ${visibleSlot.name} in slot ${slot}`
                    : `${visibleSlot.name} required for slot ${slot}, not available`
                }
                className={`morkahja-footer-button${
                  visibleSlot.available ? '' : ' morkahja-footer-button--unavailable'
                }`}
                disabled={!actionsReady}
                key={slot}
                {...bindTooltipReveal({
                  onShow: (event) => {
                    showSolutionTooltip(visibleSlot, event);
                  },
                  onHide: hideSolutionTooltip,
                })}
                onClick={() => {
                  handleSolutionButtonClick(visibleSlot);
                }}
                style={{
                  ...solutionButtonStyle,
                  ...solutionRevealStyle(actionsVisible && !hidden, revealDirection),
                  ...(actionsVisible && !hidden && !visibleSlot.available
                    ? { opacity: UNAVAILABLE_SOLUTION_OPACITY }
                    : {}),
                }}
                type="button"
              >
                <span
                  className="morkahja-footer-button-visual"
                  style={{
                    ...solutionIconShellStyle,
                    ...(enableRattleSlots.has(slot) ? enableRattleAnimationStyle : {}),
                    ...(activeSolutionSlot === slot ? lockpickAnimationStyle : {}),
                    ...(visibleSlot.available && visibleSlot.isPrimary ? primarySolutionGlowStyle : {}),
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
      {solutionTooltip && !hidden ? (
        <div
          role="tooltip"
          style={{
            ...solutionTooltipStyle,
            ...(solutionTooltip.unavailable ? unavailableSolutionTooltipStyle : {}),
            left: solutionTooltip.x,
            top: solutionTooltip.y,
            transform: solutionTooltipTransform(solutionTooltip.anchorX),
          }}
        >
          {solutionTooltip.unavailable ? (
            <>
              <div style={unavailableTooltipTitleStyle}>{solutionTooltip.name}</div>
              <div style={unavailableTooltipDetailStyle}>{solutionTooltip.detail}</div>
            </>
          ) : (
            <>
              <div style={solutionTooltipTitleStyle}>{solutionTooltip.name}</div>
              {solutionTooltip.description ? (
                <div style={solutionTooltipDescriptionStyle}>{solutionTooltip.description}</div>
              ) : null}
              <div>{solutionTooltip.detail}</div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default SolutionBlock;
