import { useEffect, useState, type CSSProperties } from 'react';
import type { PersistedAvatar } from '../../api/http.js';
import AvatarPortraitStack, { INGAME_FRAME_SCALE } from '../avatar/AvatarPortraitStack.js';
import { AVATAR_ENTER_FADE_MS, boundsToStyle, type Bounds } from './avatarEnterTransition.js';

const motionStyle: CSSProperties = {
  transitionProperty: 'left, top, width, height',
  transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.45, 1)',
  willChange: 'left, top, width, height',
};

const compositionFillStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  aspectRatio: '1 / 1.15',
};

export function AvatarEnterHandoff({
  avatar,
  bounds,
  fading = false,
  glowAtCenter = false,
  moveDurationMs,
}: {
  avatar: PersistedAvatar;
  bounds: Bounds;
  fading?: boolean;
  glowAtCenter?: boolean;
  moveDurationMs: number;
}) {
  const [animatedBounds, setAnimatedBounds] = useState(bounds);

  useEffect(() => {
    if (moveDurationMs === 0) {
      setAnimatedBounds(bounds);
      return;
    }

    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!cancelled) {
          setAnimatedBounds(bounds);
        }
      });
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [bounds, moveDurationMs]);

  return (
    <div
      aria-hidden="true"
      style={{
        ...boundsToStyle(animatedBounds),
        ...motionStyle,
        opacity: fading ? 0 : 1,
        transitionProperty: fading ? 'opacity' : motionStyle.transitionProperty,
        transitionDuration: fading ? `${AVATAR_ENTER_FADE_MS}ms` : `${moveDurationMs}ms`,
      }}
    >
      <div
        className={glowAtCenter ? 'morkahja-avatar-enter-handoff-glow' : undefined}
        style={{ width: '100%', height: '100%' }}
      >
        <AvatarPortraitStack
          frame={avatar.frame}
          frameScale={INGAME_FRAME_SCALE}
          portrait={avatar.portrait}
          style={compositionFillStyle}
        />
      </div>
    </div>
  );
}

export default AvatarEnterHandoff;
