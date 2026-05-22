import type { PersistedAvatar } from '../../api/http.js';

const AVATAR_ASSET_ROOT = '/UI/02_AvatarCreation/Avatare';
const FRAME_ASSET_ROOT = '/UI/02_AvatarCreation/Frames';
const CREATE_AVATAR_ASSET = '/UI/03_DASHBOARD/CreateAvatar.webp';
const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';
const PRELOAD_TIMEOUT_MS = 1200;

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(() => {
      resolve();
    }, PRELOAD_TIMEOUT_MS);

    function finish(): void {
      window.clearTimeout(timer);
      resolve();
    }

    image.onload = () => {
      finish();
    };
    image.onerror = () => {
      finish();
    };
    image.src = src;
  });
}

export async function preloadAvatarPortraitAssets(avatar: PersistedAvatar): Promise<void> {
  await Promise.all([
    preloadImage(`${AVATAR_ASSET_ROOT}/${avatar.portrait}`),
    preloadImage(`${FRAME_ASSET_ROOT}/${avatar.frame}`),
  ]);
}

export async function preloadAvatarSelectionAssets(avatars: PersistedAvatar[]): Promise<void> {
  const avatarAssetPaths = avatars.flatMap((avatar) => [
    `${AVATAR_ASSET_ROOT}/${avatar.portrait}`,
    `${FRAME_ASSET_ROOT}/${avatar.frame}`,
  ]);

  await Promise.all([
    ...avatarAssetPaths.map(preloadImage),
    preloadImage(CREATE_AVATAR_ASSET),
    preloadImage(HOME_BUTTON_ASSET),
  ]);
}
