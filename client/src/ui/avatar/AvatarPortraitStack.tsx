import type { CSSProperties } from 'react';

const AVATAR_ASSET_ROOT = '/UI/02_AvatarCreation/Avatare';
const FRAME_ASSET_ROOT = '/UI/02_AvatarCreation/Frames';

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

const frameStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  zIndex: 2,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  transform: 'translate(-50%, -50%)',
  pointerEvents: 'none',
};

export function AvatarPortraitStack({
  portrait,
  frame,
  enterSource = false,
  enterTarget = false,
  style,
}: {
  portrait: string;
  frame: string;
  enterSource?: boolean;
  enterTarget?: boolean;
  style?: CSSProperties;
}) {
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
        src={`${AVATAR_ASSET_ROOT}/${portrait}`}
        style={portraitStyle}
      />
      <img
        alt=""
        aria-hidden="true"
        draggable={false}
        src={`${FRAME_ASSET_ROOT}/${frame}`}
        style={frameStyle}
      />
    </div>
  );
}

export default AvatarPortraitStack;
