import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { protectedImageProps } from '../../protectedImage.js';
import {
  BAR_THICKNESS_PX,
  BOTTOM_BAR_STYLE,
  FRAME_MASK,
  FRAME_OUTSET_PX,
  TOP_BAR_STYLE,
  sideBarVerticalSpanPx,
} from './decorativeFrameShared.js';

const FRAME_Z_INDEX = 25;

/** Expanded past the art square so bars overlay the picture edge. */
const frameLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: -FRAME_OUTSET_PX,
  pointerEvents: 'none',
  overflow: 'visible',
};

const sharedBarStyle: CSSProperties = {
  position: 'absolute',
  objectFit: 'cover',
  pointerEvents: 'none',
};

type VerticalSideBarProps = {
  edge: 'left' | 'right';
  containerHeight: number;
  containerWidth: number;
};

const sideBarColumnBaseStyle: CSSProperties = {
  position: 'absolute',
  top: BAR_THICKNESS_PX,
  bottom: BAR_THICKNESS_PX,
  width: BAR_THICKNESS_PX,
  overflow: 'hidden',
  pointerEvents: 'none',
  zIndex: 2,
};

const sideBarImageStyle = (innerHeight: number): CSSProperties => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: innerHeight,
  height: BAR_THICKNESS_PX,
  objectFit: 'cover',
  transform: 'translate(-50%, -50%) rotate(90deg)',
  transformOrigin: 'center center',
});

function VerticalSideBar({
  edge,
  containerHeight,
  containerWidth,
}: VerticalSideBarProps) {
  const innerHeight = sideBarVerticalSpanPx(containerHeight);
  if (innerHeight <= 0 || containerHeight <= 0 || containerWidth <= 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        ...sideBarColumnBaseStyle,
        left: edge === 'left' ? 0 : containerWidth - BAR_THICKNESS_PX,
      }}
    >
      <img
        alt=""
        {...protectedImageProps}
        draggable={false}
        src={FRAME_MASK}
        style={sideBarImageStyle(innerHeight)}
      />
    </div>
  );
}

export function DecorativeEdgeFrame({ zIndex = FRAME_Z_INDEX }: { zIndex?: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return undefined;
    }

    const updateSize = (): void => {
      setFrameSize({
        width: node.clientWidth,
        height: node.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      aria-hidden="true"
      style={{ ...frameLayerStyle, zIndex }}
    >
      <img alt="" {...protectedImageProps} draggable={false} src={FRAME_MASK} style={{ ...sharedBarStyle, ...TOP_BAR_STYLE }} />
      <img alt="" {...protectedImageProps} draggable={false} src={FRAME_MASK} style={{ ...sharedBarStyle, ...BOTTOM_BAR_STYLE }} />
      <VerticalSideBar
        containerHeight={frameSize.height}
        containerWidth={frameSize.width}
        edge="left"
      />
      <VerticalSideBar
        containerHeight={frameSize.height}
        containerWidth={frameSize.width}
        edge="right"
      />
    </div>
  );
}

export default DecorativeEdgeFrame;
