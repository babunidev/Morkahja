import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  createAvatar,
  fetchAvatars,
  type EncounterSnapshot,
  type PersistedAvatar,
} from '../../api/http.js';

function uniqueAvatars(avatars: PersistedAvatar[] | undefined): PersistedAvatar[] {
  const seen = new Set<string>();

  return (avatars ?? []).filter((avatar) => {
    if (seen.has(avatar.id)) {
      return false;
    }

    seen.add(avatar.id);
    return true;
  });
}
import {
  AVATAR_ENTER_FADE_MS,
  runAvatarEnterHandoff,
  waitForNextPaint,
  type AvatarEnterHandoffSnapshot,
} from '../transitions/avatarEnterTransition.js';
import { FADE_DURATION_MS, waitForFade } from '../transitions/fade.js';
import { LEVEL_UP_SOUND, playSfx } from '../sfx.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { AVATAR_ENTER_SOURCE_ATTR } from './AvatarPortraitStack.js';
import AvatarCreation from './AvatarCreation.js';
import AvatarCard from './AvatarCard.js';

const CREATE_AVATAR_ASSET = '/UI/03_DASHBOARD/CreateAvatar.webp';

const slotPanelTransitionStyle: CSSProperties = {
  transition: 'opacity 420ms ease, transform 420ms ease, max-height 420ms ease, margin 420ms ease',
};

const embeddedWrapStyle: CSSProperties = {
  position: 'relative',
  width: 'min(92vw, 720px)',
  marginTop: 'clamp(8px, 2vh, 20px)',
  overflow: 'hidden',
};

function avatarSlotsRevealStyle(visible: boolean): CSSProperties {
  return {
    ...embeddedWrapStyle,
    ...slotPanelTransitionStyle,
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
    pointerEvents: visible ? 'auto' : 'none',
    visibility: visible ? 'visible' : 'hidden',
    overflow: visible ? 'visible' : 'hidden',
    maxHeight: visible ? 'min(42vh, 360px)' : 0,
    marginTop: visible ? 'clamp(8px, 2vh, 20px)' : 0,
  };
}

const slotsRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'clamp(6px, 1.6vw, 14px)',
  width: '100%',
};

const slotArtboardStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1.25',
  display: 'grid',
  placeItems: 'center',
};

const slotButtonStyle: CSSProperties = {
  position: 'relative',
  flex: '0 1 min(28vw, 200px)',
  width: 'min(28vw, 200px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  color: '#f5f1e8',
  cursor: 'pointer',
  textAlign: 'center',
};

const createImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  filter: 'drop-shadow(0 18px 28px rgba(0, 0, 0, 0.48))',
};

const messageStyle: CSSProperties = {
  margin: '12px 0 0',
  color: '#f5f1e8',
  fontFamily: 'Georgia, serif',
  textAlign: 'center',
  textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
};

function avatarSlotTooltipContent(avatar: PersistedAvatar): ReactNode {
  return (
    <>
      <span className="morkahja-avatar-slot-tooltip-title">{avatar.name}</span>
      <span className="morkahja-avatar-slot-tooltip-meta">
        Level {avatar.level} · {avatar.race} {avatar.role}
      </span>
    </>
  );
}

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
  const [hovered, setHovered] = useState(false);
  const showTooltip = hovered && clickable && !hiddenDuringEnter;

  const slotButtonProps = {
    className: 'morkahja-avatar-slot-button',
    disabled: !clickable,
    onBlur: () => {
      setHovered(false);
    },
    onFocus: () => {
      if (clickable && !hiddenDuringEnter) {
        setHovered(true);
      }
    },
    onMouseEnter: () => {
      if (clickable && !hiddenDuringEnter) {
        setHovered(true);
      }
    },
    onMouseLeave: () => {
      setHovered(false);
    },
    onPointerDown: () => {
      pulse(pressKey);
    },
    style: {
      ...slotButtonStyle,
      ...style,
      cursor: clickable ? 'pointer' : 'default',
      opacity: hiddenDuringEnter ? 0 : 1,
      transition: `opacity ${AVATAR_ENTER_FADE_MS}ms ease`,
    },
    type: 'button' as const,
  };

  if (!avatar) {
    return (
      <button
        {...slotButtonProps}
        aria-label={`Create avatar in slot ${index + 1}`}
        onClick={(event) => {
          onSelect(null, index, event.currentTarget);
        }}
      >
        <span className="morkahja-avatar-slot-visual">
          <span
            className={`morkahja-avatar-slot-tooltip${
              showTooltip ? ' morkahja-avatar-slot-tooltip--visible' : ''
            }`}
            role="tooltip"
          >
            <span className="morkahja-avatar-slot-tooltip-title">Create avatar</span>
            <span className="morkahja-avatar-slot-tooltip-meta">Empty slot</span>
          </span>
          <div
            style={{
              ...slotArtboardStyle,
              animation: pressAnimation(isPressed(pressKey)),
            }}
          >
            <img
              alt="Create Avatar"
              draggable={false}
              src={CREATE_AVATAR_ASSET}
              style={createImageStyle}
            />
          </div>
        </span>
      </button>
    );
  }

  return (
    <button
      {...slotButtonProps}
      aria-label={`Select ${avatar.name}, level ${avatar.level}, ${avatar.race} ${avatar.role}`}
      onClick={(event) => {
        const source = event.currentTarget.querySelector(`[${AVATAR_ENTER_SOURCE_ATTR}]`);
        onSelect(
          avatar,
          index,
          source instanceof HTMLElement ? source : event.currentTarget,
        );
      }}
    >
      <span className="morkahja-avatar-slot-visual">
        <span
          className={`morkahja-avatar-slot-tooltip${
            showTooltip ? ' morkahja-avatar-slot-tooltip--visible' : ''
          }`}
          role="tooltip"
        >
          {avatarSlotTooltipContent(avatar)}
        </span>
        <div
          style={{
            ...slotArtboardStyle,
            animation: pressAnimation(isPressed(pressKey)),
          }}
        >
          <AvatarCard avatar={avatar} enterSource hideLabels />
        </div>
      </span>
    </button>
  );
}

export function AvatarSelectionPanel({
  avatars,
  creationPreset = null,
  creationRevealDelayMs = 0,
  excludedAvatarIds = [],
  selectionNotice = null,
  onAvatarsChanged,
  onAvatarEnter,
  onCreationPresetConsumed,
  onEnterGameComplete,
  onCreationOpenChange,
  onEnterHandoffChange,
  onEnteringGameChange,
  onEnterWorldFailed,
  onHandoffLand,
  onPrepareGame,
  visible = false,
}: {
  avatars?: PersistedAvatar[];
  creationPreset?: PersistedAvatar | null;
  creationRevealDelayMs?: number;
  excludedAvatarIds?: string[];
  selectionNotice?: string | null;
  onAvatarsChanged?: (avatars: PersistedAvatar[]) => void;
  onAvatarEnter?: () => void;
  onCreationPresetConsumed?: () => void;
  onEnterGameComplete: () => void;
  onCreationOpenChange?: (open: boolean) => void;
  onEnterHandoffChange?: (snapshot: AvatarEnterHandoffSnapshot | null) => void;
  onEnteringGameChange?: (entering: boolean) => void;
  onEnterWorldFailed?: () => void;
  onHandoffLand?: () => void;
  onPrepareGame: (avatar: PersistedAvatar, encounter: EncounterSnapshot) => void;
  visible?: boolean;
}) {
  const [clickable, setClickable] = useState(false);
  const [creationVisible, setCreationVisible] = useState(false);
  const [creatingSlotIndex, setCreatingSlotIndex] = useState<number | null>(null);
  const [activeCreationPreset, setActiveCreationPreset] = useState<PersistedAvatar | null>(null);
  const [message, setMessage] = useState('');
  const [enteringGame, setEnteringGame] = useState(false);
  const resolvedAvatars = useMemo(
    () => {
      const excludedIds = new Set(excludedAvatarIds);

      return uniqueAvatars(avatars).filter((avatar) => !excludedIds.has(avatar.id));
    },
    [avatars, excludedAvatarIds],
  );
  const slots = Array.from({ length: 3 }, (_, index) => resolvedAvatars[index] ?? null);

  useEffect(() => {
    if (visible) {
      return;
    }

    setCreationVisible(false);
    setCreatingSlotIndex(null);
    setActiveCreationPreset(null);
    setMessage('');
  }, [visible]);

  useEffect(() => {
    onCreationOpenChange?.(creatingSlotIndex !== null && creationVisible);
  }, [creatingSlotIndex, creationVisible, onCreationOpenChange]);

  useEffect(() => {
    if (!visible) {
      setClickable(false);
      return;
    }

    let cancelled = false;
    const enableTimer = window.setTimeout(() => {
      if (!cancelled) {
        setClickable(true);
      }
    }, FADE_DURATION_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(enableTimer);
    };
  }, [visible]);

  useEffect(() => {
    if (!creationPreset || !visible) {
      return;
    }

    let cancelled = false;

    async function openPresetCreation(): Promise<void> {
      setClickable(false);
      setCreationVisible(false);
      setActiveCreationPreset(creationPreset);
      setCreatingSlotIndex(0);
      await waitForNextPaint();

      if (creationRevealDelayMs > 0) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, creationRevealDelayMs);
        });
      }

      if (!cancelled) {
        setCreationVisible(true);
        onCreationPresetConsumed?.();
      }
    }

    void openPresetCreation();

    return () => {
      cancelled = true;
    };
  }, [creationPreset, creationRevealDelayMs, onCreationPresetConsumed, visible]);

  async function handleSelect(
    candidate: PersistedAvatar | null,
    index: number,
    sourceElement: HTMLElement,
  ): Promise<void> {
    if (!clickable) {
      return;
    }

    if (!candidate) {
      setCreatingSlotIndex(index);
      setCreationVisible(false);
      await waitForNextPaint();
      setCreationVisible(true);
      return;
    }

    await enterWorld(candidate, sourceElement);
  }

  async function enterWorld(candidate: PersistedAvatar, sourceElement: HTMLElement): Promise<void> {
    setClickable(false);
    setEnteringGame(true);
    onEnteringGameChange?.(true);
    setMessage('');
    playSfx(LEVEL_UP_SOUND);
    onAvatarEnter?.();

    try {
      await runAvatarEnterHandoff({
        candidate,
        onEnterHandoffChange: (snapshot) => {
          onEnterHandoffChange?.(snapshot);
        },
        onHandoffLand: () => {
          onHandoffLand?.();
        },
        onPrepareGame,
        sourceElement,
      });
      setEnteringGame(false);
      onEnteringGameChange?.(false);
      onEnterGameComplete();
    } catch (error) {
      console.error('Avatar selection failed', error);
      onEnterHandoffChange?.(null);
      onEnterWorldFailed?.();
      setEnteringGame(false);
      onEnteringGameChange?.(false);
      setMessage('Could not enter the world. Check the backend connection.');
      setClickable(true);
    }
  }

  async function closeCreation(): Promise<void> {
    setCreationVisible(false);
    await waitForFade();
    setCreatingSlotIndex(null);
    setActiveCreationPreset(null);
    setClickable(true);
  }

  async function confirmCreatedAvatar(avatar: PersistedAvatar): Promise<void> {
    setMessage('Creating avatar...');
    setCreationVisible(false);
    await waitForFade();

    try {
      await createAvatar(avatar);
      const refreshedAvatars = uniqueAvatars(await fetchAvatars());
      onAvatarsChanged?.(refreshedAvatars);
      setCreatingSlotIndex(null);
      setActiveCreationPreset(null);
      setMessage('');
      setClickable(true);
    } catch (error) {
      console.error('Avatar creation failed', error);
      setMessage('Could not create avatar. Check the backend connection.');
      setCreatingSlotIndex(null);
      setActiveCreationPreset(null);
      setClickable(true);
    }
  }

  return (
    <>
      <div
        aria-label="Avatar selection"
        style={avatarSlotsRevealStyle(visible)}
      >
        <section style={slotsRowStyle}>
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
            />
          ))}
        </section>
        {(selectionNotice || message) && !enteringGame ? (
          <p style={messageStyle}>{selectionNotice || message}</p>
        ) : null}
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
    </>
  );
}

export default AvatarSelectionPanel;
