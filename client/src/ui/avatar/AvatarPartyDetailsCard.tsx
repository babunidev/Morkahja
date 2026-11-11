import type { CSSProperties, ReactNode } from 'react';
import type { AvatarInventoryDto } from '@shared/contracts';
import { readAvatarDisplayTitle } from './avatarDisplayName.js';
import { EssenceLivesRow } from './EssenceLivesRow.js';

export type AvatarDetailsSlotSide = 'left' | 'center' | 'right';

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(6, 6, 10, 0.78)',
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
  height: 6,
  marginTop: 7,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 999,
  background: 'rgba(20, 8, 4, 0.72)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.65)',
  overflow: 'hidden',
};

const xpBarFillStyle: CSSProperties = {
  display: 'block',
  height: '100%',
  borderRadius: 999,
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
  borderRadius: 999,
  border: '1px solid rgba(255, 204, 102, 0.45)',
  background: 'rgba(24, 14, 8, 0.92)',
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

export function experienceRequiredForNextLevel(level: number): number {
  return 7 * 2 ** (Math.max(1, level) - 1);
}

export function avatarDetailsOverlayStyle(
  _slotSide: AvatarDetailsSlotSide = 'center',
  _compact = false,
): CSSProperties {
  return {
    position: 'absolute',
    left: '50%',
    bottom: '2%',
    transform: 'translateX(-50%)',
    zIndex: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 'clamp(6px, 1.4vw, 10px)',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    pointerEvents: 'none',
  };
}

export function AvatarPartyDetailsCard({
  avatar,
  inventory,
  inventorySeed,
  statusLabel,
  statusInactive = false,
  footer,
  slotSide = 'center',
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
}) {
  const nextLevelExperience = experienceRequiredForNextLevel(avatar.level);
  const currentExperience = Math.max(0, Math.min(avatar.experience, nextLevelExperience));
  const experiencePercent = nextLevelExperience > 0
    ? (currentExperience / nextLevelExperience) * 100
    : 0;

  const displayTitle = readAvatarDisplayTitle(avatar);
  const baseName = avatar.name.trim() || 'Adventurer';

  return (
    <div role="tooltip" style={cardStyle}>
      <div style={nameBlockStyle}>
        {displayTitle ? (
          <span style={titleStyle}>{displayTitle}</span>
        ) : null}
        <span style={displayTitle ? avatarNameStyle : soloNameStyle}>{baseName}</span>
      </div>
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
      <EssenceLivesRow essences={inventory?.essences} seed={`${inventorySeed}:${slotSide}`} />
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
