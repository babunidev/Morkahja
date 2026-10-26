import { useEffect, useState, type CSSProperties } from 'react';
import { donateGems, fetchPlayer } from '../../api/http.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { PanelButton } from '../common/PanelButton.js';
import { useTooltipReveal } from '../hooks/useTooltipReveal.js';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const OVERLAY_FADE_MS = 300;
const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';
const PAYPAL_DEVELOPER_URL = 'https://www.paypal.com/paypalme/babunigaming';
const DEVELOPER_DONATION_TOOLTIP = (
  'All donations go directly into the ongoing maintenance, development, and improvement '
  + 'of Morkahja. Funds are used to support server costs, new features, system stability, '
  + 'and continuous expansion of the game world. This will open an external website.'
);

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

const donateButtonVisualStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 42,
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '1rem',
  letterSpacing: '0.04em',
  textAlign: 'center',
};

const donateButtonDisabledVisualStyle: CSSProperties = {
  ...donateButtonVisualStyle,
  opacity: 0.42,
};

const messageStyle: CSSProperties = {
  margin: 0,
  fontSize: '0.9rem',
  lineHeight: 1.45,
};

const directDonateSectionStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  paddingTop: 12,
  borderTop: '1px solid rgba(255, 204, 102, 0.32)',
};

const directDonateButtonWrapStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  width: '100%',
};

const fullWidthPanelButtonStyle: CSSProperties = {
  width: '100%',
};

const directDonateTooltipStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 'calc(100% + 10px)',
  transform: 'translateX(-50%)',
  width: 'min(300px, 92vw)',
  padding: '10px 12px',
  border: '1px solid rgba(255, 204, 102, 0.45)',
  borderRadius: 9,
  background: 'rgba(8, 5, 4, 0.96)',
  color: 'rgba(247, 239, 224, 0.9)',
  fontSize: '0.82rem',
  lineHeight: 1.45,
  textAlign: 'center',
  pointerEvents: 'none',
  boxShadow: '0 8px 18px rgba(0, 0, 0, 0.45)',
  boxSizing: 'border-box',
  zIndex: 10,
};

function formatGemCount(count: number): string {
  return count === 1 ? '1 yellow red gem' : `${count} yellow red gems`;
}

function openDeveloperPaypalDonation(): void {
  playSfx(DEFAULT_BUTTON_SOUND);
  window.open(PAYPAL_DEVELOPER_URL, '_blank', 'noopener,noreferrer');
}

function DirectDeveloperDonateSection() {
  const { visible: showTooltip, handlers: tooltipHandlers } = useTooltipReveal(true);

  return (
    <div style={directDonateSectionStyle}>
      <div style={directDonateButtonWrapStyle}>
        <span
          id="direct-developer-donate-tooltip"
          role="tooltip"
          style={{
            ...directDonateTooltipStyle,
            opacity: showTooltip ? 1 : 0,
            visibility: showTooltip ? 'visible' : 'hidden',
          }}
        >
          {DEVELOPER_DONATION_TOOLTIP}
        </span>
        <PanelButton
          aria-describedby="direct-developer-donate-tooltip"
          onClick={openDeveloperPaypalDonation}
          pressKey="donate-paypal"
          style={fullWidthPanelButtonStyle}
          visualStyle={donateButtonVisualStyle}
          {...tooltipHandlers}
        >
          Donate directly to Babuni.dev
        </PanelButton>
      </div>
    </div>
  );
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
          <ClosePanelButton
            disabled={donatePending}
            onClose={onClose}
            pressKey="donate-close"
          />
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
              Support the team with yellow red gems from your treasury.
            </p>
            <div style={buttonGridStyle}>
              {DONATION_PRESETS.map((preset) => {
                const enabled = !donatePending && gemBalance >= preset.amount;

                return (
                  <PanelButton
                    aria-disabled={!enabled}
                    disabled={!enabled}
                    key={preset.amount}
                    onClick={() => {
                      void handleDonate(preset.amount);
                    }}
                    pressKey={`donate-gems-${preset.amount}`}
                    style={fullWidthPanelButtonStyle}
                    visualStyle={enabled ? donateButtonVisualStyle : donateButtonDisabledVisualStyle}
                  >
                    {preset.label}
                  </PanelButton>
                );
              })}
              <PanelButton
                aria-disabled={donatePending || gemBalance <= 0}
                disabled={donatePending || gemBalance <= 0}
                onClick={() => {
                  void handleDonate(gemBalance);
                }}
                pressKey="donate-gems-all"
                style={fullWidthPanelButtonStyle}
                visualStyle={
                  !donatePending && gemBalance > 0
                    ? donateButtonVisualStyle
                    : donateButtonDisabledVisualStyle
                }
              >
                All my gems
              </PanelButton>
            </div>
          </>
        )}
        <DirectDeveloperDonateSection />
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
