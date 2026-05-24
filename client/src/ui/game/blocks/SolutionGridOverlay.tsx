import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import solutionData from '../../../data/game/solutiondata.json';
import type { AvatarInventory, InventoryItem } from '../../../api/http.js';
import {
  useTooltipRevealBinding,
  type TooltipRevealHandlerProps,
} from '../../hooks/useTooltipReveal.js';
import { fadeTransition } from '../../transitions/fade.js';
import { useNavButtonPress } from '../../transitions/navButtonPress.js';

const OVERLAY_BACKGROUND = '/UI/09_GAME/spellbook_bg.webp';
const FRAME_MASK = '/UI/09_GAME/im_spacer_line.webp';
const SOLUTION_IMAGE_ROOT = '/game/solutionimages';

/** Bottom offset: tooltip sits just above the golden frame seam. */
const TOOLTIP_SEAM_BOTTOM_PX = 22;

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
  15: 'Treasure / Life / Essence',
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

const OVERLAY_Z_INDEX = 22;

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

const blockBottomSeamStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 0,
  width: '108%',
  height: 10,
  objectFit: 'cover',
  transform: 'translate(-50%, 7px)',
  zIndex: 20,
  pointerEvents: 'none',
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
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
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

const gridItemHoverVisualStyle: CSSProperties = {
  transform: 'scale(1.06) translateY(-2px)',
  filter: 'brightness(1.1) drop-shadow(0 0 14px rgba(255, 204, 102, 0.38))',
};

const gridItemHoverImageStyle: CSSProperties = {
  filter: 'brightness(1.12) drop-shadow(0 0 12px rgba(255, 204, 102, 0.42)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.55))',
};

function mergeGridItemPointerHandlers(
  itemId: number,
  tooltipHandlers: TooltipRevealHandlerProps,
  setHoveredItemId: Dispatch<SetStateAction<number | null>>,
): TooltipRevealHandlerProps {
  return {
    ...tooltipHandlers,
    onMouseOver: (event) => {
      setHoveredItemId(itemId);
      tooltipHandlers.onMouseOver?.(event);
    },
    onMouseOut: (event) => {
      setHoveredItemId((current) => (current === itemId ? null : current));
      tooltipHandlers.onMouseOut?.(event);
    },
    onFocus: (event) => {
      setHoveredItemId(itemId);
      tooltipHandlers.onFocus?.(event);
    },
    onBlur: (event) => {
      setHoveredItemId((current) => (current === itemId ? null : current));
      tooltipHandlers.onBlur?.(event);
    },
  };
}

const itemTooltipDockStyle: CSSProperties = {
  position: 'relative',
  zIndex: 24,
  flexShrink: 0,
  width: '100%',
  padding: `0 clamp(14px, 4vw, 28px) ${TOOLTIP_SEAM_BOTTOM_PX}px`,
  boxSizing: 'border-box',
  pointerEvents: 'none',
};

const itemTooltipStyle: CSSProperties = {
  width: '100%',
  maxHeight: 'min(28vh, 180px)',
  overflow: 'auto',
  padding: '10px 12px',
  border: '1px solid rgba(255, 204, 102, 0.78)',
  borderRadius: 8,
  background: 'rgba(12, 9, 8, 0.96)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.82rem',
  lineHeight: 1.35,
  textAlign: 'left',
  textShadow: '0 2px 6px rgba(0, 0, 0, 0.9)',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  boxSizing: 'border-box',
};

const tooltipTitleStyle: CSSProperties = {
  margin: '0 0 6px',
  color: '#ffcc66',
  fontSize: '0.92rem',
  fontWeight: 700,
  lineHeight: 1.2,
};

const tooltipTextStyle: CSSProperties = {
  margin: '0 0 8px',
  color: '#f7efe0',
  whiteSpace: 'pre-wrap',
};

const tooltipMetaStyle: CSSProperties = {
  margin: '4px 0 0',
  color: '#ffcc66',
};

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
        name: solution.mSolutionName,
        text: solution.mSolutionText,
        typeLabel: solutionTypeLabel(solution.mSolutionType),
        uses: item.uses,
        imageSrc: solutionImagePath(solution.mSolutionIconName),
      });
    }
  }

  return [...entriesById.values()].sort((left, right) => left.name.localeCompare(right.name));
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
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [tooltipItem, setTooltipItem] = useState<SolutionGridEntry | null>(null);
  const bindTooltipReveal = useTooltipRevealBinding(visible);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const items = useMemo(
    () => inventoryEntries(inventory, sourceContainer, inventoryType),
    [inventory, inventoryType, sourceContainer],
  );

  useEffect(() => {
    if (!visible) {
      setSelectedItemId(null);
      setHoveredItemId(null);
      setTooltipItem(null);
    }
  }, [visible]);

  useEffect(() => {
    setSelectedItemId(null);
    setHoveredItemId(null);
    setTooltipItem(null);
  }, [inventory]);

  function showItemTooltip(item: SolutionGridEntry): void {
    setSelectedItemId(item.solutionId);
    setTooltipItem(item);
  }

  function hideItemTooltip(): void {
    setTooltipItem(null);
  }

  function handleItemClick(item: SolutionGridEntry): void {
    if (selectedItemId === item.solutionId && tooltipItem !== null) {
      setSelectedItemId(null);
      hideItemTooltip();
      return;
    }

    showItemTooltip(item);
  }

  return (
    <aside
      aria-hidden={!visible}
      aria-label={ariaLabel}
      className="morkahja-solution-grid-overlay"
      inert={visible ? undefined : true}
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
            {items.map((item) => {
              const itemKey = String(item.solutionId);
              const isSelected = selectedItemId === item.solutionId;
              const isHovered = hoveredItemId === item.solutionId;
              const itemTooltipHandlers = mergeGridItemPointerHandlers(
                item.solutionId,
                bindTooltipReveal({
                  onShow: () => {
                    showItemTooltip(item);
                  },
                  onHide: hideItemTooltip,
                }),
                setHoveredItemId,
              );
              return (
                <button
                  aria-label={item.name}
                  aria-pressed={isSelected}
                  className={`morkahja-footer-button${
                    isSelected ? ' morkahja-footer-button--selected' : ''
                  }`}
                  key={item.solutionId}
                  onClick={() => {
                    handleItemClick(item);
                  }}
                  {...itemTooltipHandlers}
                  onPointerDown={(event) => {
                    pulse(itemKey);
                    itemTooltipHandlers.onPointerDown?.(event);
                  }}
                  style={itemButtonStyle}
                  type="button"
                >
                  <span
                    className="morkahja-footer-button-visual"
                    style={isHovered ? gridItemHoverVisualStyle : undefined}
                  >
                    <img
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      src={item.imageSrc}
                      style={{
                        ...itemImageStyle,
                        ...(isHovered ? gridItemHoverImageStyle : {}),
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
      {tooltipItem ? (
        <div style={itemTooltipDockStyle}>
          <div role="tooltip" style={itemTooltipStyle}>
            <p style={tooltipTitleStyle}>{tooltipItem.name}</p>
            <p style={tooltipTextStyle}>{tooltipItem.text}</p>
            <p style={tooltipMetaStyle}>Charges: {tooltipItem.uses}</p>
            <p style={tooltipMetaStyle}>Type: {tooltipItem.typeLabel}</p>
          </div>
        </div>
      ) : null}
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={FRAME_MASK}
        style={blockBottomSeamStyle}
      />
    </aside>
  );
}
