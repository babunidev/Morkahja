import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { assetUrl } from '../../../assetUrl.js';
import { protectedImageProps } from '../../protectedImage.js';
import { playIconFlightToElement } from '../rewardFlyAnimation.js';
import { takeLoreGemPickup } from '../loreGemPickup.js';
import { SolutionChargeBadge } from '../../common/SolutionFrame.js';

const LORE_GEM_ASSET = assetUrl('/UI/03_DASHBOARD/im_gems.webp');
const BADGE_SIZE_PX = 44;
const FADE_MS = 300;
const SINK_MS = 750;

const badgeStyle: CSSProperties = {
  // Top left of the portrait, across from the choice badge (top right).
  position: 'absolute',
  left: '6%',
  top: '12%',
  zIndex: 7,
  width: BADGE_SIZE_PX,
  height: BADGE_SIZE_PX,
  pointerEvents: 'none',
  filter: 'drop-shadow(0 0 10px rgba(255, 204, 102, 0.65)) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))',
};

const imageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'contain',
};

// The item hexagon, at the gem's bottom right, half outside it.
const countStyle: CSSProperties = {
  position: 'absolute',
  right: -8,
  bottom: -6,
  width: BADGE_SIZE_PX,
  height: BADGE_SIZE_PX,
  pointerEvents: 'none',
};

type Phase = 'hidden' | 'arriving' | 'shown' | 'sinking';

/**
 * The gems a party member earned this encounter, on the top left of their
 * avatar: the lore gem, and the top roll's gem (Babuni, 2026-11-24). The lore
 * gem arrives from the Lore window (for the player who picked it up; for
 * everyone else it fades in). With both, the item hexagon shows a 2. When the
 * round continues they sink into the avatar and disappear.
 */
export function LoreGemAvatarBadge({ held: collected, roomState, topRoll = false }: {
  held: boolean;
  /** Continuing moves the room on (or into a system event such as a level-up): the gem sinks then. */
  roomState?: string;
  /** The avatar shows a top roll: one more gem (`useTopRollGemShown`). */
  topRoll?: boolean;
}) {
  const loreHeld = collected && roomState !== 'advancing' && roomState !== 'system_event';
  const count = (loreHeld ? 1 : 0) + (topRoll ? 1 : 0);
  const held = count > 0;
  // The last count shown, kept while the gems sink.
  const shownCountRef = useRef(count);
  if (count > 0) {
    shownCountRef.current = count;
  }
  const previousLoreRef = useRef(loreHeld);

  // A lore gem picked up while the top roll's gem is already shown flies in to join it.
  useEffect(() => {
    const wasHeld = previousLoreRef.current;
    previousLoreRef.current = loreHeld;
    if (!loreHeld || wasHeld || !topRoll) {
      return;
    }
    const source = takeLoreGemPickup();
    const target = badgeRef.current;
    if (source && target) {
      // Picked up in the Lore panel: this flight shows over it.
      void playIconFlightToElement(source, target, LORE_GEM_ASSET, BADGE_SIZE_PX, { overPanels: true });
    }
  }, [loreHeld, topRoll]);
  const [phase, setPhase] = useState<Phase>('hidden');
  const [sinkTransform, setSinkTransform] = useState<string | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    if (held) {
      shownRef.current = true;
      const source = takeLoreGemPickup();
      timers.push(window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setSinkTransform(null);
        setPhase('arriving');
        window.requestAnimationFrame(() => {
          const target = badgeRef.current;
          const flight = source && target
            ? playIconFlightToElement(source, target, LORE_GEM_ASSET, BADGE_SIZE_PX)
            : Promise.resolve();
          void flight.then(() => {
            if (!cancelled) {
              setPhase('shown');
            }
          });
        });
      }, 0));
    } else if (shownRef.current) {
      shownRef.current = false;
      // Into the middle of the avatar, shrinking to nothing.
      const badge = badgeRef.current;
      const portrait = badge?.parentElement;
      timers.push(window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        if (badge && portrait) {
          const b = badge.getBoundingClientRect();
          const p = portrait.getBoundingClientRect();
          const dx = p.left + p.width / 2 - (b.left + b.width / 2);
          const dy = p.top + p.height / 2 - (b.top + b.height / 2);
          setSinkTransform(`translate(${dx}px, ${dy}px) scale(0.15)`);
        }
        setPhase('sinking');
      }, 0));
      timers.push(window.setTimeout(() => {
        if (!cancelled) {
          setPhase('hidden');
        }
      }, SINK_MS + 50));
    }

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [held]);

  if (phase === 'hidden') {
    return null;
  }

  const style: CSSProperties = phase === 'sinking'
    ? {
      ...badgeStyle,
      opacity: 0,
      transform: sinkTransform ?? 'scale(0.15)',
      transition: `transform ${SINK_MS}ms cubic-bezier(0.45, 0, 0.55, 1), opacity ${SINK_MS}ms ease-in`,
    }
    : {
      ...badgeStyle,
      opacity: phase === 'shown' ? 1 : 0,
      transition: `opacity ${FADE_MS}ms ease`,
    };

  return (
    <span
      aria-label={shownCountRef.current > 1 ? `${shownCountRef.current} gems earned` : 'Gem earned'}
      data-morkahja-lore-gem-badge=""
      ref={badgeRef}
      role="img"
      style={style}
    >
      <img alt="" aria-hidden="true" {...protectedImageProps} src={LORE_GEM_ASSET} style={imageStyle} />
      {shownCountRef.current > 1 ? (
        <span style={countStyle}>
          <SolutionChargeBadge charges={shownCountRef.current} size={BADGE_SIZE_PX} />
        </span>
      ) : null}
    </span>
  );
}

export default LoreGemAvatarBadge;
