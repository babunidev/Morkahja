import type { CSSProperties } from 'react';

import { EQUIPMENT_SLOT_COUNT, normalizeEquipmentSlots } from '@shared/equipment.js';
import type { AvatarInventory } from '../../api/http.js';
import { gameSolutions } from '../../data/gameContent.js';
import { SolutionImage } from '../common/SolutionFrame.js';
import { GameTooltipFrame, TooltipDivider } from '../game/GameTooltip.js';
import { solutionImagePath } from '../game/blocks/SolutionGridOverlay.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

/**
 * The avatar's two equipment slots (D-056). Tapping a slot opens the inventory
 * to choose the item for it. The same card shows in the game and in the
 * avatar selection.
 */

interface SolutionRecord {
  mSolutionIconName: string;
  mSolutionName: string;
}

const SLOT_SIZE_PX = 72;

const cardStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  width: 'min(78vw, 260px)',
  padding: '14px 16px 12px',
  boxSizing: 'border-box',
  textAlign: 'center',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
};

const titleStyle: CSSProperties = {
  position: 'relative',
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1rem, 3.8vw, 1.2rem)',
  letterSpacing: '0.05em',
  color: '#ffcc66',
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
};

const slotsRowStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: `repeat(${EQUIPMENT_SLOT_COUNT}, minmax(0, 1fr))`,
  gap: 12,
  width: '100%',
  marginTop: 4,
};

const slotButtonStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

const slotPictureStyle: CSSProperties = {
  display: 'block',
  width: SLOT_SIZE_PX,
  height: SLOT_SIZE_PX,
};

const emptySlotStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: SLOT_SIZE_PX,
  height: SLOT_SIZE_PX,
  borderRadius: '50%',
  boxSizing: 'border-box',
  border: '2px dashed rgba(255, 204, 102, 0.55)',
  background: 'rgba(51, 0, 0, 0.55)',
  color: '#ffcc66',
  fontSize: '1.6rem',
  lineHeight: 1,
};

const slotNameStyle: CSSProperties = {
  minHeight: '2.3em',
  fontSize: '0.72rem',
  lineHeight: 1.15,
  color: '#f7efe0',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
};

const noteStyle: CSSProperties = {
  position: 'relative',
  margin: 0,
  fontSize: '0.68rem',
  lineHeight: 1.3,
  color: 'rgba(247, 239, 224, 0.82)',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
};

const errorStyle: CSSProperties = {
  ...noteStyle,
  color: '#ff9a7a',
};

function solutionRecord(solutionId: number): SolutionRecord | undefined {
  return (gameSolutions() as Record<string, SolutionRecord>)[String(solutionId)];
}

function chargesOf(inventory: AvatarInventory | undefined, solutionId: number): number {
  return [...(inventory?.items ?? []), ...(inventory?.essences ?? [])]
    .filter((item) => item.solutionId === solutionId)
    .reduce((sum, item) => sum + Math.max(0, item.uses), 0);
}

/** The slots as shown: an item with no charge left has broken and leaves its slot empty. */
export function shownEquipmentSlots(inventory: AvatarInventory | undefined): (number | null)[] {
  return normalizeEquipmentSlots(inventory?.equipped).map((id) =>
    id !== null && chargesOf(inventory, id) > 0 ? id : null,
  );
}

export function EquipmentCard({
  inventory,
  disabledReason = null,
  error = null,
  framed = false,
  pending = false,
  width,
  onSlotSelect,
}: {
  inventory: AvatarInventory | undefined;
  /** Shown instead of the hint while the slots cannot change (still choosing). */
  disabledReason?: string | null;
  error?: string | null;
  /** Draw its own frame; the game's popover frames it otherwise. */
  framed?: boolean;
  pending?: boolean;
  /** Card width; the default suits the game screen. */
  width?: CSSProperties['width'];
  onSlotSelect: (slot: number) => void;
}) {
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const slots = shownEquipmentSlots(inventory);
  const locked = disabledReason !== null || pending;

  return (
    <div aria-label="Equipment" role="group" style={width ? { ...cardStyle, width } : cardStyle}>
      {framed ? <GameTooltipFrame background="rgba(12, 8, 6, 0.92)" /> : null}
      <p style={titleStyle}>Equipment</p>
      <TooltipDivider />
      <div style={slotsRowStyle}>
        {slots.map((solutionId, slot) => {
          const record = solutionId !== null ? solutionRecord(solutionId) : undefined;
          const pressKey = `equipment-slot-${slot}`;
          const name = record?.mSolutionName ?? 'Empty';
          return (
            <button
              aria-label={record ? `Slot ${slot + 1}: ${name}. Choose another item` : `Slot ${slot + 1}: empty. Choose an item`}
              disabled={locked}
              key={slot}
              onClick={() => {
                playSfx(DEFAULT_BUTTON_SOUND);
                onSlotSelect(slot);
              }}
              onPointerDown={() => {
                if (!locked) {
                  pulse(pressKey);
                }
              }}
              style={{
                ...slotButtonStyle,
                cursor: locked ? 'default' : 'pointer',
                opacity: locked ? 0.6 : 1,
              }}
              type="button"
            >
              <span style={{ display: 'block', animation: pressAnimation(isPressed(pressKey)) }}>
                {record && solutionId !== null ? (
                  <SolutionImage
                    alt=""
                    aria-hidden="true"
                    charges={chargesOf(inventory, solutionId)}
                    draggable={false}
                    src={solutionImagePath(record.mSolutionIconName)}
                    style={slotPictureStyle}
                  />
                ) : (
                  <span aria-hidden="true" style={emptySlotStyle}>+</span>
                )}
              </span>
              <span style={slotNameStyle}>{name}</span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" style={errorStyle}>{error}</p>
      ) : (
        <p style={noteStyle}>
          {disabledReason ?? (pending ? 'Equipping…' : 'A roll of 12 gives the charge back, 20 gives two.')}
        </p>
      )}
    </div>
  );
}

export default EquipmentCard;
