import type { CSSProperties } from 'react';
import type {
  AchievementProgressDto,
  DailyRewardStatusDto,
} from '@shared/contracts';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const panelBodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 14,
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
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
  width: '62%',
  height: '62%',
  transform: 'translate(-50%, -50%)',
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.65))',
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
  if (achievement.bandEnd === null) {
    return `${achievement.progress} encounters — max rank reached`;
  }

  const remaining = Math.max(0, achievement.bandEnd - achievement.progress);
  return `${achievement.progress} / ${achievement.bandEnd} encounters (${remaining} to next rank)`;
}

function AchievementCard({ achievement }: { achievement: AchievementProgressDto }) {
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
      <h3 style={achievementTitleStyle}>{achievement.title}</h3>
      <p style={achievementTextStyle}>{achievement.text}</p>
      <div
        aria-label="Progress toward next rank"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(achievement.progressInBand * 100)}
        role="progressbar"
        style={progressTrackStyle}
      >
        <div
          style={{
            ...progressFillStyle,
            width: `${Math.round(achievement.progressInBand * 100)}%`,
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
  return (
    <div data-achievements-scroll="" style={panelBodyStyle}>
      <style>
        {'[data-achievements-scroll]::-webkit-scrollbar { display: none; }'}
      </style>
      {achievements.map((achievement) => (
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
