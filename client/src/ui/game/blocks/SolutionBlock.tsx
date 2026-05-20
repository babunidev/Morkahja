import { useEffect, useRef, useState, type CSSProperties } from 'react';
import solutionData from '../../../data/game/solutiondata.json';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterSnapshot,
  InventoryItem,
} from '../../../api/http.js';
import { DICE_SOUND, playSfx, SOLUTION_SOUND } from '../../sfx.js';
import { fadeTransition } from '../../transitions/fade.js';

const FRAME_MASK = '/UI/09_GAME/im_spacer_line.webp';
const DICE_BUTTON = '/UI/09_GAME/im_button_dice_a.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';

type SlotLetter = 'A' | 'B' | 'C' | 'D';

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionName: string;
  mSolutionType: number;
}

interface VisibleSolutionSlot {
  imageSrc: string;
  isPrimary: boolean;
  name: string;
  solutionId: number;
  slot: SlotLetter;
  uses: number;
}

interface SolutionTooltipState {
  text: string;
  x: number;
  y: number;
}

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
  transform: 'translateX(-50%)',
  zIndex: 20,
  overflow: 'visible',
  transition: fadeTransition,
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

const solutionSlotsStyle: CSSProperties = {
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
  display: 'block',
  width: SOLUTION_ACTION_SIZE_PX,
  height: SOLUTION_ACTION_SIZE_PX,
  borderRadius: '50%',
  overflow: 'hidden',
  cursor: 'pointer',
};

const primarySolutionGlowStyle: CSSProperties = {
  boxShadow: '0 0 16px rgba(255, 204, 102, 0.72), 0 0 24px rgba(255, 204, 102, 0.38)',
};

const diceButtonStyle: CSSProperties = {
  width: SOLUTION_ACTION_SIZE_PX,
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  transition: fadeTransition,
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
  transition: 'transform 1500ms cubic-bezier(0.2, 0.8, 0.2, 1)',
};

const solutionTooltipStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 50,
  maxWidth: 180,
  padding: '7px 10px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.94)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.78rem',
  lineHeight: 1.25,
  textAlign: 'center',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  pointerEvents: 'none',
  transform: 'translate(-50%, calc(-100% - 12px))',
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

function solutionForSlot(
  encounter: EncounterSnapshot,
  inventory: AvatarInventory | undefined,
  slot: SlotLetter,
): VisibleSolutionSlot | null {
  const items = inventoryItems(inventory);
  const primaryId = primaryRequirement(encounter, slot);
  const secondaryType = secondaryRequirement(encounter, slot);
  const primaryMatch = primaryId > 0
    ? items.find((item) => item.solutionId === primaryId)
    : undefined;
  const secondaryMatch = secondaryType > 0
    ? items
        .filter((item) => item.solutionType === secondaryType)
        .sort((a, b) => a.solutionId - b.solutionId)[0]
    : undefined;
  const matchedItem = primaryMatch ?? secondaryMatch;

  if (!matchedItem) {
    return null;
  }

  const solution = solutionsById[String(matchedItem.solutionId)];

  if (!solution) {
    return null;
  }

  return {
    imageSrc: solutionImagePath(solution),
    isPrimary: matchedItem.solutionId === primaryMatch?.solutionId,
    name: solution.mSolutionName,
    solutionId: matchedItem.solutionId,
    slot,
    uses: matchedItem.uses,
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
  hidden = false,
  onActionReveal,
  encounter,
  inventory,
}: {
  hidden?: boolean;
  onActionReveal?: (
    action: EncounterAction,
    roll: number | null,
    solutionId?: number,
  ) => void;
  encounter: EncounterSnapshot;
  inventory: AvatarInventory | undefined;
}) {
  const [diceRollCount, setDiceRollCount] = useState(0);
  const [solutionTooltip, setSolutionTooltip] = useState<SolutionTooltipState | null>(null);
  const [activeSolutionSlot, setActiveSolutionSlot] = useState<SlotLetter | null>(null);
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

  function showSolutionTooltip(
    solution: VisibleSolutionSlot,
    event: { currentTarget: HTMLButtonElement },
  ): void {
    const blockRect = blockRef.current?.getBoundingClientRect();
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const x = blockRect
      ? buttonRect.left - blockRect.left + buttonRect.width / 2
      : buttonRect.width / 2;
    const y = blockRect
      ? buttonRect.top - blockRect.top
      : 0;

    setSolutionTooltip({
      text: `${solution.name}\nCharges: ${solution.uses}`,
      x,
      y,
    });
  }

  function hideSolutionTooltip(): void {
    setSolutionTooltip(null);
  }

  function handleDiceClick(): void {
    clearRollRevealTimer();

    onActionReveal?.('dice', null);
    playSfx(DICE_SOUND);
    setDiceRollCount((count) => count + 1);
    rollRevealTimer.current = window.setTimeout(() => {
      onActionReveal?.('dice', encounter.rollE ?? null);
      rollRevealTimer.current = null;
    }, 1500);
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
    }, 1500);
  }

  return (
    <div
      ref={blockRef}
      style={{
        ...solutionBlockStyle,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <style>
        {'@keyframes morkahja-solution-lockpick { 0% { transform: rotate(0deg) scale(1); filter: brightness(1); } 12% { transform: rotate(-16deg) scale(1.05); filter: brightness(1.15); } 24% { transform: rotate(14deg) scale(1.03); } 36% { transform: rotate(-10deg) scale(1.06); } 48% { transform: rotate(8deg) scale(1.04); } 60% { transform: rotate(-5deg) scale(1.07); filter: brightness(1.35); } 72% { transform: rotate(3deg) scale(1.02); } 84% { transform: rotate(0deg) scale(1.1); filter: brightness(1.55); } 100% { transform: rotate(0deg) scale(1); filter: brightness(1); } }'}
      </style>
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={FRAME_MASK}
        style={frameMaskStyle}
      />
      <div aria-label="Solution actions" style={solutionSlotsStyle}>
        {solutionSlots.map((slot) => {
          if (slot === 'dice') {
            return (
            <div key={slot} style={diceSlotStyle}>
              <button
                aria-label="Roll dice"
                onClick={handleDiceClick}
                style={{
                  ...diceButtonStyle,
                }}
                type="button"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  src={DICE_BUTTON}
                  style={{
                    ...diceImageStyle,
                    transform: `rotate(${diceRollCount * 720}deg)`,
                  }}
                />
              </button>
            </div>
            );
          }

          const visibleSlot = visibleSlots[slot];

          return visibleSlot ? (
              <button
                aria-label={`Use ${visibleSlot.name} in slot ${slot}`}
                key={slot}
                onBlur={hideSolutionTooltip}
                onFocus={(event) => {
                  showSolutionTooltip(visibleSlot, event);
                }}
                onPointerCancel={hideSolutionTooltip}
                onPointerEnter={(event) => {
                  showSolutionTooltip(visibleSlot, event);
                }}
                onPointerLeave={hideSolutionTooltip}
                onClick={() => {
                  handleSolutionClick(visibleSlot);
                }}
                style={solutionButtonStyle}
                type="button"
              >
                <span
                  style={{
                    ...solutionIconShellStyle,
                    ...(activeSolutionSlot === slot ? lockpickAnimationStyle : {}),
                    ...(visibleSlot.isPrimary ? primarySolutionGlowStyle : {}),
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
            ) : <span aria-hidden="true" key={slot} />;
        })}
      </div>
      {solutionTooltip ? (
        <div
          role="tooltip"
          style={{
            ...solutionTooltipStyle,
            left: solutionTooltip.x,
            top: solutionTooltip.y,
            whiteSpace: 'pre-line',
          }}
        >
          {solutionTooltip.text}
        </div>
      ) : null}
    </div>
  );
}

export default SolutionBlock;
