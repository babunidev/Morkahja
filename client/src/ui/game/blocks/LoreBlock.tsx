import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { LoreGemOfferResponse } from '@shared/contracts';
import {
  preventImageContextMenu,
  PROTECTED_BACKGROUND_ATTR,
  PROTECTED_SURFACE_ATTR,
  protectedImageProps,
} from '../../protectedImage.js';
import { FADE_DURATION_MS, fadeTransition } from '../../transitions/fade.js';

const LORE_BACKGROUND = '/UI/09_GAME/spellbook_bg.webp';
const LORE_GEM_ASSET = '/UI/03_DASHBOARD/im_gems.webp';
const LORE_GEM_COLLECT_ANIMATION_MS = 700;
const LORE_GEM_POPUP_MS = 330;

type LoreGemState = 'waiting' | 'visible' | 'collecting' | 'collected';

const LORE_BACKGROUND_OPACITY = 0.81;

const loreBlockStyle: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: -30,
  zIndex: 18,
  width: '100%',
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr)',
  overflow: 'visible',
  transition: fadeTransition,
};

const loreBlockVisibleStyle: CSSProperties = {
  zIndex: 18,
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
  padding: 'clamp(22px, 6vw, 34px) clamp(22px, 7vw, 42px)',
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

const loreGemCollectingStyle: CSSProperties = {
  animation: 'morkahja-lore-gem-collect 700ms ease-in forwards',
};

const loreGemImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 0 10px rgba(255, 204, 102, 0.75)) drop-shadow(0 8px 12px rgba(0, 0, 0, 0.55))',
};

const loreGemPopupStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: 0,
  zIndex: 31,
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(0.9rem, 4vw, 1.3rem)',
  fontWeight: 700,
  lineHeight: 1,
  textShadow: '0 0 7px rgba(255, 204, 102, 0.95), 0 3px 8px rgba(0, 0, 0, 0.85)',
  pointerEvents: 'none',
  animation: 'morkahja-lore-gem-popup 330ms ease-out forwards',
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function LoreBlock({
  encounterKey,
  onLoreGemCollect,
  onLoreGemOffer,
  text,
  visible,
}: {
  encounterKey: string;
  onLoreGemCollect: () => Promise<void>;
  onLoreGemOffer: () => Promise<LoreGemOfferResponse>;
  text: string;
  visible: boolean;
}) {
  const [loreGemState, setLoreGemState] = useState<LoreGemState>('waiting');
  const [loreGemPopupVisible, setLoreGemPopupVisible] = useState(false);
  const loreGemClaimableAt = useRef<number | null>(null);
  const loreGemOfferLoaded = useRef(false);

  useEffect(() => {
    loreGemClaimableAt.current = null;
    loreGemOfferLoaded.current = false;
    setLoreGemState('waiting');
    setLoreGemPopupVisible(false);
  }, [encounterKey]);

  useEffect(() => {
    if (!visible || loreGemState !== 'waiting') {
      return undefined;
    }

    let timer: number | undefined;
    let cancelled = false;

    async function scheduleGem(): Promise<void> {
      try {
        if (!loreGemOfferLoaded.current) {
          const offer = await onLoreGemOffer();
          if (cancelled) {
            return;
          }

          loreGemOfferLoaded.current = true;

          if (offer.encounterKey !== encounterKey) {
            return;
          }

          if (!offer.eligible || offer.claimableAt === null) {
            setLoreGemState('collected');
            return;
          }

          loreGemClaimableAt.current = offer.claimableAt;
        }

        const claimableAt = loreGemClaimableAt.current;
        if (claimableAt === null) {
          setLoreGemState('collected');
          return;
        }

        const delay = Math.max(0, claimableAt - Date.now());
        timer = window.setTimeout(() => {
          if (!cancelled) {
            setLoreGemState('visible');
          }
        }, delay);
      } catch (error) {
        console.error('Lore gem offer failed', error);
        if (!cancelled) {
          setLoreGemState('collected');
        }
      }
    }

    void scheduleGem();

    return () => {
      cancelled = true;
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [encounterKey, loreGemState, onLoreGemOffer, visible]);

  async function handleLoreGemClick(): Promise<void> {
    if (loreGemState !== 'visible') {
      return;
    }

    setLoreGemState('collecting');
    setLoreGemPopupVisible(true);
    window.setTimeout(() => {
      setLoreGemPopupVisible(false);
    }, LORE_GEM_POPUP_MS);

    try {
      await Promise.all([
        onLoreGemCollect(),
        wait(LORE_GEM_COLLECT_ANIMATION_MS),
      ]);
      setLoreGemState('collected');
    } catch (error) {
      console.error('Lore gem collection failed', error);
      await wait(LORE_GEM_COLLECT_ANIMATION_MS);
      setLoreGemState('visible');
    }
  }

  const loreGemVisible = loreGemState === 'visible' || loreGemState === 'collecting';

  return (
    <aside
      aria-hidden={!visible}
      aria-label="Lore"
      {...{ [PROTECTED_SURFACE_ATTR]: '' }}
      onContextMenu={preventImageContextMenu}
      style={{
        ...loreBlockStyle,
        ...(visible ? loreBlockVisibleStyle : {}),
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
          @keyframes morkahja-lore-gem-collect {
            0% { opacity: 1; transform: translateX(0) rotate(0deg) scale(1); }
            12% { transform: translateX(-4px) rotate(-9deg) scale(1.06); }
            24% { transform: translateX(4px) rotate(9deg) scale(1.05); }
            36% { transform: translateX(-3px) rotate(-7deg) scale(1.03); }
            48% { transform: translateX(3px) rotate(7deg) scale(1.02); }
            62% { opacity: 0.75; transform: translateX(-2px) rotate(-4deg) scale(0.96); }
            100% { opacity: 0; transform: translateY(12px) rotate(0deg) scale(0.55); }
          }
          @keyframes morkahja-lore-gem-popup {
            0% { opacity: 0; transform: translate(-50%, -2px) scale(0.9); }
            18% { opacity: 1; transform: translate(-50%, -12px) scale(1.1); }
            100% { opacity: 0; transform: translate(-50%, -28px) scale(1); }
          }
          @keyframes morkahja-lore-gem-star-pulse {
            0%, 100% { opacity: 0.34; transform: scale(0.78); filter: brightness(0.88); }
            50% { opacity: 1; transform: scale(1.12); filter: brightness(1.25); }
          }
        `}
      </style>
      <div
        aria-hidden="true"
        {...{ [PROTECTED_BACKGROUND_ATTR]: '', [PROTECTED_SURFACE_ATTR]: '' }}
        style={loreBackgroundLayerStyle}
      />
      <div
        data-lore-scroll
        {...{ [PROTECTED_SURFACE_ATTR]: '' }}
        onContextMenu={preventImageContextMenu}
        style={textWrapStyle}
      >
        <p style={textStyle}>{text || 'No lore has been written for this encounter yet.'}</p>
        {visible && loreGemState === 'waiting' ? (
          <span aria-hidden="true" style={loreGemStarStyle} />
        ) : null}
        {loreGemVisible ? (
          <button
            aria-label="lore_gem"
            data-lore-gem="true"
            disabled={loreGemState === 'collecting'}
            onClick={() => {
              void handleLoreGemClick();
            }}
            onContextMenu={preventImageContextMenu}
            style={{
              ...loreGemButtonStyle,
              ...(loreGemState === 'visible' ? loreGemFadeInStyle : {}),
              ...(loreGemState === 'collecting' ? loreGemCollectingStyle : {}),
              cursor: loreGemState === 'visible' ? 'pointer' : 'default',
            }}
            type="button"
          >
            <img
              alt=""
              aria-hidden="true"
              {...protectedImageProps}
              src={LORE_GEM_ASSET}
              style={loreGemImageStyle}
            />
            {loreGemPopupVisible ? <span style={loreGemPopupStyle}>+1</span> : null}
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export default LoreBlock;
