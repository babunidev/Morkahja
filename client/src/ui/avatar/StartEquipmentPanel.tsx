import type { CSSProperties } from 'react';
import type { PersistedAvatar } from '../../api/http.js';
import { gameSolutions } from '../../data/gameContent.js';
import { TooltipDivider, gameTooltipFrameStyle } from '../game/GameTooltip.js';
import { AcceptButton } from '../common/WordButton.js';
import DecorativeEdgeFrame from '../game/blocks/DecorativeEdgeFrame.js';
import { PANEL_SIDE_PADDING } from '../game/blocks/decorativeFrameShared.js';
import { GAME_PANEL_BACKGROUND } from '../game/blocks/gamePanelBackground.js';
import { EquipmentSection } from './AvatarPartyDetailsCard.js';
import { nextEmptyEquipSlot, shownEquipmentSlots } from './equipmentSlots.js';

/**
 * Starting equipment (Babuni, 2026-11-26): after a new avatar's
 * specialization, a small frame shows the two equipment slots with a short
 * explanation and the "?" before anything is chosen. Tapping a free slot opens
 * the inventory for it; the player comes back here and goes on with Continue.
 */

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 30,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  boxSizing: 'border-box',
  background: 'rgba(8, 4, 2, 0.72)',
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 400px)',
  boxSizing: 'border-box',
  display: 'grid',
  gap: 12,
  padding: 'clamp(26px, 6vw, 34px) 0 clamp(18px, 4vw, 26px)',
  background: GAME_PANEL_BACKGROUND,
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
};

const bodyStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  padding: `0 ${PANEL_SIDE_PADDING}`,
  textAlign: 'center',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1rem, 4vw, 1.25rem)',
  letterSpacing: '0.05em',
  color: '#ffcc66',
};

const textStyle: CSSProperties = {
  margin: 0,
  maxWidth: 340,
  fontSize: 'clamp(0.82rem, 3.4vw, 0.95rem)',
  lineHeight: 1.45,
};

const noteStyle: CSSProperties = {
  margin: 0,
  fontSize: gameTooltipFrameStyle.fontSize,
  color: '#ffcc66',
  opacity: 0.85,
};

const errorStyle: CSSProperties = {
  ...noteStyle,
  color: '#ff9a7a',
  opacity: 1,
};

const slotsStyle: CSSProperties = {
  // Room below the slots for the hovering "Free slot" tag.
  paddingBottom: 6,
  width: 'min(100%, 300px)',
};

const footerStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'flex-end',
  padding: `0 calc(${PANEL_SIDE_PADDING} + 14px)`,
};

export default function StartEquipmentPanel({
  avatar,
  pending,
  error,
  onEquipSlot,
  onContinue,
}: {
  avatar: PersistedAvatar;
  pending: boolean;
  error: string | null;
  /** A free slot was tapped: open the inventory for it. */
  onEquipSlot: (slot: number) => void;
  onContinue: () => void;
}) {
  const solutions = gameSolutions() as Record<string, { mSolutionInventoryType: number; mSolutionType: number } | undefined>;
  const freeSlot = nextEmptyEquipSlot(avatar.inventory, solutions);
  const filled = shownEquipmentSlots(avatar.inventory).filter((id) => id !== null).length;
  const note = freeSlot !== null
    ? 'Tap the free slot to choose an item.'
    : filled > 0
      ? 'Ready. You can change this later on your avatar card.'
      : 'No item to equip yet. You find items on the way.';
  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) {
          onContinue();
        }
      }}
      style={overlayStyle}
    >
      <section aria-label="Choose your starting equipment" role="dialog" style={panelStyle}>
        <DecorativeEdgeFrame regionLabel="Equipment" zIndex={2} />
        <div style={bodyStyle}>
          <p style={titleStyle}>Choose your starting equipment</p>
          <TooltipDivider />
          <p style={textStyle}>
            Your avatar has two equipment slots. Put an item from your inventory in each.
            An equipped item gets one extra charge, and the game uses it first.
          </p>
          <div style={slotsStyle}>
            <EquipmentSection
              freeSlotIndex={freeSlot}
              interactive={!pending}
              inventory={avatar.inventory}
              onEquipSlot={pending ? undefined : onEquipSlot}
              tooltipBoundsSelector="body"
            />
          </div>
          {error ? <p role="alert" style={errorStyle}>{error}</p> : <p aria-live="polite" style={noteStyle}>{note}</p>}
        </div>
        <div style={footerStyle}>
          <AcceptButton
            ariaLabel="Continue to the avatar card"
            disabled={pending}
            onClick={onContinue}
            pressKey="start-equipment-continue"
            word="Continue"
          />
        </div>
      </section>
    </div>
  );
}
