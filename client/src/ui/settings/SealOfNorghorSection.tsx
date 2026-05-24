import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { PlayerResponse, SealOfNorghorStatusDto } from '@shared/contracts';
import { activateSealOfNorghor, fetchPlayer } from '../../api/http.js';
import { PanelButton } from '../common/PanelButton.js';
import { protectedImageProps } from '../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const SEAL_IMAGE = '/UI/06_SettingsMenu/Seal of Norghor.webp';
const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';

const SEAL_LORE_INTRO = 'As the chosen one to hold the Seal of the mighty Dragon Norghor, you shall be granted passage into the vast and mystical realm of Morkahja. But do not think this boon comes without a price. To attain this priceless artefact, you must part with your precious gems. And remember, to keep the Seal in your possession, you must offer up an equal sum every moon cycle.';

const SEAL_LORE_REWARD = 'Unlock access to all expansions and rare encounters in Morkahja.';

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '14px 12px',
  border: '1px solid rgba(255, 204, 102, 0.34)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
  justifyItems: 'center',
  textAlign: 'center',
};

const headingRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px 12px',
  width: '100%',
};

const headingStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: '1.38rem',
  letterSpacing: '0.06em',
  lineHeight: 1.2,
};

const priceStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  fontSize: '0.96rem',
  whiteSpace: 'nowrap',
};

const gemsIconStyle: CSSProperties = {
  width: 22,
  height: 22,
  objectFit: 'contain',
};

const sealImageStyle: CSSProperties = {
  display: 'block',
  width: 'min(100%, 200px)',
  margin: '0 auto',
  objectFit: 'contain',
  filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.55))',
};

const loreBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  width: '100%',
  maxWidth: 360,
};

const loreStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.9)',
  fontFamily: 'Georgia, serif',
  fontSize: '0.94rem',
  lineHeight: 1.5,
  textAlign: 'center',
};

const loreRewardPromoStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  maxWidth: 360,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.96rem',
  lineHeight: 1.45,
  textAlign: 'center',
};

const loreToggleStyle: CSSProperties = {
  margin: 0,
  padding: '6px 12px',
  border: '1px solid rgba(255, 204, 102, 0.45)',
  borderRadius: 8,
  background: 'rgba(51, 0, 0, 0.55)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.9rem',
  lineHeight: 1.3,
  cursor: 'pointer',
  textAlign: 'center',
};

const noticeStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.72)',
  fontFamily: 'Georgia, serif',
  fontSize: '0.86rem',
  lineHeight: 1.45,
  textAlign: 'center',
};

const activeNoticeStyle: CSSProperties = {
  ...noticeStyle,
  color: '#ffcc66',
};

const messageStyle: CSSProperties = {
  margin: 0,
  width: '100%',
  color: '#ffb4a8',
  fontFamily: 'Georgia, serif',
  fontSize: '0.82rem',
  lineHeight: 1.35,
  textAlign: 'center',
};

const successMessageStyle: CSSProperties = {
  ...messageStyle,
  color: 'rgba(247, 239, 224, 0.88)',
};

const actionButtonVisualStyle: CSSProperties = {
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
  fontSize: '0.95rem',
  textAlign: 'center',
};

function formatExpiry(expiresAt: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(expiresAt));
}

function readYellowRedGemBalance(currencies: PlayerResponse['currencies'] | undefined): number {
  const gems = currencies?.yellow_red_gem;

  if (typeof gems === 'number' && Number.isFinite(gems)) {
    return Math.max(0, Math.floor(gems));
  }

  if (typeof gems === 'string') {
    const parsed = Number(gems);

    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }

  return 0;
}

function activationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Could not activate the Seal.';

  if (message.includes('SEAL_ALREADY_ACTIVE')) {
    return 'The Seal of Norghor is already in your possession.';
  }

  if (message.includes('INSUFFICIENT_GEMS')) {
    return 'Not enough gems to hold the Seal of Norghor.';
  }

  return message;
}

export function SealOfNorghorSection({ open }: { open: boolean }) {
  const [status, setStatus] = useState<SealOfNorghorStatusDto | null>(null);
  const [yellowRedGems, setYellowRedGems] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loreExpanded, setLoreExpanded] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const player = await fetchPlayer(null);
      const gemBalance = readYellowRedGemBalance(player.currencies);
      const seal = player.sealOfNorghor;
      const cost = seal?.cost ?? 67;

      setYellowRedGems(gemBalance);
      setStatus(seal
        ? {
            ...seal,
            gemBalance,
            canActivate: !seal.active && gemBalance >= cost,
          }
        : {
            active: false,
            expiresAt: null,
            cost,
            durationDays: 28,
            gemBalance,
            canActivate: gemBalance >= cost,
          });
    } catch (error) {
      console.error('Seal of Norghor status refresh failed', error);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setLoreExpanded(false);
      return;
    }

    void refreshStatus();

    const onFocus = () => {
      void refreshStatus();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [open, refreshStatus]);

  async function handleActivate(): Promise<void> {
    if (busy || status?.active || !canActivate) {
      return;
    }

    playSfx(DEFAULT_BUTTON_SOUND);
    setBusy(true);
    setMessage(null);

    try {
      const result = await activateSealOfNorghor();
      const gemBalance = readYellowRedGemBalance(result.currencies);

      setYellowRedGems(gemBalance);
      setStatus({
        ...result.sealOfNorghor,
        gemBalance,
      });
      setMessage(`The Seal of Norghor is yours until ${formatExpiry(result.sealOfNorghor.expiresAt ?? Date.now())}.`);
    } catch (error) {
      setMessage(activationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const cost = status?.cost ?? 67;
  const durationDays = status?.durationDays ?? 28;
  const gemBalance = yellowRedGems;
  const canActivate = !status?.active && gemBalance >= cost;
  const paymentNotice = `One payment grants ${durationDays} days of passage. The Seal cannot be cancelled and does not auto-renew.`;

  return (
    <section aria-labelledby="seal-of-norghor-title" style={sectionStyle}>
      <div style={headingRowStyle}>
        <h3 id="seal-of-norghor-title" style={headingStyle}>
          Seal of Norghor
        </h3>
        <span style={priceStyle}>
          <img alt="" aria-hidden="true" {...protectedImageProps} src={GEMS_ICON} style={gemsIconStyle} />
          {cost} gems / {durationDays} days
        </span>
      </div>
      <img
        alt="Seal of Norghor"
        {...protectedImageProps}
        src={SEAL_IMAGE}
        style={sealImageStyle}
      />
      <button
        aria-expanded={loreExpanded}
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          setLoreExpanded((current) => !current);
        }}
        style={loreToggleStyle}
        type="button"
      >
        {loreExpanded ? 'Hide tale' : 'Read the tale of the Seal'}
      </button>
      {loreExpanded ? (
        <div style={loreBlockStyle}>
          <p style={loreStyle}>{SEAL_LORE_INTRO}</p>
          <p style={noticeStyle}>{paymentNotice}</p>
        </div>
      ) : null}
      {status?.active && status.expiresAt ? (
        <p style={activeNoticeStyle}>
          Active until {formatExpiry(status.expiresAt)}. You may purchase another term after it expires.
        </p>
      ) : null}
      {message ? (
        <p style={message.startsWith('The Seal') ? successMessageStyle : messageStyle}>{message}</p>
      ) : null}
      {!status?.active ? (
        <>
          <p style={loreRewardPromoStyle}>{SEAL_LORE_REWARD}</p>
          <PanelButton
          aria-label={
            busy
              ? 'Binding the Seal'
              : `Hold the Seal for ${gemBalance} of ${cost} gems`
          }
          disabled={busy || !canActivate}
          onClick={() => {
            void handleActivate();
          }}
          pressKey="settings-seal-activate"
          style={{ width: '100%' }}
          visualStyle={{
            ...actionButtonVisualStyle,
            opacity: busy || !canActivate ? 0.5 : 1,
          }}
        >
          {busy ? 'Binding the Seal…' : `Hold the Seal — ${gemBalance}/${cost} gems`}
        </PanelButton>
        </>
      ) : null}
    </section>
  );
}

export default SealOfNorghorSection;
