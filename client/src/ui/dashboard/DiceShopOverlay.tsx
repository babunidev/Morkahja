import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import type { DiceId } from '@shared/contracts';
import {
  DICE_CATALOG,
  DICE_UNLOCK_GEM_COST,
  DEFAULT_DICE_ID,
} from '@shared/diceCatalog.js';
import { fetchPlayer, unlockDice } from '../../api/http.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { PanelButton } from '../common/PanelButton.js';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';
const OVERLAY_FADE_MS = 300;

function unlockErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unlock failed';

  if (message.includes('INSUFFICIENT_GEMS')) {
    return 'Not enough gems to unlock this die.';
  }

  if (message.includes('DICE_ALREADY_UNLOCKED')) {
    return 'This die is already unlocked.';
  }

  if (message.includes('DICE_NOT_FOUND')) {
    return 'Die could not be found.';
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

const cardStyle: CSSProperties = {
  border: '1px solid rgba(255, 204, 102, 0.38)',
  borderRadius: 10,
  background: 'rgba(8, 5, 4, 0.55)',
  overflow: 'hidden',
};

const unlockedCardStyle: CSSProperties = {
  borderColor: 'rgba(120, 220, 140, 0.45)',
};

const cardBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '12px 14px 14px',
};

const cardHeaderStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 12,
  alignItems: 'center',
};

const diePreviewStyle: CSSProperties = {
  width: 72,
  height: 72,
  objectFit: 'contain',
  filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.55))',
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

const unlockActionsRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  width: '100%',
};

const expansionPanelButtonStyle: CSSProperties = {
  width: '100%',
};

const expansionButtonVisualStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minHeight: 42,
  padding: '8px 10px',
  border: '1px solid rgba(255, 204, 102, 0.72)',
  borderRadius: 9,
  background: 'rgba(51, 0, 0, 0.82)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: '0.95rem',
  letterSpacing: '0.04em',
  lineHeight: 1.2,
  textAlign: 'center',
};

const expansionButtonDisabledVisualStyle: CSSProperties = {
  ...expansionButtonVisualStyle,
  opacity: 0.42,
};

const unlockButtonLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const gemsIconSmallStyle: CSSProperties = {
  width: 22,
  height: 22,
  objectFit: 'contain',
  filter: 'drop-shadow(0 0 6px rgba(255, 204, 102, 0.45))',
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

function formatGemCount(count: number): string {
  return count === 1 ? '1 yellow red gem' : `${count} yellow red gems`;
}

function DiceCard({
  diceId,
  gemBalance,
  label,
  assetPath,
  unlocked,
  unlockPending,
  onUnlock,
}: {
  diceId: DiceId;
  gemBalance: number;
  label: string;
  assetPath: string;
  unlocked: boolean;
  unlockPending: boolean;
  onUnlock: () => void;
}) {
  const isDefault = diceId === DEFAULT_DICE_ID;
  const unlockEnabled = !unlocked
    && !unlockPending
    && !isDefault
    && gemBalance >= DICE_UNLOCK_GEM_COST;
  const showUnlockActions = !unlocked && !isDefault;

  return (
    <article
      style={{
        ...cardStyle,
        ...(unlocked ? unlockedCardStyle : {}),
      }}
    >
      <div style={cardBodyStyle}>
        <div style={cardHeaderStyle}>
          <img
            alt=""
            aria-hidden="true"
            {...protectedImageProps}
            src={assetPath}
            style={diePreviewStyle}
          />
          <h3 style={nameStyle}>{label}</h3>
        </div>
        {showUnlockActions ? (
          <div style={unlockActionsRowStyle}>
            <PanelButton
              aria-label={`Unlock ${label} for ${DICE_UNLOCK_GEM_COST} gems`}
              disabled={!unlockEnabled}
              onClick={(event) => {
                event.stopPropagation();

                if (!unlockEnabled) {
                  return;
                }

                playSfx(DEFAULT_BUTTON_SOUND);
                onUnlock();
              }}
              pressKey={`dice-unlock-gems-${diceId}`}
              style={expansionPanelButtonStyle}
              visualStyle={
                unlockEnabled
                  ? expansionButtonVisualStyle
                  : expansionButtonDisabledVisualStyle
              }
            >
              <span style={unlockButtonLabelStyle}>
                Unlock
                <img
                  alt=""
                  aria-hidden="true"
                  {...protectedImageProps}
                  src={GEMS_ICON}
                  style={gemsIconSmallStyle}
                />
              </span>
            </PanelButton>
            <PanelButton
              aria-label={`Unlock ${label} with purchase`}
              disabled
              pressKey={`dice-unlock-cash-${diceId}`}
              style={expansionPanelButtonStyle}
              visualStyle={expansionButtonDisabledVisualStyle}
            >
              Unlock $
            </PanelButton>
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function DiceShopOverlay({
  onClose,
  onPlayerUpdated,
  open,
  playerId,
}: {
  onClose: () => void;
  onPlayerUpdated?: () => void;
  open: boolean;
  playerId: string;
}) {
  const [visible, setVisible] = useState(false);
  const [yellowRedGems, setYellowRedGems] = useState(0);
  const [unlockedDiceIds, setUnlockedDiceIds] = useState<DiceId[]>([DEFAULT_DICE_ID]);
  const [unlockPending, setUnlockPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshPlayer = useCallback(async (): Promise<void> => {
    if (!playerId) {
      setYellowRedGems(0);
      setUnlockedDiceIds([DEFAULT_DICE_ID]);
      setLoadError('Sign in to unlock dice.');
      return;
    }

    try {
      const player = await fetchPlayer(null);
      setYellowRedGems(player.currencies?.yellow_red_gem ?? 0);
      setUnlockedDiceIds(player.unlockedDiceIds ?? [DEFAULT_DICE_ID]);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load player');
    }
  }, [playerId]);

  useEffect(() => {
    if (!open) {
      setVisible(false);
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

  async function handleUnlock(diceId: DiceId, label: string): Promise<void> {
    if (unlockPending || unlockedDiceIds.includes(diceId)) {
      return;
    }

    setUnlockPending(true);
    setStatusMessage(null);

    try {
      const result = await unlockDice(diceId);
      setYellowRedGems(result.currencies.yellow_red_gem ?? 0);
      setUnlockedDiceIds(result.unlockedDiceIds);
      setStatusMessage(`${label} unlocked.`);
      onPlayerUpdated?.();
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
      aria-label="Dice shop"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
      }}
    >
      <section
        aria-labelledby="dice-shop-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={panelStyle}
      >
        <header style={headerStyle}>
          <h2 id="dice-shop-overlay-title" style={titleStyle}>
            DICE
          </h2>
          <ClosePanelButton onClose={onClose} pressKey="dice-shop-close" />
        </header>
        <div data-dice-shop-scroll="" style={bodyStyle}>
          <style>
            {'[data-dice-shop-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          {loadError ? <p style={errorMessageStyle}>{loadError}</p> : null}
          {statusMessage ? (
            <p style={statusMessage.includes('unlocked') ? statusMessageStyle : errorMessageStyle}>
              {statusMessage}
            </p>
          ) : null}
          <div style={listStyle}>
            {DICE_CATALOG.map((entry) => (
              <DiceCard
                assetPath={entry.assetPath}
                diceId={entry.id}
                gemBalance={yellowRedGems}
                key={entry.id}
                label={entry.label}
                onUnlock={() => {
                  void handleUnlock(entry.id, entry.label);
                }}
                unlockPending={unlockPending}
                unlocked={unlockedDiceIds.includes(entry.id)}
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

export default DiceShopOverlay;
