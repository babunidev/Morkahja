import type { CSSProperties } from 'react';

const AVATAR_ASSET_ROOT = '/UI/02_AvatarCreation/Avatare';
const FRAME_ASSET_ROOT = '/UI/02_AvatarCreation/Frames';

/** Portrait frame scale in the in-game avatar block (100% + 1%). */
export const INGAME_FRAME_SCALE = 1.01;

export const AVATAR_ENTER_SOURCE_ATTR = 'data-avatar-enter-source';
export const AVATAR_ENTER_TARGET_ATTR = 'data-avatar-enter-target';

const stackStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'grid',
  placeItems: 'center',
};

const portraitStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  zIndex: 1,
  width: '88.6%',
  height: '88.6%',
  objectFit: 'contain',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

const frameBaseStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  zIndex: 2,
  objectFit: 'contain',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

export function AvatarPortraitStack({
  portrait,
  frame,
  frameScale = 1,
  enterSource = false,
  enterTarget = false,
  onPortraitError,
  style,
}: {
  portrait: string;
  frame: string;
  frameScale?: number;
  enterSource?: boolean;
  enterTarget?: boolean;
  onPortraitError?: () => void;
  style?: CSSProperties;
}) {
  const frameSizePercent = frameScale * 100;
  return (
    <div
      {...(enterSource ? { [AVATAR_ENTER_SOURCE_ATTR]: '' } : {})}
      {...(enterTarget ? { [AVATAR_ENTER_TARGET_ATTR]: '' } : {})}
      style={{ ...stackStyle, ...style }}
    >
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        onError={onPortraitError}
        src={`${AVATAR_ASSET_ROOT}/${portrait}`}
        style={portraitStyle}
      />
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={`${FRAME_ASSET_ROOT}/${frame}`}
        style={{
          ...frameBaseStyle,
          width: `${frameSizePercent}%`,
          height: `${frameSizePercent}%`,
        }}
      />
    </div>
  );
}

export default AvatarPortraitStack;
