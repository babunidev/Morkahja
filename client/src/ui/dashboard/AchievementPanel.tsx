import type { CSSProperties } from 'react';
import type {
  AchievementProgressDto,
  DailyRewardStatusDto,
} from '@shared/contracts';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const panelBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
};

const achievementCardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '14px 12px',
  border: '1px solid rgba(255, 204, 102, 0.28)',
  borderRadius: 12,
  background: 'rgba(18, 10, 7, 0.72)',
};

const iconStackStyle: CSSProperties = {
  position: 'relative',
  width: 72,
  height: 72,
  margin: '0 auto',
};

const baseIconStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  filter: 'drop-shadow(0 0 12px rgba(255, 204, 102, 0.45))',
};

const rankOverlayStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 'calc(100% + 10px)',
  height: 'calc(100% + 10px)',
  transform: 'translate(-50%, -50%)',
  objectFit: 'contain',
  filter: 'drop-shadow(0 0 12px rgba(255, 204, 102, 0.45)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.65))',
};

const achievementTitleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.2rem',
  textAlign: 'center',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
};

const achievementTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.88)',
  fontSize: '0.92rem',
  lineHeight: 1.4,
  textAlign: 'center',
};

const progressTrackStyle: CSSProperties = {
  height: 10,
  borderRadius: 999,
  background: 'rgba(255, 204, 102, 0.16)',
  overflow: 'hidden',
};

const progressFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 'inherit',
  background: 'linear-gradient(90deg, rgba(255, 140, 72, 0.95), rgba(255, 204, 102, 0.98))',
  boxShadow: '0 0 10px rgba(255, 204, 102, 0.55)',
  transition: 'width 420ms ease',
};

const progressLabelStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.72)',
  fontSize: '0.78rem',
  textAlign: 'center',
  letterSpacing: '0.04em',
};

const dailyRewardCardStyle: CSSProperties = {
  ...achievementCardStyle,
  gap: 10,
};

const claimButtonStyle: CSSProperties = {
  minHeight: 36,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
};

const claimButtonDisabledStyle: CSSProperties = {
  ...claimButtonStyle,
  opacity: 0.5,
  cursor: 'default',
};

function progressLabel(achievement: AchievementProgressDto): string {
  if (achievement.achievementId === 'firestarter') {
    if (achievement.bandEnd === null) {
      return `${achievement.progress} combined levels — max rank reached`;
    }

    if (achievement.rank >= 3) {
      return `${achievement.progress} / ${achievement.bandEnd} combined levels`;
    }

    return `${achievement.progress} / ${achievement.bandEnd} avatars`;
  }

  if (
    achievement.achievementId === 'combatant'
    || achievement.achievementId === 'trickster'
    || achievement.achievementId === 'helper'
  ) {
    const label = achievement.achievementId === 'combatant'
      ? 'combat encounters'
      : achievement.achievementId === 'trickster'
        ? 'trick encounters'
        : 'help encounters';

    if (achievement.bandEnd === null) {
      return `${achievement.progress} ${label} — max rank reached`;
    }

    return `${achievement.progress} / ${achievement.bandEnd} ${label}`;
  }

  if (achievement.achievementId === 'blessed') {
    if (achievement.bandEnd === null) {
      return `${achievement.progress} lucky rolls — max rank reached`;
    }

    return `${achievement.progress} / ${achievement.bandEnd} lucky rolls`;
  }

  if (achievement.achievementId === 'contributor') {
    if (achievement.bandEnd === null) {
      return `${achievement.progress} gems donated — max rank reached`;
    }

    return `${achievement.progress} / ${achievement.bandEnd} gems donated`;
  }

  if (achievement.achievementId === 'alpha_player') {
    if (achievement.globallyLocked && achievement.rank < 4) {
      return `${achievement.progress} activity — sealed (100 Legendborn claimed)`;
    }

    if (achievement.bandEnd === null) {
      return `${achievement.progress} activity — max rank reached`;
    }

    return `${achievement.progress} / ${achievement.bandEnd} activity`;
  }

  if (achievement.bandEnd === null) {
    return `${achievement.progress} encounters — max rank reached`;
  }

  return `${achievement.progress} / ${achievement.bandEnd} encounters`;
}

function AchievementCard({ achievement }: { achievement: AchievementProgressDto }) {
  const progressPercent = Math.round((achievement.progressInBand ?? 0) * 100);

  return (
    <article style={achievementCardStyle}>
      <div style={iconStackStyle}>
        <img
          alt=""
          aria-hidden="true"
          draggable={false}
          src={achievement.baseIconUrl}
          style={baseIconStyle}
        />
        {achievement.rankOverlayUrl ? (
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={achievement.rankOverlayUrl}
            style={rankOverlayStyle}
          />
        ) : null}
      </div>
      <h3 style={achievementTitleStyle}>
        {achievement.chainTitle && achievement.rank <= 0
          ? achievement.chainTitle
          : achievement.title}
      </h3>
      <p style={achievementTextStyle}>
        {achievement.globallyLocked && achievement.rank < 4
          ? `${achievement.text} This limited achievement has been permanently sealed.`
          : achievement.text}
      </p>
      <div
        aria-label="Progress toward next rank"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
        role="progressbar"
        style={progressTrackStyle}
      >
        <div
          style={{
            ...progressFillStyle,
            width: `${progressPercent}%`,
          }}
        />
      </div>
      <p style={progressLabelStyle}>{progressLabel(achievement)}</p>
    </article>
  );
}

function DailyRewardCard({
  claimPending,
  dailyReward,
  onClaim,
}: {
  claimPending: boolean;
  dailyReward: DailyRewardStatusDto;
  onClaim: () => void;
}) {
  const canClaim = dailyReward.claimable && !claimPending;

  return (
    <section style={dailyRewardCardStyle}>
      <h3 style={achievementTitleStyle}>Daily Reward</h3>
      <p style={progressLabelStyle}>
        {dailyReward.encountersPlayed}/{dailyReward.encountersRequired} encounters
        {dailyReward.claimedToday ? ' — claimed' : ''}
      </p>
      <button
        disabled={!canClaim}
        onClick={() => {
          if (!canClaim) {
            return;
          }

          playSfx(DEFAULT_BUTTON_SOUND);
          onClaim();
        }}
        style={canClaim ? claimButtonStyle : claimButtonDisabledStyle}
        type="button"
      >
        {claimPending
          ? 'Claiming…'
          : dailyReward.claimedToday
            ? 'Claimed today'
            : dailyReward.claimable
              ? `Claim ${dailyReward.gemReward} gem${dailyReward.gemReward === 1 ? '' : 's'}`
              : 'Not ready yet'}
      </button>
    </section>
  );
}

function isRenderableAchievement(
  achievement: AchievementProgressDto | null | undefined,
): achievement is AchievementProgressDto {
  return Boolean(
    achievement
    && typeof achievement.achievementId === 'string'
    && typeof achievement.baseIconUrl === 'string',
  );
}

export function AchievementPanel({
  achievements,
  claimPending,
  dailyReward,
  onClaimDailyReward,
}: {
  achievements: AchievementProgressDto[];
  claimPending: boolean;
  dailyReward: DailyRewardStatusDto | null;
  onClaimDailyReward: () => void;
}) {
  const visibleAchievements = Array.isArray(achievements)
    ? achievements.filter(isRenderableAchievement)
    : [];

  return (
    <div style={panelBodyStyle}>
      {visibleAchievements.map((achievement) => (
        <AchievementCard achievement={achievement} key={achievement.achievementId} />
      ))}
      {dailyReward ? (
        <DailyRewardCard
          claimPending={claimPending}
          dailyReward={dailyReward}
          onClaim={onClaimDailyReward}
        />
      ) : null}
    </div>
  );
}

export default AchievementPanel;
