import { useEffect, useState, type CSSProperties } from 'react';
import type { ActivityFeedEntryDto, ActivityFeedJoinRoomActionDto } from '@shared/contracts';
import { fetchRecentActivity } from '../../api/http.js';
import { AvatarPortraitStack } from '../avatar/AvatarPortraitStack.js';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { loadScribesReadIds, markScribesEntriesRead } from './scribesReadState.js';

const OVERLAY_FADE_MS = 300;
const POLL_INTERVAL_MS = 10_000;

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
  maxHeight: 'min(72vh, 640px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 14,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  ...protectedOverlayTextStyle,
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

const scrollBodyStyle: CSSProperties = {
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  overflow: 'hidden',
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 10,
  scrollbarWidth: 'none',
};

function entryStyle(
  importance: ActivityFeedEntryDto['importance'],
  read: boolean,
): CSSProperties {
  const glow = importance === 'legendary'
    ? '0 0 14px rgba(255, 204, 102, 0.45)'
    : importance === 'high'
      ? '0 0 10px rgba(255, 140, 80, 0.28)'
      : 'none';

  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: read
      ? '1px solid rgba(255, 204, 102, 0.18)'
      : '1px solid rgba(255, 204, 102, 0.42)',
    background: read ? 'rgba(24, 12, 8, 0.58)' : 'rgba(24, 12, 8, 0.82)',
    boxShadow: read ? 'none' : glow,
    fontSize: '0.95rem',
    lineHeight: 1.45,
    opacity: read ? 0.78 : 1,
    transition: 'opacity 280ms ease, border-color 280ms ease, background 280ms ease',
  };
}

const unreadBadgeStyle: CSSProperties = {
  display: 'inline-block',
  marginLeft: 8,
  padding: '1px 7px',
  borderRadius: 999,
  border: '1px solid rgba(255, 204, 102, 0.55)',
  color: '#ffcc66',
  fontSize: '0.68rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  verticalAlign: 'middle',
};

const visibilityBadgeStyle: CSSProperties = {
  display: 'inline-block',
  padding: '1px 7px',
  borderRadius: 999,
  border: '1px solid rgba(255, 204, 102, 0.35)',
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.64rem',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  verticalAlign: 'middle',
};

const entryBodyStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const entryTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const entryMetaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 6,
};

const authorStyle: CSSProperties = {
  margin: 0,
  flex: '1 1 auto',
  minWidth: 0,
  color: '#ffcc66',
  fontSize: '1.02rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const entryMetaRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
};

const timeStyle: CSSProperties = {
  color: 'rgba(247, 239, 224, 0.72)',
  fontSize: '0.78rem',
  whiteSpace: 'nowrap',
};

const joinButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: '6px 14px',
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 8,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '0.82rem',
  letterSpacing: '0.04em',
};

const entryIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  flexShrink: 0,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))',
};

const entryAvatarStackStyle: CSSProperties = {
  width: 52,
  height: 64,
  flexShrink: 0,
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))',
};

function scribesEntryVisual(entry: ActivityFeedEntryDto) {
  if (entry.avatarPortrait && entry.avatarFrame) {
    return (
      <AvatarPortraitStack
        frame={entry.avatarFrame}
        portrait={entry.avatarPortrait}
        style={entryAvatarStackStyle}
      />
    );
  }

  if (entry.iconUrl) {
    return (
      <img
        alt=""
        aria-hidden="true"
        {...protectedImageProps}
        src={entry.iconUrl}
        style={entryIconStyle}
      />
    );
  }

  return null;
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  return hours === 1 ? '1 hr ago' : `${hours} hr ago`;
}

export function ActivityFeedOverlay({
  onClose,
  onJoinRoom,
  onReadStateChange,
  open,
  playerId,
}: {
  onClose: () => void;
  onJoinRoom?: (action: ActivityFeedJoinRoomActionDto) => void | Promise<void>;
  onReadStateChange?: () => void;
  open: boolean;
  playerId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<ActivityFeedEntryDto[]>([]);
  const [readIds, setReadIds] = useState(() => loadScribesReadIds(playerId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinPendingId, setJoinPendingId] = useState<string | null>(null);

  async function refreshFeed(): Promise<void> {
    setLoading(true);

    try {
      const response = await fetchRecentActivity();
      setEntries(response.entries);
      setError(null);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not load scribes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    void refreshFeed();

    const pollTimer = window.setInterval(() => {
      void refreshFeed();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(showTimer);
      window.clearInterval(pollTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open || entries.length === 0) {
      return;
    }

    markScribesEntriesRead(
      playerId,
      entries.map((entry) => entry.eventId),
    );
    setReadIds(loadScribesReadIds(playerId));
    onReadStateChange?.();
  }, [entries, onReadStateChange, open, playerId]);

  useEffect(() => {
    if (!open) {
      setReadIds(loadScribesReadIds(playerId));
    }
  }, [open, playerId]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Scribes"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="scribes-feed-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="scribes-feed-title" style={titleStyle}>SCRIBES</h2>
          <ClosePanelButton onClose={onClose} pressKey="scribes-close" />
        </header>
        <div style={scrollBodyStyle}>
          {loading && entries.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.8 }}>The scribes are listening…</p>
          ) : null}
          {error ? (
            <p style={{ margin: 0, color: '#ffb0a8' }}>{error}</p>
          ) : null}
          {!error && entries.length === 0 && !loading ? (
            <p style={{ margin: 0, opacity: 0.8 }}>Nothing worth inscribing in the last hour.</p>
          ) : null}
          <ul data-scribes-feed-scroll="" style={listStyle}>
            {entries.map((entry) => {
              const read = readIds.has(entry.eventId);

              return (
              <li key={entry.eventId} style={entryStyle(entry.importance, read)}>
                <div style={entryMetaRowStyle}>
                  <span style={authorStyle}>{entry.authorName || 'Unknown'}</span>
                  <span style={entryMetaRightStyle}>
                    <span style={visibilityBadgeStyle}>{entry.visibility}</span>
                    <span style={timeStyle}>{formatRelativeTime(entry.timestamp)}</span>
                    {!read ? <span style={unreadBadgeStyle}>New</span> : null}
                  </span>
                </div>
                <div style={entryBodyStyle}>
                  <div style={entryTextStyle}>
                    <div>{entry.message}</div>
                    {entry.joinAction && onJoinRoom ? (
                      <button
                        disabled={joinPendingId === entry.eventId}
                        onClick={() => {
                          setJoinPendingId(entry.eventId);
                          void Promise.resolve(onJoinRoom(entry.joinAction!))
                            .finally(() => {
                              setJoinPendingId(null);
                            });
                        }}
                        style={joinButtonStyle}
                        type="button"
                      >
                        {joinPendingId === entry.eventId ? 'Joining…' : 'Join'}
                      </button>
                    ) : null}
                  </div>
                  {scribesEntryVisual(entry)}
                </div>
              </li>
              );
            })}
          </ul>
        </div>
        <style>
          {'[data-scribes-feed-scroll]::-webkit-scrollbar { display: none; }'}
        </style>
      </section>
    </div>
  );
}

export default ActivityFeedOverlay;
