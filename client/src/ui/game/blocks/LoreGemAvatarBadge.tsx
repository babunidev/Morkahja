import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { assetUrl } from '../../../assetUrl.js';
import { protectedImageProps } from '../../protectedImage.js';
import { playIconFlightToElement } from '../rewardFlyAnimation.js';
import { takeLoreGemPickup } from '../loreGemPickup.js';

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

type Phase = 'hidden' | 'arriving' | 'shown' | 'sinking';

/**
 * The lore gem a party member collected this encounter, on the top left of
 * their avatar. It arrives from the Lore window (for the player who picked it
 * up; for everyone else it fades in), and when the round continues it sinks
 * into the avatar and disappears.
 */
export function LoreGemAvatarBadge({ held: collected, roomState }: {
  held: boolean;
  /** Continuing moves the room on (or into a system event such as a level-up): the gem sinks then. */
  roomState?: string;
}) {
  const held = collected && roomState !== 'advancing' && roomState !== 'system_event';
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
    <span aria-label="Lore gem collected" data-morkahja-lore-gem-badge="" ref={badgeRef} role="img" style={style}>
      <img alt="" aria-hidden="true" {...protectedImageProps} src={LORE_GEM_ASSET} style={imageStyle} />
    </span>
  );
}

export default LoreGemAvatarBadge;
