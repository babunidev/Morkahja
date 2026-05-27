import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import solutionData from '../../../data/game/solutiondata.json';
import type { AvatarInventory, InventoryItem } from '../../../api/http.js';
import {
  anchorXForGridColumn,
  anchoredTooltipCoords,
  clampAnchoredTooltipPlacement,
  tooltipTransform,
  type AnchoredTooltipCoords,
} from '../../hooks/anchoredTooltip.js';
import {
  useTooltipRevealBinding,
  type TooltipRevealCallbacks,
} from '../../hooks/useTooltipReveal.js';
import { SolutionGridTooltipPanel } from './SolutionGridTooltipPanel.js';
import { fadeTransition } from '../../transitions/fade.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';

const OVERLAY_BACKGROUND = '/UI/09_GAME/spellbook_bg.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';

const GRID_COLUMNS = 5;

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionID: number;
  mSolutionInventoryType: number;
  mSolutionName: string;
  mSolutionText: string;
  mSolutionType: number;
}

export interface SolutionGridEntry {
  solutionId: number;
  solutionType: number;
  name: string;
  text: string;
  typeLabel: string;
  uses: number;
  imageSrc: string;
}

const SOLUTION_TYPE_LABELS: Record<number, string> = {
  1: 'Learn Skill',
  2: 'Learn Item',
  3: 'Trade Skill',
  4: 'Trade Item',
  5: 'Find Skill',
  6: 'Find Item',
  7: 'Open Lock Skill',
  8: 'Unlock Item',
  9: 'Combat Skill',
  10: 'Combat Item',
  13: 'Climb Skill',
  14: 'Climb Item',
  15: 'Essence',
  16: 'Life Skill',
  17: 'Speechcraft Skill',
  18: 'Speechcraft Item',
  20: 'Travel Item',
  21: 'Heal Skill',
  22: 'Heal Item',
  25: 'Help Skill',
  26: 'Help Item',
  27: 'Purge Skill',
  28: 'Purge Item',
  29: 'Hunting Skill',
  30: 'Hunting Item',
  32: 'Rare Item',
  33: 'Nurture Skill',
  34: 'Nurture Item',
  35: 'Stealth Skill',
  36: 'Stealth Item',
  37: 'Warmth Skill',
  38: 'Warmth Item',
  39: 'Inspiration Skill',
  40: 'Inspiration Item',
  76: 'Resurrection Skill',
  77: 'Resurrection Item',
};

const solutionsById = solutionData as Record<string, SolutionRecord>;

/** Above encounter header seam (25) when inventory/skillbook panel is open. */
const OVERLAY_Z_INDEX = 26;

const overlayBlockStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: -30,
  zIndex: OVERLAY_Z_INDEX,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'rgba(10, 7, 5, 0.94)',
  backgroundImage: `url(${OVERLAY_BACKGROUND})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  overflow: 'hidden',
  transition: fadeTransition,
};

const scrollWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  flex: 1,
  minHeight: 0,
  padding: 'clamp(18px, 5vw, 30px) clamp(14px, 4vw, 28px)',
  boxSizing: 'border-box',
  overflow: 'auto',
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
};

const itemGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
  gap: 'clamp(8px, 2vw, 14px)',
  justifyItems: 'center',
};

const itemButtonStyle: CSSProperties = {
  width: '100%',
  maxWidth: 72,
  padding: 0,
  border: 0,
  background: 'transparent',
};

const itemImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.55))',
  pointerEvents: 'none',
};

const GRID_TOOLTIP_WIDTH_PX = 220;

const gridTooltipShellStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 30,
  width: GRID_TOOLTIP_WIDTH_PX,
  maxWidth: `min(${GRID_TOOLTIP_WIDTH_PX}px, calc(100% - 16px))`,
  pointerEvents: 'none',
  boxSizing: 'border-box',
};

type GridTooltipTriggerEvent = Parameters<TooltipRevealCallbacks['onShow']>[0];

interface GridTooltipState {
  anchor: AnchoredTooltipCoords;
  item: SolutionGridEntry;
}

function isRelatedTargetInside(
  container: HTMLElement,
  relatedTarget: EventTarget | null,
): boolean {
  return relatedTarget instanceof Node && container.contains(relatedTarget);
}

const emptyTextStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.95rem, 3.6vw, 1.22rem)',
  lineHeight: 1.42,
  textAlign: 'center',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.92)',
};

function solutionImagePath(iconName: string): string {
  return `${SOLUTION_IMAGE_ROOT}/${iconName}.webp`;
}

function solutionTypeLabel(type: number): string {
  return SOLUTION_TYPE_LABELS[type] ?? `Type ${type}`;
}

function inventoryEntries(
  inventory: AvatarInventory | undefined,
  container: 'spellbook' | 'items',
  inventoryType: 1 | 2,
): SolutionGridEntry[] {
  const entriesById = new Map<number, SolutionGridEntry>();
  const inventoryContainers: Array<'spellbook' | 'items' | 'essences'> = container === 'items'
    ? ['items', 'essences']
    : [container];
  const acceptedInventoryTypes = container === 'items'
    ? new Set<number>([2, 3])
    : new Set<number>([inventoryType]);

  for (const inventoryContainer of inventoryContainers) {
    const containerItems: InventoryItem[] = inventory?.[inventoryContainer] ?? [];

    for (const item of containerItems) {
      if (item.uses <= 0) {
        continue;
      }

      const solution = solutionsById[String(item.solutionId)];

      if (!solution || !acceptedInventoryTypes.has(solution.mSolutionInventoryType)) {
        continue;
      }

      entriesById.set(item.solutionId, {
        solutionId: item.solutionId,
        solutionType: solution.mSolutionType,
        name: solution.mSolutionName,
        text: solution.mSolutionText,
        typeLabel: solutionTypeLabel(solution.mSolutionType),
        uses: item.uses,
        imageSrc: solutionImagePath(solution.mSolutionIconName),
      });
    }
  }

  return [...entriesById.values()].sort((left, right) => {
    if (left.solutionType !== right.solutionType) {
      return left.solutionType - right.solutionType;
    }

    return left.name.localeCompare(right.name);
  });
}

export function SolutionGridOverlay({
  ariaLabel,
  emptyText,
  inventory,
  inventoryType,
  scrollDataAttribute,
  sourceContainer,
  visible,
}: {
  ariaLabel: string;
  emptyText: string;
  inventory: AvatarInventory | undefined;
  inventoryType: 1 | 2;
  scrollDataAttribute: string;
  sourceContainer: 'spellbook' | 'items';
  visible: boolean;
}) {
  const overlayRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const activeTriggerRef = useRef<HTMLElement | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<GridTooltipState | null>(null);
  const [tooltipPlacement, setTooltipPlacement] = useState<{ left: number; top: number } | null>(
    null,
  );
  const { bind: bindTooltipReveal, consumeLongPressActivation } = useTooltipRevealBinding(
    visible,
  );
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const items = useMemo(
    () => inventoryEntries(inventory, sourceContainer, inventoryType),
    [inventory, inventoryType, sourceContainer],
  );
  const itemSignature = useMemo(
    () => items.map((item) => `${item.solutionId}:${item.uses}`).join(','),
    [items],
  );

  useEffect(() => {
    if (!visible) {
      setSelectedItemId(null);
      setTooltip(null);
      setTooltipPlacement(null);
      activeTriggerRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    setSelectedItemId(null);
    setTooltip(null);
    setTooltipPlacement(null);
    activeTriggerRef.current = null;
  }, [itemSignature]);

  useLayoutEffect(() => {
    if (!tooltip || !overlayRef.current || !tooltipRef.current || !activeTriggerRef.current) {
      return;
    }

    const anchorX = tooltip.anchor.anchorX;
    const container = overlayRef.current;
    const trigger = activeTriggerRef.current;
    const tooltipElement = tooltipRef.current;

    function measureAndPlace(): void {
      if (!overlayRef.current || !tooltipRef.current || !activeTriggerRef.current) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltipElement.getBoundingClientRect();

      if (tooltipRect.width <= 0 || tooltipRect.height <= 0) {
        return;
      }

      setTooltipPlacement(
        clampAnchoredTooltipPlacement(
          containerRect,
          triggerRect,
          tooltipRect,
          anchorX,
        ),
      );
    }

    measureAndPlace();
    const remeasureFrame = window.requestAnimationFrame(measureAndPlace);

    return () => {
      window.cancelAnimationFrame(remeasureFrame);
    };
  }, [tooltip]);

  function showItemTooltip(
    item: SolutionGridEntry,
    columnIndex: number,
    event: GridTooltipTriggerEvent,
  ): void {
    const trigger = event.currentTarget;

    if (!(trigger instanceof HTMLElement) || !overlayRef.current) {
      return;
    }

    const anchorX = anchorXForGridColumn(columnIndex, GRID_COLUMNS);
    activeTriggerRef.current = trigger;
    setSelectedItemId(item.solutionId);
    setTooltipPlacement(null);
    setTooltip({
      item,
      anchor: anchoredTooltipCoords(overlayRef.current, trigger, anchorX),
    });
  }

  function hideItemTooltip(): void {
    activeTriggerRef.current = null;
    setTooltip(null);
    setTooltipPlacement(null);
  }

  function handleItemClick(
    item: SolutionGridEntry,
    columnIndex: number,
    event: GridTooltipTriggerEvent,
  ): void {
    if (consumeLongPressActivation()) {
      return;
    }

    if (selectedItemId === item.solutionId && tooltip !== null) {
      setSelectedItemId(null);
      hideItemTooltip();
      return;
    }

    showItemTooltip(item, columnIndex, event);
  }

  return (
    <aside
      aria-hidden={!visible}
      aria-label={ariaLabel}
      className="morkahja-solution-grid-overlay"
      inert={visible ? undefined : true}
      ref={overlayRef}
      style={{
        ...overlayBlockStyle,
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: visible ? OVERLAY_Z_INDEX : 0,
      }}
    >
      <style>
        {`[data-${scrollDataAttribute}]::-webkit-scrollbar { display: none; }`}
      </style>
      <div
        {...{ [`data-${scrollDataAttribute}`]: '' }}
        style={{
          ...scrollWrapStyle,
          pointerEvents: visible ? 'auto' : 'none',
        }}
      >
        {items.length > 0 ? (
          <div style={itemGridStyle}>
            {items.map((item, itemIndex) => {
              const itemKey = String(item.solutionId);
              const columnIndex = itemIndex % GRID_COLUMNS;
              const isSelected = selectedItemId === item.solutionId;
              const touchTooltipHandlers = bindTooltipReveal({
                onShow: (event) => {
                  showItemTooltip(item, columnIndex, event);
                },
                onHide: hideItemTooltip,
              });
              return (
                <button
                  aria-label={item.name}
                  aria-pressed={isSelected}
                  className={`morkahja-grid-item-button${
                    isSelected ? ' morkahja-grid-item-button--selected' : ''
                  }`}
                  data-grid-item-id={item.solutionId}
                  key={item.solutionId}
                  onBlur={hideItemTooltip}
                  onClick={(event) => {
                    handleItemClick(item, columnIndex, event);
                  }}
                  onFocus={(event) => {
                    showItemTooltip(item, columnIndex, event);
                  }}
                  onMouseEnter={(event) => {
                    showItemTooltip(item, columnIndex, event);
                  }}
                  onMouseLeave={(event) => {
                    if (isRelatedTargetInside(event.currentTarget, event.relatedTarget)) {
                      return;
                    }

                    hideItemTooltip();
                  }}
                  onPointerDown={(event) => {
                    pulse(itemKey);
                    touchTooltipHandlers.onPointerDown?.(event);
                  }}
                  onPointerUp={touchTooltipHandlers.onPointerUp}
                  onPointerCancel={touchTooltipHandlers.onPointerCancel}
                  onPointerLeave={touchTooltipHandlers.onPointerLeave}
                  style={itemButtonStyle}
                  type="button"
                >
                  <span className="morkahja-grid-item-button-visual">
                    <img
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      src={item.imageSrc}
                      style={{
                        ...itemImageStyle,
                        animation: pressAnimation(isPressed(itemKey)),
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p style={emptyTextStyle}>{emptyText}</p>
        )}
      </div>
      {tooltip ? (
        <div
          aria-live="polite"
          ref={tooltipRef}
          role="tooltip"
          style={{
            ...gridTooltipShellStyle,
            left: tooltipPlacement?.left ?? tooltip.anchor.x,
            top: tooltipPlacement?.top ?? tooltip.anchor.y,
            transform: tooltipPlacement
              ? 'none'
              : tooltipTransform(tooltip.anchor.anchorX),
          }}
        >
          <SolutionGridTooltipPanel item={tooltip.item} />
        </div>
      ) : null}
    </aside>
  );
}
