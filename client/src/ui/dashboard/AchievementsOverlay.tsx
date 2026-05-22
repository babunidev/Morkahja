import { useEffect, useState, type CSSProperties } from 'react';
import type {
  AchievementProgressDto,
  AchievementsResponse,
  DailyRewardStatusDto,
} from '@shared/contracts';
import {
  claimDailyReward,
  fetchAchievements,
  fetchPlayer,
} from '../../api/http.js';
import { AchievementPanel } from './AchievementPanel.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';

const OVERLAY_FADE_MS = 300;

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 6,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 420px)',
  maxHeight: 'min(86vh, 620px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: 10,
  padding: '20px 18px 8px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  overflow: 'hidden',
};

const scrollBodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 10,
  alignContent: 'start',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const closeButtonStyle: CSSProperties = {
  minWidth: 72,
  minHeight: 34,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
};

const gemsFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  marginTop: 'auto',
  paddingTop: 8,
  paddingBottom: 0,
  borderTop: '1px solid rgba(255, 204, 102, 0.32)',
};

const gemsIconStyle: CSSProperties = {
  width: 44,
  height: 44,
  objectFit: 'contain',
  filter: 'drop-shadow(0 0 10px rgba(255, 204, 102, 0.55)) drop-shadow(0 6px 10px rgba(0, 0, 0, 0.45))',
};

const gemsCountStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.1rem',
  fontWeight: 700,
  lineHeight: 1.25,
  letterSpacing: '0.03em',
  textShadow: '0 0 8px rgba(255, 204, 102, 0.45), 0 2px 6px rgba(0, 0, 0, 0.85)',
};

function formatGemCount(count: number): string {
  return count === 1 ? '1 yellow red gem' : `${count} yellow red gems`;
}

export function AchievementsOverlay({
  onClose,
  onSnapshotViewed,
  open,
  playerId,
}: {
  onClose: () => void;
  onSnapshotViewed?: (snapshot: AchievementsResponse) => void;
  open: boolean;
  playerId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [yellowRedGems, setYellowRedGems] = useState(0);
  const [achievements, setAchievements] = useState<AchievementProgressDto[]>([]);
  const [dailyReward, setDailyReward] = useState<DailyRewardStatusDto | null>(null);
  const [claimPending, setClaimPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  async function refreshAchievements(): Promise<void> {
    const playerPromise = fetchPlayer(null);
    let achievementsError: string | null = null;

    try {
      const player = await playerPromise;
      setYellowRedGems(player.currencies?.yellow_red_gem ?? 0);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load player');
      return;
    }

    try {
      const snapshot = await fetchAchievements();
      setAchievements(snapshot.achievements);
      setDailyReward(snapshot.dailyReward);
      setLoadError(null);
      if (open) {
        onSnapshotViewed?.(snapshot);
      }
    } catch (error) {
      achievementsError = error instanceof Error
        ? error.message
        : 'Could not load achievements';
      setLoadError(achievementsError);
    }
  }

  useEffect(() => {
    if (!open || !playerId) {
      return;
    }

    let cancelled = false;

    void refreshAchievements().catch((error) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Could not load achievements');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, playerId]);

  async function handleClaimDailyReward(): Promise<void> {
    if (claimPending) {
      return;
    }

    setClaimPending(true);

    try {
      const result = await claimDailyReward();
      setAchievements(result.achievements);
      setDailyReward(result.dailyReward);
      setYellowRedGems(result.currencies.yellow_red_gem ?? 0);
      onSnapshotViewed?.({
        playerId,
        achievements: result.achievements,
        dailyReward: result.dailyReward,
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not claim daily reward');
    } finally {
      setClaimPending(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Achievements"
      onClick={onClose}
      role="presentation"
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="achievements-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="achievements-overlay-title" style={titleStyle}>ACHIEVEMENTS</h2>
          <button
            onClick={() => {
              playSfx(DEFAULT_BUTTON_SOUND);
              onClose();
            }}
            style={closeButtonStyle}
            type="button"
          >
            Close
          </button>
        </header>
        <div data-achievements-scroll="" style={scrollBodyStyle}>
          <style>
            {'[data-achievements-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          {loadError ? (
            <p style={{ margin: 0, color: '#ffb0a8' }}>{loadError}</p>
          ) : null}
          <AchievementPanel
            achievements={achievements}
            claimPending={claimPending}
            dailyReward={dailyReward}
            onClaimDailyReward={() => {
              void handleClaimDailyReward();
            }}
          />
        </div>
        <footer aria-label="Yellow red gems" style={gemsFooterStyle}>
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={GEMS_ICON}
            style={gemsIconStyle}
          />
          <p style={gemsCountStyle}>{formatGemCount(yellowRedGems)}</p>
        </footer>
      </section>
    </div>
  );
}

export default AchievementsOverlay;
