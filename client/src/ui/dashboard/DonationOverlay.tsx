import { useEffect, useState, type CSSProperties } from 'react';
import { donateGems, fetchPlayer } from '../../api/http.js';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const OVERLAY_FADE_MS = 300;
const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';

const DONATION_PRESETS = [
  { label: '10 gems', amount: 10 },
  { label: '50 gems', amount: 50 },
  { label: '100 gems', amount: 100 },
] as const;

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
  width: 'min(92vw, 380px)',
  display: 'grid',
  gap: 14,
  padding: '20px 18px 18px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.94)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
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
  fontSize: '1.35rem',
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

const gemsRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  padding: '8px 0 4px',
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
};

const introStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.86)',
  fontSize: '0.92rem',
  lineHeight: 1.5,
};

const buttonGridStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
};

const donateButtonStyle: CSSProperties = {
  minHeight: 42,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  cursor: 'pointer',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
  letterSpacing: '0.04em',
};

const donateButtonDisabledStyle: CSSProperties = {
  ...donateButtonStyle,
  opacity: 0.42,
  cursor: 'default',
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  lineHeight: 1.45,
};

function formatGemCount(count: number): string {
  return count === 1 ? '1 yellow red gem' : `${count} yellow red gems`;
}

export function DonationOverlay({
  onClose,
  onDonated,
  open,
}: {
  onClose: () => void;
  onDonated?: (gemBalance: number) => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [gemBalance, setGemBalance] = useState(0);
  const [donatePending, setDonatePending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setLoadError(null);
      setStatusMessage(null);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    let cancelled = false;

    void (async () => {
      try {
        const player = await fetchPlayer(null);
        if (!cancelled) {
          setGemBalance(player.currencies?.yellow_red_gem ?? 0);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Could not load gems');
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, [open]);

  async function handleDonate(amount: number): Promise<void> {
    if (donatePending || amount <= 0 || gemBalance < amount) {
      return;
    }

    setDonatePending(true);
    setStatusMessage(null);
    playSfx(DEFAULT_BUTTON_SOUND);

    try {
      const result = await donateGems(amount);
      const nextBalance = result.currencies.yellow_red_gem ?? 0;
      setGemBalance(nextBalance);
      setStatusMessage(
        result.donated === 1
          ? 'Thank you — 1 gem donated to the team.'
          : `Thank you — ${result.donated} gems donated to the team.`,
      );
      onDonated?.(nextBalance);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Donation failed';
      setStatusMessage(
        message.includes('INSUFFICIENT_GEMS')
          ? 'Not enough gems for that donation.'
          : message,
      );
    } finally {
      setDonatePending(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Donate gems"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="donation-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="donation-overlay-title" style={titleStyle}>DONATE</h2>
          <button
            disabled={donatePending}
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
        {loadError ? (
          <p style={{ ...messageStyle, color: '#ffb0a8' }}>{loadError}</p>
        ) : (
          <>
            <div aria-label="Your gems" style={gemsRowStyle}>
              <img
                alt=""
                aria-hidden="true"
                {...protectedImageProps}
                src={GEMS_ICON}
                style={gemsIconStyle}
              />
              <p style={gemsCountStyle}>{formatGemCount(gemBalance)}</p>
            </div>
            <p style={introStyle}>
              Support the team with yellow red gems from your balance.
            </p>
            <div style={buttonGridStyle}>
              {DONATION_PRESETS.map((preset) => {
                const enabled = !donatePending && gemBalance >= preset.amount;

                return (
                  <button
                    key={preset.amount}
                    aria-disabled={!enabled}
                    disabled={!enabled}
                    onClick={() => {
                      void handleDonate(preset.amount);
                    }}
                    style={enabled ? donateButtonStyle : donateButtonDisabledStyle}
                    type="button"
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                aria-disabled={donatePending || gemBalance <= 0}
                disabled={donatePending || gemBalance <= 0}
                onClick={() => {
                  void handleDonate(gemBalance);
                }}
                style={
                  !donatePending && gemBalance > 0
                    ? donateButtonStyle
                    : donateButtonDisabledStyle
                }
                type="button"
              >
                All my gems
              </button>
            </div>
          </>
        )}
        {statusMessage ? (
          <p
            style={{
              ...messageStyle,
              color: statusMessage.startsWith('Thank')
                ? 'rgba(200, 255, 200, 0.92)'
                : '#ffb0a8',
            }}
          >
            {statusMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}

export default DonationOverlay;
