import { useEffect, useState, type CSSProperties } from 'react';
import type { AchievementProgressDto } from '@shared/contracts';
import { formatAchievementUnlockMessage } from '@shared/achievementUnlockMessage.js';
import {
  protectedImageProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { rankTitleForAchievement } from './achievementUnlockDetection.js';

const SCRIBES_ICON = '/UI/03_DASHBOARD/im_button_news_a.webp';
const ENTER_MS = 420;
const DISPLAY_MS = 6_000;
const SHAKE_MS = 520;
const EXIT_MS = 320;

type ToastPhase = 'enter' | 'shown' | 'shake' | 'exit';

const rootStyle: CSSProperties = {
  position: 'fixed',
  top: 'max(12px, env(safe-area-inset-top))',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 24,
  width: 'min(92vw, 420px)',
  pointerEvents: 'none',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  margin: 0,
  padding: '10px 12px',
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 12,
  background: 'rgba(12, 7, 5, 0.94)',
  boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55), 0 0 14px rgba(255, 204, 102, 0.28)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'left',
  cursor: 'pointer',
  pointerEvents: 'auto',
  ...protectedOverlayTextStyle,
};

const iconStyle: CSSProperties = {
  width: 44,
  height: 44,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))',
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

const messageStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: '0.95rem',
  lineHeight: 1.35,
};

function toastButtonClass(phase: ToastPhase): string {
  const classes = ['morkahja-scribes-achievement-toast-button'];

  if (phase === 'enter') {
    classes.push('morkahja-scribes-achievement-toast-button--enter');
  } else if (phase === 'shake') {
    classes.push('morkahja-scribes-achievement-toast-button--shake');
  } else if (phase === 'exit') {
    classes.push('morkahja-scribes-achievement-toast-button--exit');
  } else {
    classes.push('morkahja-scribes-achievement-toast-button--shown');
  }

  return classes.join(' ');
}

export function ScribesAchievementToast({
  achievement,
  onDismiss,
  onOpenAchievements,
}: {
  achievement: AchievementProgressDto;
  onDismiss: () => void;
  onOpenAchievements: () => void;
}) {
  const [phase, setPhase] = useState<ToastPhase>('enter');
  const rankTitle = rankTitleForAchievement(achievement);
  const message = formatAchievementUnlockMessage(rankTitle, 'self');

  useEffect(() => {
    const shownTimer = window.setTimeout(() => {
      setPhase('shown');
    }, ENTER_MS);

    const shakeTimer = window.setTimeout(() => {
      setPhase('shake');
    }, ENTER_MS + DISPLAY_MS);

    const exitTimer = window.setTimeout(() => {
      setPhase('exit');
    }, ENTER_MS + DISPLAY_MS + SHAKE_MS);

    const dismissTimer = window.setTimeout(() => {
      onDismiss();
    }, ENTER_MS + DISPLAY_MS + SHAKE_MS + EXIT_MS);

    return () => {
      window.clearTimeout(shownTimer);
      window.clearTimeout(shakeTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [achievement.achievementId, achievement.rank, onDismiss]);

  return (
    <div aria-live="polite" style={rootStyle}>
      <button
        aria-label={`${message} Open achievements.`}
        className={toastButtonClass(phase)}
        onClick={() => {
          onOpenAchievements();
          onDismiss();
        }}
        style={buttonStyle}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          {...protectedImageProps}
          src={SCRIBES_ICON}
          style={iconStyle}
        />
        <span>
          <p style={labelStyle}>Scribes</p>
          <p style={messageStyle}>{message}</p>
        </span>
      </button>
    </div>
  );
}

export default ScribesAchievementToast;
