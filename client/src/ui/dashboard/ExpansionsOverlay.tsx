import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { fetchPlayer, unlockExpansion } from '../../api/http.js';
import expansionData from '../../data/game/expansiondata.json';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const EXPANSION_UI_ROOT = '/UI/03_DASHBOARD/expansions';
const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';
const OVERLAY_FADE_MS = 300;

interface ExpansionRecord {
  mExtensioActive: boolean;
  mExtensioCollectionImage: string;
  mExtensioCost: number;
  mExtensioHeaderImage: string;
  mExtensioID: number;
  mExtensioName: string;
  mExtensioReward: number;
  mExtensioSummaryText: string;
  mExtensioText: string;
  mExtensioUnlockButton: string;
}

function expansionAsset(assetName: string): string {
  return `${EXPANSION_UI_ROOT}/${assetName}.webp`;
}

function loadExpansionList(): ExpansionRecord[] {
  const records = (expansionData as { expansions: Record<string, ExpansionRecord> }).expansions;

  return Object.values(records).sort((left, right) => {
    if (left.mExtensioActive !== right.mExtensioActive) {
      return left.mExtensioActive ? -1 : 1;
    }

    return left.mExtensioID - right.mExtensioID;
  });
}

function formatGemCount(count: number): string {
  return count === 1 ? '1 yellow red gem' : `${count} yellow red gems`;
}

function unlockErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unlock failed';

  if (message.includes('INSUFFICIENT_GEMS')) {
    return 'Not enough gems to unlock this expansion.';
  }

  if (message.includes('EXPANSION_ALREADY_UNLOCKED')) {
    return 'This expansion is already unlocked.';
  }

  if (message.includes('EXPANSION_INACTIVE')) {
    return 'This expansion is not available yet.';
  }

  if (message.includes('EXPANSION_NOT_FOUND')) {
    return 'Expansion could not be found.';
  }

  return message;
}

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
  width: 'min(92vw, 440px)',
  maxHeight: 'min(86vh, 640px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
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
  padding: '4px 2px 2px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  ...protectedOverlayTextStyle,
};

const listStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
};

const statusMessageStyle: CSSProperties = {
  margin: '0 0 10px',
  color: 'rgba(247, 239, 224, 0.9)',
  fontSize: '0.88rem',
  lineHeight: 1.45,
  textAlign: 'center',
};

const errorMessageStyle: CSSProperties = {
  ...statusMessageStyle,
  color: '#ffb0a8',
};

const gemsFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  paddingTop: 8,
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

const cardStyle: CSSProperties = {
  border: '1px solid rgba(255, 204, 102, 0.38)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
  overflow: 'hidden',
};

const inactiveCardStyle: CSSProperties = {
  opacity: 0.78,
};

const unlockedCardStyle: CSSProperties = {
  borderColor: 'rgba(120, 220, 140, 0.45)',
};

const cardHeaderButtonStyle: CSSProperties = {
  width: '100%',
  display: 'grid',
  gap: 10,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
};

const bannerImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  objectFit: 'cover',
};

const cardTextBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: '0 14px 12px',
};

const nameStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.12rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
  lineHeight: 1.25,
};

const summaryStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.94)',
  fontSize: '0.92rem',
  lineHeight: 1.45,
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
};

const costStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  margin: 0,
  color: '#ffcc66',
  fontSize: '0.9rem',
  fontWeight: 700,
};

const gemsIconSmallStyle: CSSProperties = {
  width: 22,
  height: 22,
  objectFit: 'contain',
  filter: 'drop-shadow(0 0 6px rgba(255, 204, 102, 0.45))',
};

const statusStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.72)',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const unlockedLabelStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(140, 230, 160, 0.92)',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const expandHintStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.72)',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const cardBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '0 14px 14px',
};

const bodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.82)',
  fontSize: '0.88rem',
  lineHeight: 1.55,
};

const unlockButtonStyle: CSSProperties = {
  width: 'min(100%, 220px)',
  justifySelf: 'center',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const unlockButtonDisabledStyle: CSSProperties = {
  ...unlockButtonStyle,
  cursor: 'default',
  opacity: 0.45,
};

const unlockButtonImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.5))',
};

function ExpansionCard({
  expansion,
  expanded,
  gemBalance,
  unlockPending,
  unlocked,
  onToggle,
  onUnlock,
}: {
  expansion: ExpansionRecord;
  expanded: boolean;
  gemBalance: number;
  unlockPending: boolean;
  unlocked: boolean;
  onToggle: () => void;
  onUnlock: () => void;
}) {
  const headerId = `expansion-${expansion.mExtensioID}-header`;
  const bodyId = `expansion-${expansion.mExtensioID}-body`;
  const canAfford = gemBalance >= expansion.mExtensioCost;
  const unlockEnabled = expansion.mExtensioActive && !unlocked && canAfford && !unlockPending;

  return (
    <article
      style={{
        ...cardStyle,
        ...(expansion.mExtensioActive ? null : inactiveCardStyle),
        ...(unlocked ? unlockedCardStyle : null),
      }}
    >
      <button
        aria-controls={bodyId}
        aria-expanded={expanded}
        id={headerId}
        onClick={() => {
          playSfx(DEFAULT_BUTTON_SOUND);
          onToggle();
        }}
        style={cardHeaderButtonStyle}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          {...protectedImageProps}
          src={expansionAsset(expansion.mExtensioHeaderImage)}
          style={bannerImageStyle}
        />
        <div style={cardTextBlockStyle}>
          <h3 style={nameStyle}>{expansion.mExtensioName}</h3>
          <p style={summaryStyle}>{expansion.mExtensioSummaryText}</p>
          <div style={metaRowStyle}>
            {!expansion.mExtensioActive ? (
              <p style={statusStyle}>Coming soon</p>
            ) : unlocked ? (
              <p style={unlockedLabelStyle}>Unlocked</p>
            ) : (
              <p style={costStyle}>
                <img alt="" aria-hidden="true" {...protectedImageProps} src={GEMS_ICON} style={gemsIconSmallStyle} />
                <span>{expansion.mExtensioCost} gems</span>
              </p>
            )}
            <p style={expandHintStyle}>{expanded ? 'Show less' : 'Read more'}</p>
          </div>
        </div>
      </button>
      {expanded ? (
        <div aria-labelledby={headerId} id={bodyId} style={cardBodyStyle}>
          <p style={bodyTextStyle}>{expansion.mExtensioText}</p>
          {expansion.mExtensioActive && !unlocked ? (
            <button
              aria-label={`Unlock ${expansion.mExtensioName} for ${expansion.mExtensioCost} gems`}
              disabled={!unlockEnabled}
              onClick={(event) => {
                event.stopPropagation();
                if (!unlockEnabled) {
                  return;
                }

                playSfx(DEFAULT_BUTTON_SOUND);
                onUnlock();
              }}
              style={unlockEnabled ? unlockButtonStyle : unlockButtonDisabledStyle}
              type="button"
            >
              <img
                alt=""
                aria-hidden="true"
                {...protectedImageProps}
                src={expansionAsset(expansion.mExtensioUnlockButton)}
                style={unlockButtonImageStyle}
              />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function ExpansionsOverlay({
  onClose,
  open,
  playerId,
}: {
  onClose: () => void;
  open: boolean;
  playerId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [yellowRedGems, setYellowRedGems] = useState(0);
  const [unlockedExpansionIds, setUnlockedExpansionIds] = useState<number[]>([0]);
  const [unlockPending, setUnlockPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const expansions = useMemo(() => loadExpansionList(), []);

  const refreshPlayer = useCallback(async (): Promise<void> => {
    if (!playerId) {
      setYellowRedGems(0);
      setUnlockedExpansionIds([0]);
      setLoadError('Sign in to unlock expansions.');
      return;
    }

    try {
      const player = await fetchPlayer(null);
      setYellowRedGems(player.currencies?.yellow_red_gem ?? 0);
      setUnlockedExpansionIds(player.unlockedExpansions ?? [0]);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load player');
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      setExpandedIds(new Set());
      setUnlockPending(false);
      setStatusMessage(null);
      setLoadError(null);
      return;
    }

    const showTimer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(showTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void refreshPlayer().catch((error) => {
      if (!cancelled) {
        setLoadError(error instanceof Error ? error.message : 'Could not load player');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, refreshPlayer]);

  function toggleExpansion(id: number): void {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function handleUnlock(expansionId: number, expansionName: string): Promise<void> {
    if (unlockPending || unlockedExpansionIds.includes(expansionId)) {
      return;
    }

    setUnlockPending(true);
    setStatusMessage(null);

    try {
      const result = await unlockExpansion(expansionId);
      setYellowRedGems(result.currencies.yellow_red_gem ?? 0);
      setUnlockedExpansionIds(result.unlockedExpansions);
      setStatusMessage(`${expansionName} unlocked.`);
    } catch (error) {
      setStatusMessage(unlockErrorMessage(error));
    } finally {
      setUnlockPending(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div
      aria-label="Expansions"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="expansions-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="expansions-overlay-title" style={titleStyle}>
            EXPANSIONS
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="expansions-close" />
        </header>
        <div data-expansions-scroll="" style={bodyStyle}>
          <style>
            {'[data-expansions-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          {loadError ? <p style={errorMessageStyle}>{loadError}</p> : null}
          {statusMessage ? (
            <p style={statusMessage.includes('unlocked') ? statusMessageStyle : errorMessageStyle}>
              {statusMessage}
            </p>
          ) : null}
          <div style={listStyle}>
            {expansions.map((expansion) => (
              <ExpansionCard
                key={expansion.mExtensioID}
                expanded={expandedIds.has(expansion.mExtensioID)}
                expansion={expansion}
                gemBalance={yellowRedGems}
                onToggle={() => {
                  toggleExpansion(expansion.mExtensioID);
                }}
                onUnlock={() => {
                  void handleUnlock(expansion.mExtensioID, expansion.mExtensioName);
                }}
                unlockPending={unlockPending}
                unlocked={unlockedExpansionIds.includes(expansion.mExtensioID)}
              />
            ))}
          </div>
        </div>
        <footer aria-label="Yellow red gems" style={gemsFooterStyle}>
          <img
            alt=""
            aria-hidden="true"
            {...protectedImageProps}
            src={GEMS_ICON}
            style={gemsIconStyle}
          />
          <p style={gemsCountStyle}>{formatGemCount(yellowRedGems)}</p>
        </footer>
      </section>
    </div>
  );
}

export default ExpansionsOverlay;
