import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { noteLoreGemPickup } from '../loreGemPickup.js';
import type { LoreGemOfferDto } from '@shared/contracts';

import {
  preventImageContextMenu,
  PROTECTED_BACKGROUND_ATTR,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import { FADE_DURATION_MS, fadeTransition } from '../../transitions/fade.js';
import { assetUrl } from '../../../assetUrl.js';
import DecorativeEdgeFrame from './DecorativeEdgeFrame.js';
import { overlayPanelTitleStyle } from './decorativeFrameShared.js';

const LORE_BACKGROUND = assetUrl('/UI/09_GAME/spellbook_bg.webp');
const LORE_GEM_ASSET = assetUrl('/UI/03_DASHBOARD/im_gems.webp');
const LORE_GEM_TICK_MS = 200;

type LoreGemState = 'waiting' | 'visible' | 'collecting' | 'collected';

const LORE_BACKGROUND_OPACITY = 0.81;

const loreBlockStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 18,
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)',
  overflow: 'hidden',
  transition: fadeTransition,
};

const loreBackgroundLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 0,
  backgroundColor: 'rgba(10, 7, 5, 0.94)',
  backgroundImage: `url(${LORE_BACKGROUND})`,
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundSize: 'cover',
  opacity: LORE_BACKGROUND_OPACITY,
  pointerEvents: 'auto',
};

const textWrapStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minHeight: 0,
  padding: '0 clamp(22px, 7vw, 42px) clamp(28px, 7vw, 40px)',
  boxSizing: 'border-box',
  overflow: 'auto',
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.95rem, 3.6vw, 1.22rem)',
  lineHeight: 1.42,
  textAlign: 'center',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.92)',
  userSelect: 'none',
};

const loreTitleStyle: CSSProperties = {
  ...overlayPanelTitleStyle,
  paddingBottom: 'clamp(12px, 3vh, 20px)',
};

const textStyle: CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  userSelect: 'none',
};

const loreGemButtonStyle: CSSProperties = {
  position: 'relative',
  display: 'block',
  zIndex: 30,
  width: 'clamp(34px, 9vw, 52px)',
  margin: 'clamp(14px, 4vw, 24px) auto 0',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  transition: 'opacity 420ms ease, transform 420ms ease',
};

const loreGemStarStyle: CSSProperties = {
  display: 'block',
  width: 10,
  height: 10,
  margin: 'clamp(16px, 4vw, 24px) auto 0',
  borderRadius: '50%',
  background: '#ffcc66',
  boxShadow: '0 0 7px rgba(255, 204, 102, 0.95), 0 0 16px rgba(255, 204, 102, 0.5)',
  pointerEvents: 'none',
  animation: 'morkahja-lore-gem-star-pulse 2200ms ease-in-out infinite',
};

const loreGemFadeInStyle: CSSProperties = {
  animation: `morkahja-lore-gem-fade-in ${FADE_DURATION_MS}ms ease forwards`,
};

const loreGemImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 0 10px rgba(255, 204, 102, 0.75)) drop-shadow(0 8px 12px rgba(0, 0, 0, 0.55))',
};

function offerDurationMs(offer: LoreGemOfferDto): number {
  if (typeof offer.durationMs === 'number' && offer.durationMs > 0) {
    return offer.durationMs;
  }
  if (offer.claimableAt !== null && offer.offeredAt > 0) {
    return Math.max(0, offer.claimableAt - offer.offeredAt);
  }
  return 0;
}

/** Stable key so room polls do not reset the pauseable client timer. */
function loreGemOfferResetKey(
  encounterKey: string,
  offer: LoreGemOfferDto | undefined,
): string {
  if (!offer?.eligible) {
    return `${encounterKey}:none`;
  }

  const durationMs = offerDurationMs(offer);
  if (durationMs <= 0) {
    return `${encounterKey}:none`;
  }

  return `${encounterKey}:${offer.offeredAt}:${durationMs}`;
}

export function LoreBlock({
  encounterKey,
  loreGemCollected = false,
  loreGemOffer,
  onLoreGemCollect,
  text,
  title,
  visible,
}: {
  encounterKey: string;
  loreGemCollected?: boolean;
  loreGemOffer?: LoreGemOfferDto;
  onLoreGemCollect: () => Promise<void>;
  text: string;
  title: string;
  visible: boolean;
}) {
  const [loreGemState, setLoreGemState] = useState<LoreGemState>('waiting');
  const collectedThisEncounterRef = useRef(false);
  const remainingMsRef = useRef<number | null>(null);
  const durationMsRef = useRef(0);

  const isCollected = loreGemCollected || collectedThisEncounterRef.current;
  const offerDuration = loreGemOffer && loreGemOffer.eligible
    ? offerDurationMs(loreGemOffer)
    : 0;
  const offerEligible = offerDuration > 0;
  const loreGemOfferResetKeyValue = useMemo(
    () => loreGemOfferResetKey(encounterKey, loreGemOffer),
    [
      encounterKey,
      loreGemOffer?.eligible,
      loreGemOffer?.offeredAt,
      loreGemOffer?.durationMs,
      loreGemOffer?.claimableAt,
    ],
  );

  useEffect(() => {
    collectedThisEncounterRef.current = false;
    durationMsRef.current = offerEligible ? offerDuration : 0;
    remainingMsRef.current = durationMsRef.current > 0 ? durationMsRef.current : null;
    setLoreGemState(offerEligible ? 'waiting' : 'collected');
  }, [loreGemOfferResetKeyValue, offerEligible, offerDuration]);

  useEffect(() => {
    if (loreGemCollected && loreGemState !== 'collecting') {
      collectedThisEncounterRef.current = true;
    }
  }, [loreGemCollected, loreGemState]);

  useEffect(() => {
    if (loreGemState === 'collecting') {
      return undefined;
    }

    if (isCollected || !offerEligible) {
      setLoreGemState('collected');
      return undefined;
    }

    if (!visible) {
      return undefined;
    }

    if (remainingMsRef.current === null) {
      remainingMsRef.current = durationMsRef.current;
    }

    if ((remainingMsRef.current ?? 0) <= 0) {
      setLoreGemState('visible');
      return;
    }

    setLoreGemState('waiting');

    const interval = window.setInterval(() => {
      if (remainingMsRef.current === null) {
        return;
      }

      remainingMsRef.current = Math.max(0, remainingMsRef.current - LORE_GEM_TICK_MS);
      if (remainingMsRef.current <= 0) {
        setLoreGemState('visible');
      } else {
        setLoreGemState('waiting');
      }
    }, LORE_GEM_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [visible, isCollected, offerEligible, loreGemOfferResetKeyValue, loreGemState]);

  async function handleLoreGemClick(): Promise<void> {
    if (loreGemState !== 'visible' || isCollected) {
      return;
    }

    // The gem flies from here to the top left of the avatar once the server
    // confirms the pickup (LoreGemAvatarBadge), and waits there for Continue.
    const gemRect = document.querySelector('[data-lore-gem="true"]')?.getBoundingClientRect();
    setLoreGemState('collecting');

    try {
      if (gemRect && gemRect.width > 0) {
        noteLoreGemPickup(gemRect);
      }
      await onLoreGemCollect();
      collectedThisEncounterRef.current = true;
      remainingMsRef.current = 0;
      setLoreGemState('collected');
    } catch (error) {
      console.error('Lore gem collection failed', error);
      if (!collectedThisEncounterRef.current) {
        setLoreGemState('visible');
      }
    }
  }

  const loreGemVisible = loreGemState === 'visible' || loreGemState === 'collecting';
  const showWaitingStar = visible
    && !isCollected
    && offerEligible
    && loreGemState === 'waiting';

  return (
    <aside
      aria-hidden={!visible}
      aria-label="Lore"
      data-morkahja-menu="game-lore"
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      onContextMenu={preventImageContextMenu}
      style={{
        ...loreBlockStyle,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <style>
        {`
          [data-lore-scroll]::-webkit-scrollbar { display: none; }
          @keyframes morkahja-lore-gem-fade-in {
            0% { opacity: 0; transform: scale(0.88); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes morkahja-lore-gem-star-pulse {
            0%, 100% { opacity: 0.34; transform: scale(0.78); filter: brightness(0.88); }
            50% { opacity: 1; transform: scale(1.12); filter: brightness(1.25); }
          }
          @keyframes morkahja-lore-gem-hover {
            0%, 100% { transform: scale(1) rotate(0deg); }
            35% { transform: scale(1.08) rotate(-5deg); }
            70% { transform: scale(1.06) rotate(5deg); }
          }
          .morkahja-lore-gem-collectible:not(:disabled) .morkahja-lore-gem-visual {
            display: block;
            transition: filter 180ms ease;
          }
          .morkahja-lore-gem-collectible:not(:disabled):hover .morkahja-lore-gem-visual {
            animation: morkahja-lore-gem-hover 680ms ease-in-out;
            filter: drop-shadow(0 0 14px rgba(255, 204, 102, 0.95)) brightness(1.14);
          }
        `}
      </style>
      <div
        aria-hidden="true"
        {...{ [PROTECTED_BACKGROUND_ATTR]: '', [PROTECTED_SURFACE_ATTR]: '' }}
        style={loreBackgroundLayerStyle}
      />
      <DecorativeEdgeFrame zIndex={27} />
      <div
        data-lore-scroll
        {...{ [PROTECTED_SURFACE_ATTR]: '' }}
        onContextMenu={preventImageContextMenu}
        style={textWrapStyle}
      >
        <h1 className="morkahja-title" style={loreTitleStyle}>
          {title}
        </h1>
        <p style={textStyle}>{text || 'No lore has been written for this encounter yet.'}</p>
        {showWaitingStar ? (
          <span aria-hidden="true" style={loreGemStarStyle} />
        ) : null}
        {loreGemVisible ? (
          <button
            aria-label="lore_gem"
            className="morkahja-lore-gem-collectible"
            data-lore-gem="true"
            disabled={loreGemState === 'collecting'}
            onClick={() => {
              void handleLoreGemClick();
            }}
            onContextMenu={preventImageContextMenu}
            style={{
              ...loreGemButtonStyle,
              cursor: loreGemState === 'visible' ? 'pointer' : 'default',
            }}
            type="button"
          >
            <span
              className="morkahja-lore-gem-visual"
              style={{
                position: 'relative',
                display: 'block',
                ...(loreGemState === 'visible' ? loreGemFadeInStyle : {}),

              }}
            >
              <img
                alt=""
                aria-hidden="true"
                {...protectedImageProps}
                src={LORE_GEM_ASSET}
                style={loreGemImageStyle}
              />
            </span>
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default LoreBlock;
