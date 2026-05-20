import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  createAvatar,
  fetchAvatars,
  selectAvatar,
  type EncounterSnapshot,
  type PersistedAvatar,
} from '../../api/http.js';
import AvatarEnterHandoff from '../transitions/AvatarEnterHandoff.js';
import {
  AVATAR_ENTER_FADE_MS,
  AVATAR_ENTER_CENTER_GLOW_MS,
  AVATAR_ENTER_TO_CENTER_MS,
  AVATAR_ENTER_TO_GAME_MS,
  centerBounds,
  type AvatarEnterHandoffPhase,
  readBounds,
  waitForEnterTargetBounds,
  waitForNextPaint,
  waitMs,
  type Bounds,
} from '../transitions/avatarEnterTransition.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { AVATAR_ENTER_SOURCE_ATTR } from './AvatarPortraitStack.js';
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

const handoffScreenStyle: CSSProperties = {
  ...screenStyle,
  zIndex: 12,
  padding: 0,
  pointerEvents: 'none',
  background: 'transparent',
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

function AvatarSlot({
  avatar,
  clickable,
  hiddenDuringEnter,
  index,
  onSelect,
  style,
}: {
  avatar: PersistedAvatar | null;
  clickable: boolean;
  hiddenDuringEnter: boolean;
  index: number;
  onSelect: (avatar: PersistedAvatar | null, index: number, sourceElement: HTMLElement) => void;
  style?: CSSProperties;
}) {
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
  const pressKey = `avatar-slot-${index}`;

  if (!avatar) {
    return (
      <button
        aria-label={`Create avatar in slot ${index + 1}`}
        disabled={!clickable}
        onClick={(event) => {
          onSelect(null, index, event.currentTarget);
        }}
        onPointerDown={() => {
          pulse(pressKey);
        }}
        style={{
          ...slotButtonStyle,
          ...style,
          cursor: clickable ? 'pointer' : 'default',
          opacity: hiddenDuringEnter ? 0 : 1,
          transition: `opacity ${AVATAR_ENTER_FADE_MS}ms ease`,
        }}
        type="button"
      >
        <img
          alt="Create Avatar"
          draggable={false}
          src={CREATE_AVATAR_ASSET}
          style={{
            ...createImageStyle,
            animation: pressAnimation(isPressed(pressKey)),
          }}
        />
      </button>
    );
  }

  return (
    <button
      aria-label={`Select ${avatar.name}`}
      disabled={!clickable}
      onClick={(event) => {
        const source = event.currentTarget.querySelector(`[${AVATAR_ENTER_SOURCE_ATTR}]`);
        onSelect(
          avatar,
          index,
          source instanceof HTMLElement ? source : event.currentTarget,
        );
      }}
      onPointerDown={() => {
        pulse(pressKey);
      }}
      style={{
        ...slotButtonStyle,
        ...style,
        cursor: clickable ? 'pointer' : 'default',
        opacity: hiddenDuringEnter ? 0 : 1,
        transition: `opacity ${AVATAR_ENTER_FADE_MS}ms ease`,
      }}
      title={`Portrait ${avatar.portrait}, Frame ${avatar.frame}`}
      type="button"
    >
      <div
        style={{
          width: '100%',
          animation: pressAnimation(isPressed(pressKey)),
        }}
      >
        <AvatarCard avatar={avatar} enterSource />
      </div>
    </button>
  );
}

export function AvatarSelect({
  avatars,
  avatarsLoaded = false,
  creationPreset = null,
  excludedAvatarIds = [],
  handoffOverlayOnly = false,
  onCreationPresetConsumed,
  onBack,
  onEnterGameComplete,
  onPrepareGame,
}: {
  avatars?: PersistedAvatar[];
  avatarsLoaded?: boolean;
  creationPreset?: PersistedAvatar | null;
  excludedAvatarIds?: string[];
  handoffOverlayOnly?: boolean;
  onCreationPresetConsumed?: () => void;
  onBack: () => void;
  onPrepareGame: (avatar: PersistedAvatar, encounter: EncounterSnapshot) => void;
  onEnterGameComplete: () => void;
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
  const [enterHandoff, setEnterHandoff] = useState<{
    avatar: PersistedAvatar;
    bounds: Bounds;
    moveDurationMs: number;
    phase: AvatarEnterHandoffPhase;
  } | null>(null);
  const [enteringGame, setEnteringGame] = useState(false);
  const { pulse, isPressed, pressAnimation } = useNavButtonPress();
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
    sourceElement: HTMLElement,
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

    await enterWorld(candidate, sourceElement);
  }

  async function enterWorld(candidate: PersistedAvatar, sourceElement: HTMLElement): Promise<void> {
    setClickable(false);
    setEnteringGame(true);
    setMessage('');

    const fromBounds = readBounds(sourceElement);
    setEnterHandoff({
      avatar: candidate,
      bounds: fromBounds,
      moveDurationMs: 0,
      phase: 'to-center',
    });

    try {
      const { avatar: selectedAvatar, encounter } = await selectAvatar(candidate);
      onPrepareGame(selectedAvatar, encounter);

      setSelectLayerVisible(false);
      await waitForFade();

      const centerTarget = centerBounds(fromBounds);
      await waitForNextPaint();
      setEnterHandoff({
        avatar: selectedAvatar,
        bounds: centerTarget,
        moveDurationMs: AVATAR_ENTER_TO_CENTER_MS,
        phase: 'to-center',
      });
      await waitMs(AVATAR_ENTER_TO_CENTER_MS);

      setEnterHandoff({
        avatar: selectedAvatar,
        bounds: centerTarget,
        moveDurationMs: 0,
        phase: 'at-center',
      });
      await waitMs(AVATAR_ENTER_CENTER_GLOW_MS);

      const gameTarget = await waitForEnterTargetBounds();
      if (gameTarget) {
        await waitForNextPaint();
        setEnterHandoff({
          avatar: selectedAvatar,
          bounds: gameTarget,
          moveDurationMs: AVATAR_ENTER_TO_GAME_MS,
          phase: 'to-game',
        });
        await waitMs(AVATAR_ENTER_TO_GAME_MS);
      }

      setEnterHandoff(null);
      onEnterGameComplete();
    } catch (error) {
      console.error('Avatar selection failed', error);
      setEnterHandoff(null);
      setEnteringGame(false);
      setSelectLayerVisible(true);
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

  const mainStyle = handoffOverlayOnly || enteringGame
    ? handoffScreenStyle
    : screenStyle;

  return (
    <main aria-label="Avatar Selection" style={{ ...mainStyle, ...fadeStyle(visible) }}>
      {!handoffOverlayOnly ? (
      <div style={{ ...selectLayerStyle, ...fadeStyle(selectLayerVisible), pointerEvents: selectLayerVisible ? 'auto' : 'none' }}>
        <section style={triangleGridStyle}>
          {slots.map((avatar, index) => (
            <AvatarSlot
              avatar={avatar}
              clickable={clickable && creatingSlotIndex === null}
              hiddenDuringEnter={enteringGame}
              index={index}
              key={avatar?.id ?? `empty-${index}`}
              onSelect={(selectedAvatar, selectedIndex, sourceElement) => {
                void handleSelect(selectedAvatar, selectedIndex, sourceElement);
              }}
              style={{ gridArea: triangleAreas[index] }}
            />
          ))}
        </section>
        {hasNoAvatars ? <span style={{ ...createLabelStyle, ...fadeStyle(selectLayerVisible) }}>Create Avatar</span> : null}
        <button
          aria-label="Return home"
          disabled={!clickable || creatingSlotIndex !== null}
          onClick={() => {
            void handleHome();
          }}
          onPointerDown={() => {
            pulse('home');
          }}
          style={{ ...homeButtonStyle, cursor: clickable && creatingSlotIndex === null ? 'pointer' : 'default' }}
          type="button"
        >
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={HOME_BUTTON_ASSET}
            style={{
              ...homeImageStyle,
              animation: pressAnimation(isPressed('home')),
            }}
          />
        </button>
      </div>
      ) : null}
      {enterHandoff ? (
        <AvatarEnterHandoff
          avatar={enterHandoff.avatar}
          bounds={enterHandoff.bounds}
          glowAtCenter={enterHandoff.phase === 'at-center'}
          moveDurationMs={enterHandoff.moveDurationMs}
        />
      ) : null}
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
      {message && !enteringGame ? <p style={messageStyle}>{message}</p> : null}
    </main>
  );
}

export default AvatarSelect;
