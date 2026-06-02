import { useEffect, useState, type CSSProperties } from 'react';
import type { SoulLinkDto } from '@shared/contracts';
import { createSoulLink, fetchSoulLink } from '../../api/http.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const OVERLAY_FADE_MS = 300;

const SOUL_LINK_EXPLANATION =
  'The Adventurer you link your soul to will receive the Gift of the Gods when you claim your next Hearth Blessing!';

function isSelfSoulLinkQuery(query: string, playerId: string, playerName: string): boolean {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized === playerId.toLowerCase()
    || normalized === playerName.trim().toLowerCase()
  );
}

function soulLinkErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not create soul link';

  if (message.includes('PLAYER_NOT_FOUND')) {
    return 'No player found with that name.';
  }

  if (message.includes('CANNOT_SOUL_LINK_SELF')) {
    return 'You cannot soul link to yourself.';
  }

  if (message.includes('SOUL_LINK_ALREADY_SET')) {
    return 'You have already chosen your soul link.';
  }

  return message;
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 7,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.78)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  width: 'min(92vw, 420px)',
  maxHeight: 'min(86vh, 560px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gap: 14,
  padding: '20px 18px 18px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.94)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  overflow: 'hidden',
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

const bodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  display: 'grid',
  gap: 16,
  alignContent: 'start',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
};

const explanationStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.96rem',
  lineHeight: 1.55,
  textAlign: 'center',
  color: 'rgba(247, 239, 224, 0.92)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 40,
  padding: '8px 12px',
  border: '1px solid rgba(255, 204, 102, 0.45)',
  borderRadius: 9,
  background: 'rgba(8, 5, 4, 0.72)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const linkButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: '1.05rem',
  letterSpacing: '0.06em',
};

const linkButtonDisabledStyle: CSSProperties = {
  ...linkButtonStyle,
  opacity: 0.45,
  cursor: 'default',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.88rem',
  lineHeight: 1.45,
  textAlign: 'center',
  color: 'rgba(247, 239, 224, 0.88)',
};

const errorMessageStyle: CSSProperties = {
  ...messageStyle,
  color: '#ffb0a8',
};

const linkedCardStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  justifyItems: 'center',
  padding: '18px 16px',
  border: '1px solid rgba(140, 230, 160, 0.45)',
  borderRadius: 12,
  background: 'rgba(8, 5, 4, 0.55)',
  boxShadow: 'inset 0 0 0 1px rgba(140, 230, 160, 0.18)',
};

const linkedNameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.3rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
};

const linkedTagStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(140, 230, 160, 0.92)',
  fontSize: '0.82rem',
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
};

export function SoulLinkOverlay({
  onClose,
  onLinked,
  open,
  playerId,
  playerName,
}: {
  onClose: () => void;
  onLinked?: () => void;
  open: boolean;
  playerId: string;
  playerName: string;
}) {
  const [visible, setVisible] = useState(false);
  const [soulLink, setSoulLink] = useState<SoulLinkDto | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState(false);
  const [loadPending, setLoadPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setQuery('');
      setStatusMessage(null);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    setLoadPending(true);
    let cancelled = false;

    void fetchSoulLink()
      .then((response) => {
        if (!cancelled) {
          setSoulLink(response.soulLink);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'Could not load soul link');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadPending(false);
        }
      });

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, [open]);

  async function handleSoulLink(): Promise<void> {
    const trimmed = query.trim();

    if (!trimmed || pending || soulLink) {
      return;
    }

    if (isSelfSoulLinkQuery(trimmed, playerId, playerName)) {
      setStatusMessage('You cannot soul link to yourself.');
      return;
    }

    setPending(true);
    setStatusMessage(null);
    playSfx(DEFAULT_BUTTON_SOUND);

    try {
      const result = await createSoulLink(trimmed);
      setSoulLink(result.soulLink);
      setQuery('');
      setStatusMessage(null);
      onLinked?.();
    } catch (error) {
      setStatusMessage(soulLinkErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return null;
  }

  const selfQuery = isSelfSoulLinkQuery(query, playerId, playerName);

  return (
    <div
      aria-label="Soul Link"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="soul-link-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="soul-link-overlay-title" style={titleStyle}>
            SOUL LINK
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="soul-link-close" />
        </header>
        <div style={bodyStyle}>
          <p style={explanationStyle}>{SOUL_LINK_EXPLANATION}</p>
          {soulLink ? (
            <div style={linkedCardStyle}>
              <p style={linkedNameStyle}>{soulLink.targetName}</p>
              <p style={linkedTagStyle}>Linked</p>
            </div>
          ) : (
            <>
              <input
                aria-label="Adventurer name to soul link"
                disabled={pending || loadPending}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSoulLink();
                  }
                }}
                placeholder="Adventurer name"
                style={inputStyle}
                value={query}
              />
              <button
                aria-label="Soul link"
                disabled={pending || loadPending || !query.trim() || selfQuery}
                onClick={() => {
                  void handleSoulLink();
                }}
                style={
                  pending || loadPending || !query.trim() || selfQuery
                    ? linkButtonDisabledStyle
                    : linkButtonStyle
                }
                type="button"
              >
                Soul Link
              </button>
              {selfQuery ? (
                <p style={errorMessageStyle}>You cannot soul link to yourself.</p>
              ) : null}
            </>
          )}
          {statusMessage ? <p style={errorMessageStyle}>{statusMessage}</p> : null}
        </div>
      </section>
    </div>
  );
}

export default SoulLinkOverlay;
