import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';

import type { AvatarInventory, PersistedAvatar } from '../../api/http.js';
import { assetUrl } from '../../assetUrl.js';
import { TooltipDivider } from '../game/GameTooltip.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import AvatarCard from './AvatarCard.js';
import { EquipmentSection, experienceRequiredForNextLevel } from './AvatarPartyDetailsCard.js';
import { readAvatarDisplayTitle } from './avatarDisplayName.js';
import { simpleFrameClipPath, simpleFrameStyle } from '../common/simpleFrame.js';
import DecorativeEdgeFrame from '../game/blocks/DecorativeEdgeFrame.js';
import { GAME_PANEL_BACKGROUND } from '../game/blocks/gamePanelBackground.js';

/**
 * The avatar's overview (Babuni, 2026-11-23): everything about the avatar in
 * one big card, the same in the main menu and in the game. Who it is, its
 * experience, a few statistics, the two equipment slots, and room for the
 * specialization to come. Red goes back; green enters the world (menu) or
 * Home leaves it (game).
 */

const UI_ROOT = assetUrl('/UI/02_AvatarCreation');
export const OVERVIEW_BACK_ASSET = `${UI_ROOT}/im_button_delete.webp`;
export const OVERVIEW_ENTER_ASSET = `${UI_ROOT}/im_button_yes.webp`;

const contentStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  padding: '0 14px',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
};

const portraitStyle: CSSProperties = {
  width: 'clamp(96px, 30%, 150px)',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(0.9rem, 3.4vw, 1.1rem)',
  letterSpacing: '0.05em',
  color: '#ffcc66',
};

const metaStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.74rem',
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
  fontSize: '0.72rem',
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
  fontSize: '0.66rem',
  lineHeight: 1.2,
  opacity: 0.92,
};

const statValueStyle: CSSProperties = {
  color: '#ffcc66',
  fontSize: '1rem',
  fontWeight: 700,
};

const comingSoonStyle: CSSProperties = {
  margin: '4px 0 0',
  minHeight: 48,
  fontSize: '0.7rem',
  opacity: 0.6,
};

const noticeStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.72rem',
  color: '#ff9a7a',
};

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

  return (
    <div style={contentStyle}>
      {showPortrait ? (
        <div style={portraitStyle}>
          <AvatarCard avatar={avatar} hideLabels />
        </div>
      ) : null}
      {displayTitle ? <p style={titleStyle}>{displayTitle}</p> : null}
      <p style={metaStyle}>Level {avatar.level} · {avatar.race} {avatar.role}</p>
      <span aria-label={`Experience ${current} of ${nextLevel}`} style={xpShellStyle}>
        <span style={{ ...xpFillStyle, width: `${nextLevel > 0 ? (current / nextLevel) * 100 : 0}%` }} />
      </span>
      <p style={xpTextStyle}>XP {current}/{nextLevel}</p>
      <TooltipDivider />
      <div style={statsGridStyle}>
        {stats.map(([label, value]) => (
          <span key={label} style={statStyle}>
            <span style={statValueStyle}>{value}</span>
            {label}
          </span>
        ))}
      </div>
      <TooltipDivider />
      <EquipmentSection
        interactive={Boolean(onEquipSlot)}
        inventory={inventory}
        onEquipSlot={onEquipSlot}
        tooltipBoundsSelector={tooltipBoundsSelector}
      />
      {notice ? <p role="alert" style={noticeStyle}>{notice}</p> : null}
      <TooltipDivider />
      {/* Room for the specialization (D-056), not built yet. */}
      <p style={sectionHeadingStyle}>Specialization</p>
      <p style={comingSoonStyle}>Coming soon</p>
      {choiceDetails}
    </div>
  );
}

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 14px 0',
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
 * The green check (menu) or Home (game). No back button (Babuni, 2026-11-23):
 * a tap outside the card closes it.
 */
export function AvatarOverviewFooter({
  onBack,
  right,
}: {
  onBack?: () => void;
  right: ReactNode;
}) {
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  if (!onBack) {
    return <div style={{ ...footerStyle, justifyContent: 'center' }}>{right}</div>;
  }
  return (
    <div style={footerStyle}>
      <button
        aria-label="Back"
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          onBack();
        }}
        onPointerDown={() => pulse('overview-back')}
        style={footerButtonStyle}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={OVERVIEW_BACK_ASSET}
          style={{ ...footerImageStyle, animation: pressAnimation(isPressed('overview-back')) }}
        />
      </button>
      {right}
    </div>
  );
}

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
      onPointerDown={() => pulse('overview-enter')}
      style={footerButtonStyle}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={OVERVIEW_ENTER_ASSET}
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
  padding: 'clamp(26px, 6vw, 34px) clamp(5px, 1.2vw, 7px) clamp(18px, 4vw, 26px)',
  background: GAME_PANEL_BACKGROUND,
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  transformOrigin: 'center center',
};

const menuScrollStyle: CSSProperties = {
  minHeight: 0,
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
        <div style={{ position: 'relative', zIndex: 1 }}>{footer}</div>
      </section>
    </div>
  );
}
