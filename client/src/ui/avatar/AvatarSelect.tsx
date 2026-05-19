import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  createAvatar,
  fetchAvatars,
  selectAvatar,
  type EncounterSnapshot,
  type PersistedAvatar,
} from '../../api/http.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';
import AvatarCreation from './AvatarCreation.js';
import AvatarCard from './AvatarCard.js';

const CREATE_AVATAR_ASSET = '/UI/03_DASHBOARD/CreateAvatar.webp';
const HOME_BUTTON_ASSET = '/UI/03_DASHBOARD/im_button_home.webp';

const screenStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2,
  display: 'grid',
  placeItems: 'center',
  padding: 'min(6vw, 48px)',
  boxSizing: 'border-box',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(120px, 220px))',
  gap: 'clamp(16px, 4vw, 40px)',
  alignItems: 'start',
  justifyContent: 'center',
  width: 'min(92vw, 840px)',
};

const triangleGridStyle: CSSProperties = {
  ...gridStyle,
  gridTemplateColumns: 'repeat(3, minmax(120px, 190px))',
  gridTemplateAreas: '". top ." "left . right"',
  width: 'min(62vw, 520px)',
  columnGap: 'clamp(0px, 0.5vw, 5px)',
  rowGap: 0,
};

const selectLayerStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 'min(6vw, 48px)',
  boxSizing: 'border-box',
};

const slotButtonStyle: CSSProperties = {
  position: 'relative',
  minHeight: 300,
  padding: 0,
  border: 0,
  background: 'transparent',
  color: '#f5f1e8',
  cursor: 'pointer',
  textAlign: 'center',
};

const createImageStyle: CSSProperties = {
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 18px 28px rgba(0, 0, 0, 0.48))',
};

const createLabelStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'clamp(64px, 9vw, 104px)',
  transform: 'translateX(-50%)',
  color: '#330000',
  fontFamily: 'Breathe Fire, Georgia, serif',
  fontSize: 'clamp(20px, 4vw, 32px)',
  fontWeight: 700,
  letterSpacing: '0.02em',
  WebkitTextStroke: '1px #ffcc66',
  paintOrder: 'stroke fill',
  textShadow: [
    '-1px -1px 0 #ffcc66',
    '1px -1px 0 #ffcc66',
    '-1px 1px 0 #ffcc66',
    '1px 1px 0 #ffcc66',
    '0 0 6px rgba(255, 204, 102, 0.25)',
  ].join(', '),
};

const homeButtonStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'clamp(18px, 4vw, 42px)',
  width: 'min(28vw, 172px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  transform: 'translateX(-50%)',
};

const homeImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 12px 20px rgba(0, 0, 0, 0.45))',
};

const messageStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 'clamp(86px, 12vw, 132px)',
  transform: 'translateX(-50%)',
  margin: 0,
  color: '#f5f1e8',
  fontFamily: 'Georgia, serif',
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
};

function waitForNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function AvatarSlot({
  avatar,
  clickable,
  index,
  onSelect,
  style,
}: {
  avatar: PersistedAvatar | null;
  clickable: boolean;
  index: number;
  onSelect: (avatar: PersistedAvatar | null, index: number) => void;
  style?: CSSProperties;
}) {
  if (!avatar) {
    return (
      <button
        aria-label={`Create avatar in slot ${index + 1}`}
        disabled={!clickable}
        onClick={() => {
          onSelect(null, index);
        }}
        style={{ ...slotButtonStyle, ...style, cursor: clickable ? 'pointer' : 'default' }}
        type="button"
      >
        <img alt="Create Avatar" draggable={false} src={CREATE_AVATAR_ASSET} style={createImageStyle} />
      </button>
    );
  }

  return (
    <button
      aria-label={`Select ${avatar.name}`}
      disabled={!clickable}
      onClick={() => {
        onSelect(avatar, index);
      }}
      style={{ ...slotButtonStyle, ...style, cursor: clickable ? 'pointer' : 'default' }}
      title={`Portrait ${avatar.portrait}, Frame ${avatar.frame}`}
      type="button"
    >
      <AvatarCard avatar={avatar} />
    </button>
  );
}

export function AvatarSelect({
  avatars,
  avatarsLoaded = false,
  creationPreset = null,
  excludedAvatarIds = [],
  onCreationPresetConsumed,
  onBack,
  onEnterGame,
}: {
  avatars?: PersistedAvatar[];
  avatarsLoaded?: boolean;
  creationPreset?: PersistedAvatar | null;
  excludedAvatarIds?: string[];
  onCreationPresetConsumed?: () => void;
  onBack: () => void;
  onEnterGame: (avatar: PersistedAvatar, encounter: EncounterSnapshot) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [selectLayerVisible, setSelectLayerVisible] = useState(false);
  const [creationVisible, setCreationVisible] = useState(false);
  const [clickable, setClickable] = useState(false);
  const [creatingSlotIndex, setCreatingSlotIndex] = useState<number | null>(null);
  const [activeCreationPreset, setActiveCreationPreset] = useState<PersistedAvatar | null>(null);
  const [startedWithCreationPreset] = useState(() => creationPreset !== null);
  const [storedAvatars, setStoredAvatars] = useState<PersistedAvatar[]>([]);
  const [message, setMessage] = useState('');
  const resolvedAvatars = useMemo(
    () => {
      const excludedIds = new Set(excludedAvatarIds);
      const withoutExcluded = (candidateAvatars: PersistedAvatar[] | undefined) => (
        (candidateAvatars ?? []).filter((avatar) => !excludedIds.has(avatar.id))
      );

      if (storedAvatars.length > 0) {
        return withoutExcluded(storedAvatars);
      }

      if (avatarsLoaded) {
        return withoutExcluded(avatars);
      }

      return withoutExcluded(avatars);
    },
    [avatars, avatarsLoaded, excludedAvatarIds, storedAvatars],
  );
  const slots = Array.from({ length: 3 }, (_, index) => resolvedAvatars[index] ?? null);
  const hasNoAvatars = resolvedAvatars.length === 0;
  const triangleAreas = ['top', 'left', 'right'];

  useEffect(() => {
    if (!avatarsLoaded && (!avatars || avatars.length === 0)) {
      void fetchAvatars().then(setStoredAvatars).catch((error: unknown) => {
        console.error('Avatar list failed', error);
      });
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
      setSelectLayerVisible(!startedWithCreationPreset);
    }, 0);
    const clickableTimer = window.setTimeout(async () => {
      await waitForFade();
      setClickable(!startedWithCreationPreset);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clickableTimer);
    };
  }, [avatars, avatarsLoaded, startedWithCreationPreset]);

  useEffect(() => {
    if (!creationPreset) {
      return;
    }

    let cancelled = false;

    async function openPresetCreation(): Promise<void> {
      setClickable(false);
      setSelectLayerVisible(false);
      setCreationVisible(false);
      setActiveCreationPreset(creationPreset);
      setCreatingSlotIndex(0);
      await waitForNextPaint();

      if (!cancelled) {
        setCreationVisible(true);
        onCreationPresetConsumed?.();
      }
    }

    void openPresetCreation();

    return () => {
      cancelled = true;
    };
  }, [creationPreset, onCreationPresetConsumed]);

  async function handleHome(): Promise<void> {
    if (!clickable) {
      return;
    }

    setClickable(false);
    setVisible(false);
    await waitForFade();
    onBack();
  }

  async function handleSelect(
    candidate: PersistedAvatar | null,
    index: number,
  ): Promise<void> {
    if (!clickable) {
      return;
    }

    if (!candidate) {
      setClickable(false);
      setSelectLayerVisible(false);
      await waitForFade();
      setCreationVisible(false);
      setCreatingSlotIndex(index);
      await waitForNextPaint();
      setCreationVisible(true);
      return;
    }

    await enterWorld(candidate);
  }

  async function enterWorld(candidate: PersistedAvatar): Promise<void> {
    setClickable(false);
    setMessage('Entering Morkahja...');

    try {
      const { avatar: selectedAvatar, encounter } = await selectAvatar(candidate);
      setVisible(false);
      await waitForFade();
      onEnterGame(selectedAvatar, encounter);
    } catch (error) {
      console.error('Avatar selection failed', error);
      setMessage('Could not enter the world. Check the backend connection.');
      setClickable(true);
    }
  }

  async function closeCreation(): Promise<void> {
    setCreationVisible(false);
    await waitForFade();
    setCreatingSlotIndex(null);
    setActiveCreationPreset(null);
    setSelectLayerVisible(true);
    await waitForFade();
    setClickable(true);
  }

  async function confirmCreatedAvatar(avatar: PersistedAvatar): Promise<void> {
    setMessage('Creating avatar...');
    setCreationVisible(false);
    await waitForFade();

    try {
      await createAvatar(avatar);
      const refreshedAvatars = await fetchAvatars();
      setStoredAvatars(refreshedAvatars);
      setCreatingSlotIndex(null);
      setActiveCreationPreset(null);
      setSelectLayerVisible(true);
      setMessage('');
      await waitForFade();
      setClickable(true);
    } catch (error) {
      console.error('Avatar creation failed', error);
      setMessage('Could not create avatar. Check the backend connection.');
      setCreatingSlotIndex(null);
      setActiveCreationPreset(null);
      setSelectLayerVisible(true);
      await waitForFade();
      setClickable(true);
    }
  }

  return (
    <main aria-label="Avatar Selection" style={{ ...screenStyle, ...fadeStyle(visible) }}>
      <div style={{ ...selectLayerStyle, ...fadeStyle(selectLayerVisible), pointerEvents: selectLayerVisible ? 'auto' : 'none' }}>
        <section style={triangleGridStyle}>
          {slots.map((avatar, index) => (
            <AvatarSlot
              avatar={avatar}
              clickable={clickable && creatingSlotIndex === null}
              index={index}
              key={avatar?.id ?? `empty-${index}`}
              onSelect={(selectedAvatar, selectedIndex) => {
                void handleSelect(selectedAvatar, selectedIndex);
              }}
              style={{ gridArea: triangleAreas[index] }}
            />
          ))}
        </section>
        {hasNoAvatars ? <span style={createLabelStyle}>Create Avatar</span> : null}
        <button
          aria-label="Return home"
          disabled={!clickable || creatingSlotIndex !== null}
          onClick={() => {
            void handleHome();
          }}
          style={{ ...homeButtonStyle, cursor: clickable && creatingSlotIndex === null ? 'pointer' : 'default' }}
          type="button"
        >
          <img alt="" aria-hidden="true" draggable={false} src={HOME_BUTTON_ASSET} style={homeImageStyle} />
        </button>
      </div>
      {creatingSlotIndex !== null ? (
        <AvatarCreation
          onCancel={() => {
            void closeCreation();
          }}
          onConfirm={(avatar) => {
            void confirmCreatedAvatar(avatar);
          }}
          presetAvatar={activeCreationPreset}
          slotIndex={creatingSlotIndex}
          visible={creationVisible}
        />
      ) : null}
      {message ? <p style={messageStyle}>{message}</p> : null}
    </main>
  );
}

export default AvatarSelect;
