import { useEffect, useState, type CSSProperties } from 'react';
import type { ActivityFeedEntryDto } from '@shared/contracts';
import { fetchRecentActivity } from '../../api/http.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
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

const listStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  overflowY: 'auto',
  display: 'grid',
  gap: 10,
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

const entryBodyStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const entryTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const entryIconStyle: CSSProperties = {
  width: 48,
  height: 48,
  flexShrink: 0,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.45))',
};

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(deltaMs / 60_000);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes === 1) {
    return '1 min ago';
  }

  return `${minutes} min ago`;
}

export function ActivityFeedOverlay({
  onClose,
  onReadStateChange,
  open,
  playerId,
}: {
  onClose: () => void;
  onReadStateChange?: () => void;
  open: boolean;
  playerId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [entries, setEntries] = useState<ActivityFeedEntryDto[]>([]);
  const [readIds, setReadIds] = useState(() => loadScribesReadIds(playerId));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="scribes-feed-title" style={titleStyle}>SCRIBES</h2>
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
        {loading && entries.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.8 }}>The scribes are listening…</p>
        ) : null}
        {error ? (
          <p style={{ margin: 0, color: '#ffb0a8' }}>{error}</p>
        ) : null}
        {!error && entries.length === 0 && !loading ? (
          <p style={{ margin: 0, opacity: 0.8 }}>Nothing worth inscribing in the last 15 minutes.</p>
        ) : null}
        <ul style={listStyle}>
          {entries.map((entry) => {
            const read = readIds.has(entry.eventId);

            return (
            <li key={entry.eventId} style={entryStyle(entry.importance, read)}>
              <div style={{ opacity: 0.72, fontSize: '0.78rem', marginBottom: 4 }}>
                {formatRelativeTime(entry.timestamp)}
                {!read ? <span style={unreadBadgeStyle}>New</span> : null}
              </div>
              <div style={entryBodyStyle}>
                <div style={entryTextStyle}>{entry.message}</div>
                {entry.iconUrl ? (
                  <img
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    src={entry.iconUrl}
                    style={entryIconStyle}
                  />
                ) : null}
              </div>
            </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default ActivityFeedOverlay;
