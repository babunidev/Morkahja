import type { CSSProperties, ReactNode } from 'react';
import type { AvatarInventoryDto } from '@shared/contracts';
import { shownEquipmentSlots } from './equipmentSlots.js';
import HelpTip from '../common/HelpTip.js';
import { SolutionImage } from '../common/SolutionFrame.js';
import { solutionGridEntryFor } from '../game/blocks/SolutionGridOverlay.js';
import { SolutionGridTooltipBody } from '../game/blocks/SolutionGridTooltipPanel.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { readAvatarDisplayTitle } from './avatarDisplayName.js';
import { simpleFrameClipPath, simpleFrameStyle } from '../common/simpleFrame.js';
import {
  GAME_SCREEN_SELECTOR,
  TooltipDivider,
  useGameTooltip,
} from '../game/GameTooltip.js';

export type AvatarDetailsSlotSide = 'left' | 'center' | 'right';

const cardStyle: CSSProperties = {
  // Shown in a framed AnchoredGamePopover, which gives it its frame and background.
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  pointerEvents: 'none',
  textAlign: 'center',
  boxSizing: 'border-box',
};

const nameBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  width: '100%',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(0.95rem, 3.6vw, 1.2rem)',
  lineHeight: 1.15,
  letterSpacing: '0.05em',
  color: '#ffcc66',
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
};

const avatarNameStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(1.08rem, 4.2vw, 1.34rem)',
  lineHeight: 1.12,
  fontWeight: 600,
  color: '#f7efe0',
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
};

const soloNameStyle: CSSProperties = {
  ...avatarNameStyle,
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const levelStyle: CSSProperties = {
  margin: '5px 0 0',
  fontSize: '0.68rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.86,
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.85)',
};

const xpBarShellStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 10,
  marginTop: 5,
  boxSizing: 'border-box',
  padding: 2,
  ...simpleFrameStyle({ background: 'rgba(20, 8, 4, 0.72)', opacity: 0.95, scale: 0.4 }),
  overflow: 'hidden',
};

const xpBarFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  clipPath: simpleFrameClipPath(1, 1.5),
  background: 'linear-gradient(90deg, #7e1d12 0%, #ffcc66 100%)',
  boxShadow: '0 0 8px rgba(255, 204, 102, 0.7)',
};

const xpTextStyle: CSSProperties = {
  marginTop: 3,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.62rem',
  lineHeight: 1,
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
};

const statusBadgeStyle: CSSProperties = {
  marginTop: 6,
  padding: '3px 8px',
  ...simpleFrameStyle({ background: 'rgba(24, 14, 8, 0.92)', opacity: 0.59, scale: 0.6 }),
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.62rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const footerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  marginTop: 8,
  pointerEvents: 'auto',
};

const sectionHeadingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.72rem, 2.8vw, 0.84rem)',
  fontWeight: 700,
};

/**
 * The same size as a solution in the encounter and a picture in the Inventory
 * (Babuni, 2026-11-23): a fifth of the row, with the Inventory grid's gap.
 * The row is a size container.
 */
const SLOT_GAP = 'clamp(2px, 0.5vw, 4px)';
const SLOT_SIZE = `calc((100cqi - 4 * ${SLOT_GAP}) / 5)`;

const slotsRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: SLOT_GAP,
  marginTop: 6,
  width: '100%',
  containerType: 'inline-size',
};

const slotStyle: CSSProperties = {
  display: 'block',
  width: SLOT_SIZE,
  height: SLOT_SIZE,
  padding: 0,
  border: 0,
  background: 'transparent',
  pointerEvents: 'auto',
};

const slotPictureStyle: CSSProperties = {
  display: 'block',
  width: SLOT_SIZE,
  height: SLOT_SIZE,
};

const emptySlotVisualStyle: CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: SLOT_SIZE,
  height: SLOT_SIZE,
  borderRadius: '50%',
  boxSizing: 'border-box',
  border: '2px dashed rgba(255, 204, 102, 0.6)',
  background: 'rgba(51, 0, 0, 0.6)',
  color: '#ffcc66',
  fontSize: '1.6rem',
  lineHeight: 1,
};

/** What equipment does and when it can change (D-056), for the "?" next to Equipment. */
export const EQUIPMENT_HELP_TEXT =
  'Tap an empty slot to equip an item, at any time. It gets one extra charge, and the game uses it first. '
  + 'Use it with a roll of 12 or more and you get the charge back; 20 or more gives two. '
  + 'Hardship and Misery cannot take it. It stays in its slot until its last charge is spent; then the slot is free again.';

function chargesOf(inventory: AvatarInventoryDto | undefined, solutionId: number): number {
  return [...(inventory?.items ?? []), ...(inventory?.essences ?? [])]
    .filter((item) => item.solutionId === solutionId)
    .reduce((sum, item) => sum + Math.max(0, item.uses), 0);
}

/** A full slot: the item, with its tooltip on hover or a long press; a tap does nothing. */
function FilledEquipmentSlot({
  solutionId,
  charges,
  bindTooltip,
}: {
  solutionId: number;
  charges: number;
  bindTooltip: ReturnType<typeof useGameTooltip>['bindTooltip'];
}) {
  const entry = solutionGridEntryFor(solutionId, charges);
  const handlers = bindTooltip(() => (entry
    ? { key: `equipped-${solutionId}-${charges}`, shellStyle: { width: 200, maxWidth: 200 }, body: <SolutionGridTooltipBody item={entry} /> }
    : null));
  return (
    <span
      aria-label={entry ? `${entry.name}, ${charges} charges` : 'Equipped item'}
      role="img"
      style={slotStyle}
      tabIndex={0}
      {...handlers}
    >
      {entry ? (
        <SolutionImage
          alt=""
          aria-hidden="true"
          charges={charges}
          draggable={false}
          src={entry.imageSrc}
          style={slotPictureStyle}
        />
      ) : null}
    </span>
  );
}

export function EquipmentSection({
  inventory,
  interactive,
  tooltipBoundsSelector,
  onEquipSlot,
}: {
  inventory: AvatarInventoryDto | undefined;
  interactive: boolean;
  tooltipBoundsSelector: string;
  /** An empty slot was tapped: choose an item for it. */
  onEquipSlot?: (slot: number) => void;
}) {
  const itemTips = useGameTooltip({ boundsSelector: tooltipBoundsSelector });
  const slots = shownEquipmentSlots(inventory);
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {itemTips.layer}
      <div style={{ ...sectionHeadingRowStyle, position: 'relative' }}>
        <p style={sectionHeadingStyle}>Equipment</p>
        <HelpTip disabled={!interactive} label="What is equipment?" text={EQUIPMENT_HELP_TEXT} />
      </div>
      <div style={slotsRowStyle}>
        {slots.map((solutionId, slot) => (solutionId !== null ? (
          <FilledEquipmentSlot
            bindTooltip={itemTips.bindTooltip}
            charges={chargesOf(inventory, solutionId)}
            key={slot}
            solutionId={solutionId}
          />
        ) : (
          <button
            aria-label={`Equipment slot ${slot + 1}: empty. Choose an item`}
            disabled={!interactive || !onEquipSlot}
            key={slot}
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onEquipSlot?.(slot);
            }}
            style={{ ...slotStyle, cursor: interactive && onEquipSlot ? 'pointer' : 'default' }}
            type="button"
          >
            <span aria-hidden="true" style={emptySlotVisualStyle}>+</span>
          </button>
        )))}
      </div>
    </div>
  );
}

export function experienceRequiredForNextLevel(level: number): number {
  return 7 * 2 ** (Math.max(1, level) - 1);
}


export function AvatarPartyDetailsCard({
  avatar,
  statusLabel,
  statusInactive = false,
  footer,
  equipment,
  interactive = true,
  tooltipBoundsSelector = GAME_SCREEN_SELECTOR,
  onEquipSlot,
  choiceDetails,
}: {
  avatar: {
    name: string;
    displayTitle?: string | null;
    profile?: { displayTitle?: unknown };
    race: string;
    role: string;
    level: number;
    experience: number;
  };
  inventory?: AvatarInventoryDto;
  inventorySeed: string;
  statusLabel?: string;
  statusInactive?: boolean;
  footer?: ReactNode;
  slotSide?: AvatarDetailsSlotSide;
  /** Shows the Equipment section with these slots (D-056). */
  equipment?: AvatarInventoryDto;
  /** The equipment slots and the "?" can be used (the local avatar's own card). */
  interactive?: boolean;
  /** Where the equipped items' tooltips may go. */
  tooltipBoundsSelector?: string;
  /** An empty equipment slot was tapped. */
  onEquipSlot?: (slot: number) => void;
  /** What was used and rolled in this encounter, below the equipment. */
  choiceDetails?: ReactNode;
}) {
  const nextLevelExperience = experienceRequiredForNextLevel(avatar.level);
  const currentExperience = Math.max(0, Math.min(avatar.experience, nextLevelExperience));
  const experiencePercent = nextLevelExperience > 0
    ? (currentExperience / nextLevelExperience) * 100
    : 0;

  const displayTitle = readAvatarDisplayTitle(avatar);
  const baseName = avatar.name.trim() || 'Adventurer';

  return (
    <div role="dialog" aria-label={`${avatar.name} details`} style={cardStyle}>
      <div style={nameBlockStyle}>
        {displayTitle ? (
          <span style={titleStyle}>{displayTitle}</span>
        ) : null}
        <span style={displayTitle ? avatarNameStyle : soloNameStyle}>{baseName}</span>
      </div>
      <TooltipDivider />
      <span style={levelStyle}>
        Level {avatar.level} · {avatar.race} {avatar.role}
      </span>
      <span aria-label={`Experience ${currentExperience} of ${nextLevelExperience}`} style={xpBarShellStyle}>
        <span
          style={{
            ...xpBarFillStyle,
            width: `${experiencePercent}%`,
          }}
        />
      </span>
      <span style={xpTextStyle}>
        XP {currentExperience}/{nextLevelExperience}
      </span>
      {equipment !== undefined ? (
        <>
          <TooltipDivider />
          <EquipmentSection
            interactive={interactive}
            inventory={equipment}
            onEquipSlot={onEquipSlot}
            tooltipBoundsSelector={tooltipBoundsSelector}
          />
        </>
      ) : null}
      {choiceDetails}
      {statusLabel ? (
        <span
          className={statusInactive ? 'morkahja-party-status-badge-inactive' : undefined}
          style={statusBadgeStyle}
        >
          {statusLabel}
        </span>
      ) : null}
      {footer ? (
        <div style={footerRowStyle}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default AvatarPartyDetailsCard;
