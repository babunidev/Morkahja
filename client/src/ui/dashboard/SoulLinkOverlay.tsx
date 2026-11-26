import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import qrcode from 'qrcode-generator';
import { revealMenuWhenReady } from '../transitions/menuReadiness.js';
import type { LinkedSoulDto, SoulLinkDto } from '@shared/contracts';
import { createSoulLink, fetchSoulLink } from '../../api/http.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';
import { LineFrame, framedStyle } from '../common/LineFrame.js';
import { simpleFrameStyle } from '../common/simpleFrame.js';
import { soulLinkInviteUrl } from './soulLinkInvite.js';

const OVERLAY_FADE_MS = 300;

const SOUL_LINK_EXPLANATION =
  'Link your soul to the adventurer who brought you here. On the first day you both play 42 encounters, they receive the Gift of the Gods, and you receive Aetherion as a welcome gift!';

// What the inviter gets, said where the link is shared (Babuni, 2026-11-26, D-068).
const SOUL_LINK_INVITE_TEXT =
  'Share your link or show this code to a new adventurer. When they start Morkahja with it, their soul is linked to yours. On the first day you both play 42 encounters, you receive Spiritguide and Alpha Player progress, and they receive Aetherion.';

const SHARE_TITLE = 'Morkahja';
const SHARE_TEXT = 'Join me in Morkahja! Our souls get linked, and on the day we both play 42 encounters you receive Aetherion as a welcome gift.';

type ShareOutcome = 'shared' | 'copied' | 'failed' | 'cancelled';

/** The phone's share menu where there is one; otherwise the link is copied. */
async function shareInviteLink(url: string): Promise<ShareOutcome> {
  const shareData = { title: SHARE_TITLE, text: SHARE_TEXT, url };
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      // Fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function giftProgressLine(own: number, other: number, otherName: string, required: number): string {
  return `Today: you ${Math.min(own, required)}/${required} · ${otherName} ${Math.min(other, required)}/${required}`;
}

/** SVG path of the dark modules, one unit per module, with a 4-module quiet zone. */
function qrPath(text: string): { path: string; size: number } {
  const code = qrcode(0, 'M');
  code.addData(text);
  code.make();
  const count = code.getModuleCount();
  const margin = 4;
  let path = '';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (code.isDark(row, col)) {
        path += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
  }
  return { path, size: count + margin * 2 };
}

const inviteStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  justifyItems: 'center',
  paddingTop: 4,
};

const qrStyle: CSSProperties = {
  width: 'min(56vw, 200px)',
  height: 'auto',
  aspectRatio: '1',
  display: 'block',
  borderRadius: 8,
  // Morkahja's gold with its dark red (Babuni, 2026-11-24); dark on light,
  // with high contrast, so phone cameras still read it.
  background: '#ffcc66',
  border: '3px solid #330000',
  boxShadow: '0 0 0 1px rgba(255, 204, 102, 0.62), 0 10px 24px rgba(0, 0, 0, 0.5)',
  boxSizing: 'border-box',
};

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
  // Padding included, so the panel fits inside a phone screen.
  width: 'min(100%, 456px)',
  maxHeight: 'min(90vh, 720px)',
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
  boxSizing: 'border-box',
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
  ...simpleFrameStyle({ background: 'rgba(8, 5, 4, 0.72)', opacity: 0.59 }),
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
  boxSizing: 'border-box',
};

const linkButtonStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  ...simpleFrameStyle({ background: 'rgba(51, 0, 0, 0.82)', opacity: 0.94 }),
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
  ...simpleFrameStyle({ background: 'rgba(8, 5, 4, 0.55)', color: 'rgb(140, 230, 160)', opacity: 0.59 }),
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

const progressLineStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.84rem',
  textAlign: 'center',
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.05rem',
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
  textAlign: 'center',
};

const soulListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 6,
};

const soulRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 10,
  padding: '8px 12px',
  ...simpleFrameStyle({ background: 'rgba(8, 5, 4, 0.55)', opacity: 0.5 }),
};

const soulNameStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontSize: '0.95rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const soulStateStyle: CSSProperties = {
  margin: 0,
  flexShrink: 0,
  color: 'rgba(247, 239, 224, 0.72)',
  fontSize: '0.8rem',
};

const soulDeliveredStyle: CSSProperties = {
  ...soulStateStyle,
  color: 'rgba(140, 230, 160, 0.92)',
};

const shareButtonStyle: CSSProperties = {
  ...linkButtonStyle,
  width: 'min(100%, 240px)',
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
  const [linkedSouls, setLinkedSouls] = useState<LinkedSoulDto[]>([]);
  const [encountersToday, setEncountersToday] = useState(0);
  const [encountersRequired, setEncountersRequired] = useState(42);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const inviteQr = useMemo(() => (playerId ? qrPath(soulLinkInviteUrl(playerId)) : null), [playerId]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setQuery('');
      setStatusMessage(null);
      setShareMessage(null);
      return;
    }

    // Shown once the pictures inside are loaded; the opening button pulses meanwhile.
    const cancelReveal = revealMenuWhenReady(
      null,
      () => document.querySelector('[data-morkahja-menu="soul-link"]'),
      () => {
        setVisible(true);
      },
    );

    setLoadPending(true);
    let cancelled = false;

    void fetchSoulLink()
      .then((response) => {
        if (!cancelled) {
          setSoulLink(response.soulLink);
          setLinkedSouls(response.linkedSouls ?? []);
          setEncountersToday(response.encountersToday ?? 0);
          setEncountersRequired(response.encountersRequired ?? 42);
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
      cancelReveal();
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

  async function handleShare(): Promise<void> {
    if (!playerId) {
      return;
    }
    playSfx(DEFAULT_BUTTON_SOUND);
    const outcome = await shareInviteLink(soulLinkInviteUrl(playerId));
    setShareMessage(
      outcome === 'copied'
        ? 'Link copied. Send it to a new adventurer.'
        : outcome === 'failed'
          ? 'Could not copy the link here. Let them scan the code instead.'
          : null,
    );
  }

  if (!open) {
    return null;
  }

  const selfQuery = isSelfSoulLinkQuery(query, playerId, playerName);

  return (
    <div
      data-morkahja-menu="soul-link"
      aria-label="Soul Link"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <section
        aria-labelledby="soul-link-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={framedStyle(panelStyle)}
      >
        <LineFrame background={panelStyle.background} />
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
              {soulLink.giftDeliveredAt !== undefined ? (
                <p style={progressLineStyle}>
                  {soulLink.welcomeGift === 'aetherion'
                    ? 'Gift of the Gods delivered. Aetherion is yours.'
                    : 'Gift of the Gods delivered.'}
                </p>
              ) : (
                <p style={progressLineStyle}>
                  {giftProgressLine(
                    encountersToday,
                    soulLink.targetEncountersToday ?? 0,
                    soulLink.targetName,
                    encountersRequired,
                  )}
                </p>
              )}
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
          {inviteQr ? (
            <div style={inviteStyle}>
              <svg
                aria-label="Soul Link QR code"
                role="img"
                shapeRendering="crispEdges"
                style={qrStyle}
                viewBox={`0 0 ${inviteQr.size} ${inviteQr.size}`}
              >
                <path d={inviteQr.path} fill="#4a0505" />
              </svg>
              <button
                aria-label="Share your Soul Link"
                onClick={() => {
                  void handleShare();
                }}
                style={shareButtonStyle}
                type="button"
              >
                Share
              </button>
              {shareMessage ? <p style={messageStyle}>{shareMessage}</p> : null}
              <p style={messageStyle}>{SOUL_LINK_INVITE_TEXT}</p>
            </div>
          ) : null}
          {linkedSouls.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <h3 style={sectionTitleStyle}>Souls linked to you</h3>
              <ul aria-label="Souls linked to you" style={soulListStyle}>
                {linkedSouls.map((soul) => (
                  <li key={soul.playerId} style={soulRowStyle}>
                    <p style={soulNameStyle}>{soul.playerName}</p>
                    {soul.giftDeliveredAt !== undefined ? (
                      <p style={soulDeliveredStyle}>Gift delivered</p>
                    ) : (
                      <p style={soulStateStyle}>
                        {`Today ${Math.min(soul.encountersToday, encountersRequired)}/${encountersRequired} · you ${Math.min(encountersToday, encountersRequired)}/${encountersRequired}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default SoulLinkOverlay;
