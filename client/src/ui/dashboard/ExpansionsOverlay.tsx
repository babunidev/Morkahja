import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { createCheckoutSession, fetchPlayer, unlockExpansion } from '../../api/http.js';
import { formatEurCents } from '../commerce/formatPrice.js';
import encountersData from '../../data/game/encountersdata.json';
import expansionData from '../../data/game/expansiondata.json';
import {
  protectedImageProps,
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import { PanelButton } from '../common/PanelButton.js';
import DiceShopOverlay from './DiceShopOverlay.js';
import { DEFAULT_BUTTON_SOUND, playSfx } from '../sfx.js';

const EXPANSION_UI_ROOT = '/UI/03_DASHBOARD/expansions';
const ENCOUNTER_IMAGE_ROOT = '/game/encounterimages';
const GEMS_ICON = '/UI/03_DASHBOARD/im_gems.webp';
const OVERLAY_FADE_MS = 300;
const PREVIEW_ENCOUNTER_COUNT = 3;

interface ExpansionRecord {
  mExtensioActive: boolean;
  mExtensioCollectionImage: string;
  mExtensioCost: number;
  mExtensioPriceEurCents?: number;
  mExtensioHeaderImage: string;
  mExtensioID: number;
  mExtensioName: string;
  mExtensioReward: number;
  mExtensioSummaryText: string;
  mExtensioText: string;
}

interface EncounterDataRecord {
  mEncounterExpansion: number;
  mEncounterID: number;
  mEncounterImageName: string;
  mEncounterTitle: string;
}

interface EncounterPreviewEntry {
  encounterId: number;
  imageSrc: string;
  title: string;
}

function expansionAsset(assetName: string): string {
  return `${EXPANSION_UI_ROOT}/${assetName}.webp`;
}

function encounterImagePath(imageName: string): string {
  const fileName = imageName.endsWith('.webp') ? imageName : `${imageName}.webp`;

  return `${ENCOUNTER_IMAGE_ROOT}/${fileName}`;
}

function buildEncountersByExpansion(): Map<number, EncounterPreviewEntry[]> {
  const records = encountersData as Record<string, EncounterDataRecord>;
  const byExpansion = new Map<number, EncounterPreviewEntry[]>();

  for (const record of Object.values(records)) {
    const expansionId = record.mEncounterExpansion;
    const pool = byExpansion.get(expansionId) ?? [];

    pool.push({
      encounterId: record.mEncounterID,
      imageSrc: encounterImagePath(record.mEncounterImageName),
      title: record.mEncounterTitle,
    });
    byExpansion.set(expansionId, pool);
  }

  for (const pool of byExpansion.values()) {
    pool.sort((left, right) => left.title.localeCompare(right.title));
  }

  return byExpansion;
}

function pickRandomEncounterPreviews(
  pool: EncounterPreviewEntry[],
  count: number,
): EncounterPreviewEntry[] {
  if (pool.length <= count) {
    return [...pool];
  }

  const shuffled = [...pool];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }

  return shuffled.slice(0, count);
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

function checkoutErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Purchase failed';

  if (message.includes('PURCHASES_UNAVAILABLE')) {
    return 'Card purchases are not available right now.';
  }

  if (message.includes('UNKNOWN_SKU')) {
    return 'This item is not available for purchase.';
  }

  return 'Could not start checkout. Please try again.';
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
  justifyContent: 'space-between',
  gap: 12,
  paddingTop: 8,
  borderTop: '1px solid rgba(255, 204, 102, 0.32)',
};

const gemsFooterBalanceStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minWidth: 0,
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

const previewListStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  margin: 0,
  padding: '10px 12px',
  listStyle: 'none',
  border: '1px solid rgba(255, 204, 102, 0.28)',
  borderRadius: 8,
  background: 'rgba(6, 4, 3, 0.65)',
};

const previewRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
};

const previewImageStyle: CSSProperties = {
  display: 'block',
  width: 72,
  height: 48,
  objectFit: 'cover',
  borderRadius: 6,
  border: '1px solid rgba(255, 204, 102, 0.35)',
  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.45)',
};

const previewTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f7efe0',
  fontSize: '0.9rem',
  lineHeight: 1.35,
};

const previewHintStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.72)',
  fontSize: '0.78rem',
  letterSpacing: '0.04em',
  lineHeight: 1.4,
  textAlign: 'center',
};

function ExpansionCard({
  expansion,
  encounterPool,
  expanded,
  gemBalance,
  previewEncounters,
  previewOpen,
  unlockPending,
  checkoutPending,
  unlocked,
  onPreview,
  onToggle,
  onUnlock,
  onCheckout,
}: {
  expansion: ExpansionRecord;
  encounterPool: EncounterPreviewEntry[];
  expanded: boolean;
  gemBalance: number;
  previewEncounters: EncounterPreviewEntry[] | null;
  previewOpen: boolean;
  unlockPending: boolean;
  checkoutPending: boolean;
  unlocked: boolean;
  onPreview: () => void;
  onToggle: () => void;
  onUnlock: () => void;
  onCheckout: () => void;
}) {
  const headerId = `expansion-${expansion.mExtensioID}-header`;
  const bodyId = `expansion-${expansion.mExtensioID}-body`;
  const canAfford = gemBalance >= expansion.mExtensioCost;
  const unlockEnabled = expansion.mExtensioActive && !unlocked && canAfford && !unlockPending;
  const priceLabel = typeof expansion.mExtensioPriceEurCents === 'number'
    ? formatEurCents(expansion.mExtensioPriceEurCents)
    : null;
  const checkoutEnabled = priceLabel !== null && !checkoutPending && !unlockPending;

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
          <PanelButton
            aria-label={`Preview random encounters from ${expansion.mExtensioName}`}
            disabled={encounterPool.length === 0}
            onClick={(event) => {
              event.stopPropagation();
              playSfx(DEFAULT_BUTTON_SOUND);
              onPreview();
            }}
            pressKey={`expansion-preview-${expansion.mExtensioID}`}
            style={expansionPanelButtonStyle}
            visualStyle={
              encounterPool.length === 0
                ? expansionButtonDisabledVisualStyle
                : expansionButtonVisualStyle
            }
          >
            Preview
          </PanelButton>
          {previewOpen ? (
            encounterPool.length === 0 ? (
              <p style={previewHintStyle}>No encounters are available to preview for this expansion yet.</p>
            ) : previewEncounters && previewEncounters.length > 0 ? (
              <ul aria-label="Encounter preview" style={previewListStyle}>
                {previewEncounters.map((encounter) => (
                  <li key={encounter.encounterId} style={previewRowStyle}>
                    <img
                      alt=""
                      aria-hidden="true"
                      {...protectedImageProps}
                      src={encounter.imageSrc}
                      style={previewImageStyle}
                    />
                    <p style={previewTitleStyle}>{encounter.title}</p>
                  </li>
                ))}
              </ul>
            ) : null
          ) : null}
          {expansion.mExtensioActive && !unlocked ? (
            <div style={unlockActionsRowStyle}>
              <PanelButton
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
                pressKey={`expansion-unlock-gems-${expansion.mExtensioID}`}
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
                aria-label={
                  priceLabel
                    ? `Unlock ${expansion.mExtensioName} for ${priceLabel}`
                    : `Unlock ${expansion.mExtensioName} with purchase`
                }
                disabled={!checkoutEnabled}
                onClick={(event) => {
                  event.stopPropagation();

                  if (!checkoutEnabled) {
                    return;
                  }

                  playSfx(DEFAULT_BUTTON_SOUND);
                  onCheckout();
                }}
                pressKey={`expansion-unlock-cash-${expansion.mExtensioID}`}
                style={expansionPanelButtonStyle}
                visualStyle={
                  checkoutEnabled
                    ? expansionButtonVisualStyle
                    : expansionButtonDisabledVisualStyle
                }
              >
                {priceLabel ?? 'Unlock $'}
              </PanelButton>
            </div>
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
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const expansions = useMemo(() => loadExpansionList(), []);
  const encountersByExpansion = useMemo(() => buildEncountersByExpansion(), []);
  const [previewSamples, setPreviewSamples] = useState<{
    expansionId: number;
    encounters: EncounterPreviewEntry[];
  } | null>(null);
  const [diceShopOpen, setDiceShopOpen] = useState(false);

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
      setPreviewSamples(null);
      setUnlockPending(false);
      setCheckoutPending(false);
      setStatusMessage(null);
      setLoadError(null);
      setDiceShopOpen(false);
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

      if (!next.has(id)) {
        setPreviewSamples((preview) => (
          preview?.expansionId === id ? null : preview
        ));
      }

      return next;
    });
  }

  function handlePreview(expansionId: number): void {
    const pool = encountersByExpansion.get(expansionId) ?? [];

    if (pool.length === 0) {
      setPreviewSamples(null);
      return;
    }

    setPreviewSamples({
      expansionId,
      encounters: pickRandomEncounterPreviews(pool, PREVIEW_ENCOUNTER_COUNT),
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

  async function handleCheckout(expansionId: number): Promise<void> {
    if (checkoutPending) {
      return;
    }

    setCheckoutPending(true);
    setStatusMessage(null);

    try {
      const { url } = await createCheckoutSession(`expansion_${expansionId}`);
      window.location.assign(url);
    } catch (error) {
      setStatusMessage(checkoutErrorMessage(error));
      setCheckoutPending(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <>
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
                encounterPool={encountersByExpansion.get(expansion.mExtensioID) ?? []}
                expanded={expandedIds.has(expansion.mExtensioID)}
                expansion={expansion}
                gemBalance={yellowRedGems}
                onPreview={() => {
                  handlePreview(expansion.mExtensioID);
                }}
                onToggle={() => {
                  toggleExpansion(expansion.mExtensioID);
                }}
                onUnlock={() => {
                  void handleUnlock(expansion.mExtensioID, expansion.mExtensioName);
                }}
                onCheckout={() => {
                  void handleCheckout(expansion.mExtensioID);
                }}
                checkoutPending={checkoutPending}
                previewEncounters={
                  previewSamples?.expansionId === expansion.mExtensioID
                    ? previewSamples.encounters
                    : null
                }
                previewOpen={previewSamples?.expansionId === expansion.mExtensioID}
                unlockPending={unlockPending}
                unlocked={unlockedExpansionIds.includes(expansion.mExtensioID)}
              />
            ))}
          </div>
        </div>
        <footer aria-label="Expansions footer" style={gemsFooterStyle}>
          <div aria-label="Yellow red gems" style={gemsFooterBalanceStyle}>
            <img
              alt=""
              aria-hidden="true"
              {...protectedImageProps}
              src={GEMS_ICON}
              style={gemsIconStyle}
            />
            <p style={gemsCountStyle}>{formatGemCount(yellowRedGems)}</p>
          </div>
          <PanelButton
            aria-label="Open dice shop"
            onClick={(event) => {
              event.stopPropagation();
              playSfx(DEFAULT_BUTTON_SOUND);
              setDiceShopOpen(true);
            }}
            pressKey="expansions-open-dice-shop"
            style={{ minWidth: 148, flex: '0 0 auto' }}
            visualStyle={expansionButtonVisualStyle}
          >
            Dice
          </PanelButton>
        </footer>
      </section>
    </div>
    <DiceShopOverlay
      onClose={() => {
        setDiceShopOpen(false);
      }}
      onPlayerUpdated={() => {
        void refreshPlayer();
      }}
      open={diceShopOpen}
      playerId={playerId}
    />
    </>
  );
}

export default ExpansionsOverlay;
