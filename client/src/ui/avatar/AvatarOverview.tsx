import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

import type { AvatarInventory, PersistedAvatar } from '../../api/http.js';
import { assetUrl } from '../../assetUrl.js';
import { TooltipDivider, gameTooltipFrameStyle } from '../game/GameTooltip.js';
import HelpTip from '../common/HelpTip.js';
import PanelButton from '../common/PanelButton.js';
import GemCost from '../common/GemCost.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { findSpecialization, specializationChangeCost } from '@shared/specialization.js';
import AvatarCard from './AvatarCard.js';
import { EquipmentSection, experienceRequiredForNextLevel } from './AvatarPartyDetailsCard.js';
import { readAvatarDisplayTitle } from './avatarDisplayName.js';
import { simpleFrameClipPath, simpleFrameStyle } from '../common/simpleFrame.js';
import DecorativeEdgeFrame from '../game/blocks/DecorativeEdgeFrame.js';
import { PANEL_SIDE_PADDING, panelEdgeDividerBleed } from '../game/blocks/decorativeFrameShared.js';
import { GAME_PANEL_BACKGROUND } from '../game/blocks/gamePanelBackground.js';

/**
 * The avatar's overview (Babuni, 2026-11-23): everything about the avatar in
 * one big card, the same in the main menu and in the game. Who it is, its
 * experience, a few statistics, the two equipment slots and the
 * specialization. Red goes back; green enters the world (menu) or
 * Home leaves it (game).
 */

const UI_ROOT = assetUrl('/UI/02_AvatarCreation');
export const OVERVIEW_BACK_ASSET = `${UI_ROOT}/im_button_delete.webp`;
export const OVERVIEW_ENTER_ASSET = `${UI_ROOT}/im_button_yes.webp`;
/** The Play button enters the world from the avatar card (Babuni, 2026-11-23). */
export const OVERVIEW_PLAY_ASSET = assetUrl('/UI/03_DASHBOARD/im_button_play.webp');

/** No text is smaller than the item and skill tooltips' (Babuni, 2026-11-23). */
const TOOLTIP_TEXT_SIZE = gameTooltipFrameStyle.fontSize;

/** Inside the panel's own side padding. */
const CONTENT_SIDE_PADDING = 14;
const DIVIDER_BLEED = panelEdgeDividerBleed(CONTENT_SIDE_PADDING);

const contentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  padding: `0 ${CONTENT_SIDE_PADDING}px`,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
};

const portraitStyle: CSSProperties = {
  flexShrink: 0,
  width: 'clamp(96px, 30%, 150px)',
};

/**
 * The main menu's head (Babuni, 2026-11-23): the portrait on the left at its
 * size, and the title, name line and experience beside it, so they share the
 * space up there.
 */
const headStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'clamp(12px, 3vw, 20px)',
  width: '100%',
};

const headTextStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 6,
  flex: 1,
  minWidth: 0,
  textAlign: 'left',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(0.9rem, 3.4vw, 1.1rem)',
  letterSpacing: '0.05em',
  color: '#ffcc66',
};

/** The name, big, above the level (Babuni, 2026-11-24); the plate says "Avatar". */
const nameStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(1.2rem, 4.6vw, 1.55rem)',
  letterSpacing: '0.04em',
  lineHeight: 1.1,
  color: '#ffcc66',
  overflowWrap: 'anywhere',
};

/** The frame's plate on the avatar card, in the menu and in the game. */
export const AVATAR_CARD_PLATE = 'Avatar';

const metaStyle: CSSProperties = {
  margin: 0,
  fontSize: TOOLTIP_TEXT_SIZE,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  opacity: 0.9,
};

const xpShellStyle: CSSProperties = {
  display: 'block',
  width: 'min(100%, 320px)',
  height: 12,
  boxSizing: 'border-box',
  padding: 2,
  ...simpleFrameStyle({ background: 'rgba(20, 8, 4, 0.72)', opacity: 0.95, scale: 0.4 }),
  overflow: 'hidden',
};

const xpFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  clipPath: simpleFrameClipPath(1, 1.5),
  background: 'linear-gradient(90deg, #7e1d12 0%, #ffcc66 100%)',
  boxShadow: '0 0 8px rgba(255, 204, 102, 0.7)',
};

const xpTextStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: TOOLTIP_TEXT_SIZE,
};

const sectionHeadingStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: 'clamp(0.78rem, 3vw, 0.9rem)',
  fontWeight: 700,
};

const statsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 6,
  width: '100%',
  marginTop: 4,
};

const statStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  fontSize: TOOLTIP_TEXT_SIZE,
  lineHeight: 1.2,
  opacity: 0.92,
};

const statValueStyle: CSSProperties = {
  color: '#ffcc66',
  fontSize: '1rem',
  fontWeight: 700,
};

const specializationNameStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(0.9rem, 3.4vw, 1.05rem)',
  letterSpacing: '0.05em',
  color: '#ffcc66',
};

const specializationNoteStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  margin: 0,
  fontSize: TOOLTIP_TEXT_SIZE,
};

/**
 * The menu's specialization row (Babuni, 2026-11-24): the heading, the chosen
 * one and its button on the left, its description on the right.
 */
const specializationSectionStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  alignItems: 'center',
  gap: 'clamp(12px, 3vw, 20px)',
  width: '100%',
  padding: '2px 0 4px',
};

const specializationControlsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
};

const specializationDescriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: TOOLTIP_TEXT_SIZE,
  lineHeight: 1.45,
  textAlign: 'left',
};

const headingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
};

/** What a specialization does, for the "?" next to its heading. */
export const SPECIALIZATION_HELP_TEXT =
  'Your avatar is good at one type of skill. Every roll with a skill of that type gets +1, in any slot. '
  + 'It is chosen and changed in the main menu: the first choice is free, every change costs 1 gem.';

const specializationButtonStyle: CSSProperties = {
  alignItems: 'center',
  gap: 6,
  minHeight: 34,
  padding: '5px 18px',
  ...simpleFrameStyle({ background: 'rgba(51, 0, 0, 0.82)', opacity: 0.94 }),
  border: 0,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.82rem, 3.2vw, 0.95rem)',
  cursor: 'pointer',
};

/**
 * The avatar's specialization (D-056). In the main menu a button opens the
 * picker; in the game it is shown only, since it changes only in the menu.
 */
function SpecializationSection({ avatar, onChoose }: {
  avatar: PersistedAvatar;
  onChoose?: () => void;
}) {
  const current = findSpecialization(avatar.specialization);
  const cost = specializationChangeCost(current?.solutionType);
  const help = <HelpTip label="What is a specialization?" text={SPECIALIZATION_HELP_TEXT} />;
  if (!onChoose) {
    // In the game: one line, so it fits the panel over the encounter picture.
    return (
      <p style={specializationNoteStyle}>
        <span><span style={{ color: '#ffcc66', fontWeight: 700 }}>Specialization: </span>{current?.name ?? 'none yet'}</span>
        {help}
      </p>
    );
  }
  return (
    <div style={specializationSectionStyle}>
      <div style={specializationControlsStyle}>
        <div style={headingRowStyle}>
          <p style={sectionHeadingStyle}>Specialization</p>
          {help}
        </div>
        {current ? <p style={specializationNameStyle}>{current.name}</p> : null}
        <PanelButton
          onClick={() => {
            playSfx(DEFAULT_BUTTON_SOUND);
            onChoose();
          }}
          pressKey="overview-specialization"
          visualStyle={specializationButtonStyle}
        >
          {current ? <>Change · <GemCost cost={cost} /></> : 'Choose'}
        </PanelButton>
      </div>
      <p style={specializationDescriptionStyle}>
        {current?.description ?? 'Choose the type of skill your avatar is good at.'}
      </p>
    </div>
  );
}

const noticeStyle: CSSProperties = {
  margin: 0,
  fontSize: TOOLTIP_TEXT_SIZE,
  color: '#ff9a7a',
};

function avatarName(avatar: PersistedAvatar): string {
  return avatar.name.trim() || 'Adventurer';
}

/** The equipment in the card's bottom row, beside Play (menu) or Home (game). */
export function OverviewEquipment({ inventory, tooltipBoundsSelector = 'body', onEquipSlot }: {
  inventory: AvatarInventory | undefined;
  tooltipBoundsSelector?: string;
  onEquipSlot?: (slot: number) => void;
}) {
  return (
    <EquipmentSection
      inRow
      interactive={Boolean(onEquipSlot)}
      inventory={inventory}
      onEquipSlot={onEquipSlot}
      tooltipBoundsSelector={tooltipBoundsSelector}
    />
  );
}

function charges(items: AvatarInventory['items'] | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + Math.max(0, item.uses), 0);
}

export function AvatarOverviewContent({
  avatar,
  inventory,
  choiceDetails,
  notice,
  tooltipBoundsSelector = 'body',
  showPortrait = true,
  onEquipSlot,
  onChooseSpecialization,
  equipmentInFooter = false,
}: {
  avatar: PersistedAvatar;
  inventory: AvatarInventory | undefined;
  /** In the game: what was used and rolled in this encounter. */
  choiceDetails?: ReactNode;
  /** For example why the last equip failed. */
  notice?: string | null;
  tooltipBoundsSelector?: string;
  /** The game shows the avatar just below, so it leaves the portrait out. The name is on the frame's plate. */
  showPortrait?: boolean;
  onEquipSlot?: (slot: number) => void;
  /** Main menu only: opens the specialization picker. */
  onChooseSpecialization?: () => void;
  /** The equipment sits in the card's bottom row instead (`OverviewEquipment`). */
  equipmentInFooter?: boolean;
}) {
  const nextLevel = experienceRequiredForNextLevel(avatar.level);
  const current = Math.max(0, Math.min(avatar.experience, nextLevel));
  const displayTitle = readAvatarDisplayTitle(avatar);
  const stats: Array<[string, number]> = [
    ['Encounters', avatar.encountersPlayed ?? 0],
    ['Items', charges(inventory?.items)],
    ['Skills', charges(inventory?.spellbook)],
    ['Essences', charges(inventory?.essences?.filter((item) => item.solutionType === 15))],
  ];

  const experienceBar = (
    <span aria-label={`Experience ${current} of ${nextLevel}`} style={xpShellStyle}>
      <span style={{ ...xpFillStyle, width: `${nextLevel > 0 ? (current / nextLevel) * 100 : 0}%` }} />
    </span>
  );
  const experienceText = <p style={xpTextStyle}>XP {current}/{nextLevel}</p>;

  return (
    // The game's panel over the picture is short: its rows sit closer together.
    <div style={showPortrait ? contentStyle : { ...contentStyle, gap: 2 }}>
      {showPortrait ? (
        <div style={headStyle}>
          <div style={portraitStyle}>
            <AvatarCard avatar={avatar} hideLabels />
          </div>
          <div style={headTextStyle}>
            {displayTitle ? <p style={titleStyle}>{displayTitle}</p> : null}
            <p style={nameStyle}>{avatarName(avatar)}</p>
            <p style={metaStyle}>Level {avatar.level} · {avatar.race} {avatar.role}</p>
            {experienceBar}
            {experienceText}
          </div>
        </div>
      ) : (
        <>
          {displayTitle ? <p style={titleStyle}>{displayTitle}</p> : null}
          <p style={nameStyle}>{avatarName(avatar)}</p>
          <p style={metaStyle}>Level {avatar.level} · {avatar.race} {avatar.role}</p>
          {/* In the game the specialization is one line up here, where the panel over the picture has room. */}
          <SpecializationSection avatar={avatar} />
          {experienceBar}
          {experienceText}
        </>
      )}
      <TooltipDivider bleed={DIVIDER_BLEED} />
      <div style={statsGridStyle}>
        {stats.map(([label, value]) => (
          <span key={label} style={statStyle}>
            <span style={statValueStyle}>{value}</span>
            {label}
          </span>
        ))}
      </div>
      <TooltipDivider bleed={DIVIDER_BLEED} />
      {/* Specialization first, equipment under it (Babuni, 2026-11-23). */}
      {onChooseSpecialization ? (
        <>
          <SpecializationSection avatar={avatar} onChoose={onChooseSpecialization} />
          <TooltipDivider bleed={DIVIDER_BLEED} />
        </>
      ) : null}
      {equipmentInFooter ? null : (
        <EquipmentSection
          interactive={Boolean(onEquipSlot)}
          inventory={inventory}
          onEquipSlot={onEquipSlot}
          tooltipBoundsSelector={tooltipBoundsSelector}
        />
      )}
      {notice ? <p role="alert" style={noticeStyle}>{notice}</p> : null}
      {choiceDetails}
    </div>
  );
}

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 12,
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 14px 0',
  // The equipment's slots are measured against this row.
  containerType: 'inline-size',
};

const footerButtonStyle: CSSProperties = {
  width: 'clamp(52px, 11vw, 72px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const footerImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5))',
};

/**
 * The card's bottom row (Babuni, 2026-11-24): in the menu the equipment on the
 * left and Play on the right; in the game Home on the left and the equipment
 * on the right. No back button: a tap outside the card closes it.
 */
export function AvatarOverviewFooter({ left, right }: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={footerStyle}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  );
}

/** Bigger than the round footer buttons: it is the card's main action. */
const playButtonStyle: CSSProperties = {
  ...footerButtonStyle,
  width: 'clamp(76px, 19vw, 104px)',
};

/** The card's Play button, at the bottom right; it enters the world. */
export function OverviewEnterButton({ avatarName, disabled, onEnter }: {
  avatarName: string;
  disabled?: boolean;
  onEnter: () => void;
}) {
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  return (
    <button
      aria-label={`Enter the world with ${avatarName}`}
      disabled={disabled}
      onClick={() => {
        playSfx(DEFAULT_BUTTON_SOUND);
        onEnter();
      }}
      className="morkahja-panel-button"
      onPointerDown={() => pulse('overview-enter')}
      style={playButtonStyle}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={OVERVIEW_PLAY_ASSET}
        style={{ ...footerImageStyle, animation: pressAnimation(isPressed('overview-enter')) }}
      />
    </button>
  );
}

const menuOverlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 24,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)',
  gridTemplateColumns: 'minmax(0, 1fr)',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  boxSizing: 'border-box',
  background: 'rgba(8, 4, 2, 0.72)',
  // The dashboard turns pointer events off for its layer.
  pointerEvents: 'auto',
};

/**
 * The avatar creation's size, framed like an encounter (Babuni, 2026-11-23):
 * the encounter's frame with the name on its plate, on the panels' dark red.
 */
const menuPanelStyle: CSSProperties = {
  position: 'relative',
  width: 'min(100%, 520px)',
  maxHeight: 'min(100%, 860px)',
  boxSizing: 'border-box',
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  // The side padding sits inside the scroll box and the footer, so the
  // dividers can reach the frame on the panel's edge without being clipped.
  padding: 'clamp(26px, 6vw, 34px) 0 clamp(18px, 4vw, 26px)',
  background: GAME_PANEL_BACKGROUND,
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  transformOrigin: 'center center',
};

const menuScrollStyle: CSSProperties = {
  minHeight: 0,
  padding: `0 ${PANEL_SIDE_PADDING}`,
  overflowY: 'auto',
  scrollbarWidth: 'none',
};

export const OVERVIEW_CLOSE_MS = 380;

/**
 * The overview in the main menu. `closingInto` shrinks the card into that
 * element (the big avatar) before the world is entered.
 */
export function AvatarOverviewMenuCard({
  title,
  children,
  footer,
  closingInto,
  onBackdrop,
}: {
  /** The name on the frame's plate. */
  title: string;
  children: ReactNode;
  footer: ReactNode;
  closingInto?: RefObject<HTMLElement | null> | null;
  onBackdrop?: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const target = closingInto?.current;
    if (!panel || !target) {
      return;
    }
    const from = panel.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    const scale = Math.max(0.05, Math.min(to.width / from.width, to.height / from.height));
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // The card stays visible while it shrinks and fades only at the very end;
    // the dark backdrop clears meanwhile.
    panel.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.85}px, ${dy * 0.85}px) scale(${0.15 + scale * 0.85})`, opacity: 1, offset: 0.85 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
      ],
      { duration: OVERVIEW_CLOSE_MS, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' },
    );
    overlayRef.current?.animate(
      [{ backgroundColor: 'rgba(8, 4, 2, 0.72)' }, { backgroundColor: 'rgba(8, 4, 2, 0)' }],
      { duration: OVERVIEW_CLOSE_MS, easing: 'ease', fill: 'forwards' },
    );
  }, [closingInto]);

  return (
    <div
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onBackdrop?.();
        }
      }}
      ref={overlayRef}
      style={menuOverlayStyle}
    >
      <section aria-label="Avatar overview" ref={panelRef} role="dialog" style={menuPanelStyle}>
        <DecorativeEdgeFrame regionLabel={title} zIndex={2} />
        <div style={{ ...menuScrollStyle, position: 'relative', zIndex: 1 }}>{children}</div>
        <div style={{ position: 'relative', zIndex: 1, padding: `0 ${PANEL_SIDE_PADDING}` }}>{footer}</div>
      </section>
    </div>
  );
}
