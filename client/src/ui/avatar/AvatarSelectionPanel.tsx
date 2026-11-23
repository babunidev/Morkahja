import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useImagesReady } from '../transitions/menuReadiness.js';
import {
  createAvatar,
  equipAvatarItem,
  fetchAvatars,
  type EncounterRoomSnapshotDto,
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
import { useTooltipReveal } from '../hooks/useTooltipReveal.js';
import { useNavButtonPress } from '../transitions/navButtonPress.js';
import { AVATAR_ENTER_SOURCE_ATTR } from './AvatarPortraitStack.js';
import AvatarCreation from './AvatarCreation.js';
import AvatarCard from './AvatarCard.js';
import { formatAvatarDisplayName, readAvatarDisplayTitle } from './avatarDisplayName.js';
import { assetUrl } from '../../assetUrl.js';
import { GameTooltipFrame } from '../game/GameTooltip.js';
import { isEquippableSolution } from '@shared/equipment.js';
import { gameSolutions } from '../../data/gameContent.js';
import { userFacingApiErrorMessage } from '../../api/httpErrorMessage.js';
import { SolutionGridOverlay } from '../game/blocks/SolutionGridOverlay.js';
import {
  AvatarOverviewContent,
  AvatarOverviewFooter,
  AvatarOverviewMenuCard,
  OVERVIEW_CLOSE_MS,
  OverviewEnterButton,
} from './AvatarOverview.js';
import { shownEquipmentSlots } from './equipmentSlots.js';

const CREATE_AVATAR_ASSET = assetUrl('/UI/03_DASHBOARD/CreateAvatar.webp');
const ACTIVE_AVATAR_STORAGE_KEY = 'morkahja:active-avatar';
const SWAP_MS = 420;

/** The active avatar stands where the Play button was (Babuni, 2026-11-23). */
const activeSlotStyle: CSSProperties = {
  flex: '0 0 auto',
  width: 'min(54vw, 320px)',
};

const activeRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
};

/** The other two, left and right under the active one: a triangle. */
const othersRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  width: 'min(92vw, 560px)',
  margin: 'clamp(-40px, -6vw, -20px) auto 0',
};

function readStoredActiveAvatarId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_AVATAR_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeActiveAvatarId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_AVATAR_STORAGE_KEY, id);
  } catch {
    // Only a convenience; the last played avatar is the fallback.
  }
}

/** The chosen one if it still exists, otherwise the one played last. */
function pickActiveAvatarId(avatars: PersistedAvatar[], chosen: string | null): string | null {
  if (chosen && avatars.some((avatar) => avatar.id === chosen)) {
    return chosen;
  }
  const lastPlayed = [...avatars].sort((left, right) => (right.lastPlayedAt ?? 0) - (left.lastPlayedAt ?? 0))[0];
  return lastPlayed?.id ?? null;
}

/** The inventory, opened from an empty equipment slot in the avatar card. */
const pickerShellStyle: CSSProperties = {
  position: 'fixed',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(calc(100vw - 32px), 560px)',
  height: 'min(72vh, 560px)',
  zIndex: 60,
};

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
    // The big active avatar and the two below it (Babuni, 2026-11-23).
    maxHeight: visible ? 'min(82vh, 760px)' : 0,
    marginTop: visible ? 'clamp(8px, 2vh, 20px)' : 0,
  };
}

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
  const displayTitle = readAvatarDisplayTitle(avatar);
  const baseName = avatar.name.trim() || 'Adventurer';

  return (
    <>
      {displayTitle ? (
        <span className="morkahja-avatar-slot-tooltip-title">{displayTitle}</span>
      ) : null}
      <span className={displayTitle ? 'morkahja-avatar-slot-tooltip-name' : 'morkahja-avatar-slot-tooltip-title'}>
        {baseName}
      </span>
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
  // A slot (a newly created avatar above all) appears once its pictures are
  // decoded, fading in where it belongs instead of popping in piece by piece.
  const artboardRef = useRef<HTMLDivElement | null>(null);
  const imagesReady = useImagesReady(
    artboardRef,
    avatar ? `${avatar.id}:${avatar.portrait}:${avatar.frame}` : 'create',
  );
  // An avatar opens its card on a tap instead of a hover tooltip (Babuni, 2026-11-23).
  const tooltipEnabled = clickable && !hiddenDuringEnter && avatar === null;
  const { visible: showTooltip, handlers: tooltipHandlers } = useTooltipReveal(tooltipEnabled);

  const slotButtonProps = {
    className: 'morkahja-avatar-slot-button',
    disabled: !clickable,
    ...tooltipHandlers,
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      pulse(pressKey);
      tooltipHandlers.onPointerDown?.(event);
    },
    style: {
      ...slotButtonStyle,
      ...style,
      cursor: clickable ? 'pointer' : 'default',
      opacity: hiddenDuringEnter || !imagesReady ? 0 : 1,
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
            <GameTooltipFrame background="rgba(12, 8, 6, 0.9)" />
            <span className="morkahja-avatar-slot-tooltip-title">Create avatar</span>
            <span className="morkahja-avatar-slot-tooltip-meta">Empty slot</span>
          </span>
          <div
            ref={artboardRef}
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
      aria-label={`Select ${formatAvatarDisplayName(avatar)}, level ${avatar.level}, ${avatar.race} ${avatar.role}`}
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
          <GameTooltipFrame background="rgba(12, 8, 6, 0.9)" />
          {avatarSlotTooltipContent(avatar)}
        </span>
        <div
          ref={artboardRef}
          style={{
            ...slotArtboardStyle,
            animation: pressAnimation(isPressed(pressKey)),
          }}
        >
          <AvatarCard avatar={avatar} enterSource enterSourceAvatarId={avatar.id} hideLabels />
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
  onAchievementCheck,
  onAvatarsChanged,
  onAvatarEnter,
  onCreationPresetConsumed,
  onEnterGameComplete,
  onCreationOpenChange,
  onEnterHandoffChange,
  onEnteringGameChange,
  onEnterWorldFailed,
  onFailedAvatarSelect,
  onHandoffLand,
  onPrepareGame,
  visible = false,
}: {
  avatars?: PersistedAvatar[];
  creationPreset?: PersistedAvatar | null;
  creationRevealDelayMs?: number;
  excludedAvatarIds?: string[];
  selectionNotice?: string | null;
  onAchievementCheck?: () => void;
  onAvatarsChanged?: (avatars: PersistedAvatar[]) => void;
  onAvatarEnter?: () => void;
  onCreationPresetConsumed?: () => void;
  onEnterGameComplete: () => void;
  onCreationOpenChange?: (open: boolean) => void;
  onEnterHandoffChange?: (snapshot: AvatarEnterHandoffSnapshot | null) => void;
  onEnteringGameChange?: (entering: boolean) => void;
  onEnterWorldFailed?: () => void;
  onFailedAvatarSelect?: (avatar: PersistedAvatar) => void;
  onHandoffLand?: () => void;
  onPrepareGame: (avatar: PersistedAvatar, room: EncounterRoomSnapshotDto) => void;
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
  // The active avatar (Babuni, 2026-11-23): the one played last, or the one
  // the player tapped; it stands big, the others below it.
  const [chosenActiveId, setChosenActiveId] = useState<string | null>(() => readStoredActiveAvatarId());
  const activeAvatarId = pickActiveAvatarId(resolvedAvatars, chosenActiveId);
  const activeIndex = activeAvatarId ? slots.findIndex((avatar) => avatar?.id === activeAvatarId) : 0;
  const orderedSlots = [
    { avatar: slots[activeIndex] ?? null, index: activeIndex },
    ...slots.map((avatar, index) => ({ avatar, index })).filter((entry) => entry.index !== activeIndex),
  ];
  const activeSourceRef = useRef<HTMLElement | null>(null);
  // The overview card (D-057) of the active avatar; the green check enters the world.
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewClosingInto, setOverviewClosingInto] = useState<{ current: HTMLElement | null } | null>(null);
  const [equipPickSlot, setEquipPickSlot] = useState<number | null>(null);
  const [equipPending, setEquipPending] = useState(false);
  const [equipError, setEquipError] = useState<string | null>(null);
  const cardAvatar = overviewOpen
    ? resolvedAvatars.find((avatar) => avatar.id === activeAvatarId) ?? null
    : null;

  function closeCard(): void {
    setOverviewOpen(false);
    setOverviewClosingInto(null);
    setEquipPickSlot(null);
    setEquipError(null);
  }

  // The swap: each avatar glides from where it stood to its new place.
  const slotElementsRef = useRef(new Map<string, HTMLElement>());
  const swapFromRectsRef = useRef<Map<string, DOMRect> | null>(null);
  function makeActive(avatar: PersistedAvatar): void {
    const rects = new Map<string, DOMRect>();
    slotElementsRef.current.forEach((element, id) => rects.set(id, element.getBoundingClientRect()));
    swapFromRectsRef.current = rects;
    storeActiveAvatarId(avatar.id);
    setChosenActiveId(avatar.id);
  }
  useLayoutEffect(() => {
    const from = swapFromRectsRef.current;
    if (!from) {
      return;
    }
    swapFromRectsRef.current = null;
    slotElementsRef.current.forEach((element, id) => {
      const before = from.get(id);
      if (!before) {
        return;
      }
      const after = element.getBoundingClientRect();
      if (after.width <= 0) {
        return;
      }
      const dx = before.left + before.width / 2 - (after.left + after.width / 2);
      const dy = before.top + before.height / 2 - (after.top + after.height / 2);
      const scale = before.width / after.width;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
        return;
      }
      element.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transform: 'translate(0, 0) scale(1)' },
        ],
        { duration: SWAP_MS, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' },
      );
    });
  }, [activeAvatarId]);

  async function equipIntoSlot(avatar: PersistedAvatar, slot: number, solutionId: number): Promise<void> {
    setEquipPickSlot(null);
    setEquipPending(true);
    setEquipError(null);
    try {
      const inventory = await equipAvatarItem(avatar.id, slot, solutionId);
      onAvatarsChanged?.(resolvedAvatars.map((entry) => (entry.id === avatar.id ? { ...entry, inventory } : entry)));
    } catch (error) {
      setEquipError(userFacingApiErrorMessage(error, 'Could not equip the item.'));
    } finally {
      setEquipPending(false);
    }
  }

  useEffect(() => {
    if (visible) {
      return;
    }

    setCreationVisible(false);
    setCreatingSlotIndex(null);
    setActiveCreationPreset(null);
    setMessage('');
    closeCard();
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

    if (candidate.id !== activeAvatarId) {
      makeActive(candidate);
      return;
    }

    if (candidate.status === 'failed' || candidate.status === 'deceased') {
      onFailedAvatarSelect?.(candidate);
      return;
    }

    // A tap on another avatar makes it the active one; a tap on the active
    // one opens its overview, whose green check enters the world.
    setEquipError(null);
    setEquipPickSlot(null);
    if (candidate.id !== activeAvatarId) {
      makeActive(candidate);
      return;
    }
    activeSourceRef.current = sourceElement;
    setOverviewOpen(true);
  }

  function enterFromOverview(candidate: PersistedAvatar): void {
    const source = activeSourceRef.current;
    if (!source) {
      return;
    }
    // The card shrinks into the big avatar, then the usual enter transition runs.
    setOverviewClosingInto({ current: source });
    window.setTimeout(() => {
      void enterWorld(candidate, source);
    }, OVERVIEW_CLOSE_MS);
  }

  async function enterWorld(candidate: PersistedAvatar, sourceElement: HTMLElement): Promise<void> {
    closeCard();
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
      onAchievementCheck?.();
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
        data-morkahja-avatar-selection=""
        style={avatarSlotsRevealStyle(visible)}
      >
        <section style={activeRowStyle}>
          {orderedSlots.slice(0, 1).map((entry, position) => (
              <div
                key={entry.avatar?.id ?? `empty-${entry.index}`}
                ref={(element) => {
                  if (entry.avatar) {
                    if (element) {
                      slotElementsRef.current.set(entry.avatar.id, element);
                    } else {
                      slotElementsRef.current.delete(entry.avatar.id);
                    }
                  }
                }}
                style={position === 0 ? activeSlotStyle : undefined}
              >
                <AvatarSlot
                  avatar={entry.avatar}
                  clickable={clickable && creatingSlotIndex === null && !overviewOpen}
                  hiddenDuringEnter={enteringGame}
                  index={entry.index}
                  onSelect={(selectedAvatar, selectedIndex, sourceElement) => {
                    void handleSelect(selectedAvatar, selectedIndex, sourceElement);
                  }}
                  style={position === 0 ? { width: '100%', flex: 'none' } : undefined}
                />
              </div>
            ))}
        </section>
        <section style={othersRowStyle}>
          {orderedSlots.slice(1).map((entry, offset) => ((entry, position) => (
              <div
                key={entry.avatar?.id ?? `empty-${entry.index}`}
                ref={(element) => {
                  if (entry.avatar) {
                    if (element) {
                      slotElementsRef.current.set(entry.avatar.id, element);
                    } else {
                      slotElementsRef.current.delete(entry.avatar.id);
                    }
                  }
                }}
                style={position === 0 ? activeSlotStyle : undefined}
              >
                <AvatarSlot
                  avatar={entry.avatar}
                  clickable={clickable && creatingSlotIndex === null && !overviewOpen}
                  hiddenDuringEnter={enteringGame}
                  index={entry.index}
                  onSelect={(selectedAvatar, selectedIndex, sourceElement) => {
                    void handleSelect(selectedAvatar, selectedIndex, sourceElement);
                  }}
                  style={position === 0 ? { width: '100%', flex: 'none' } : undefined}
                />
              </div>
            ))(entry, offset + 1))}
        </section>
        {(selectionNotice || message) && !enteringGame ? (
          <p style={messageStyle}>{selectionNotice || message}</p>
        ) : null}
      </div>
      {cardAvatar ? (
        <AvatarOverviewMenuCard
          closingInto={overviewClosingInto}
          footer={(
            <AvatarOverviewFooter
              onBack={closeCard}
              right={(
                <OverviewEnterButton
                  avatarName={formatAvatarDisplayName(cardAvatar)}
                  disabled={!clickable || equipPending || overviewClosingInto !== null}
                  onEnter={() => enterFromOverview(cardAvatar)}
                />
              )}
            />
          )}
          onBackdrop={overviewClosingInto ? undefined : closeCard}
        >
          <AvatarOverviewContent
            avatar={cardAvatar}
            inventory={cardAvatar.inventory}
            notice={equipError}
            onEquipSlot={equipPending ? undefined : (slot) => {
              setEquipError(null);
              setEquipPickSlot(slot);
            }}
          />
        </AvatarOverviewMenuCard>
      ) : null}
      {cardAvatar && equipPickSlot !== null ? (
        <div style={pickerShellStyle}>
          <SolutionGridOverlay
            ariaLabel="Inventory"
            emptyText="No item to equip."
            inventory={cardAvatar.inventory}
            inventoryType={2}
            onClose={() => {
              setEquipPickSlot(null);
            }}
            onPick={(solutionId) => {
              void equipIntoSlot(cardAvatar, equipPickSlot, solutionId);
            }}
            panelTitle="Choose an item"
            pickable={(entry) => {
              const solution = (gameSolutions() as Record<string, { mSolutionInventoryType: number; mSolutionType: number }>)[
                String(entry.solutionId)
              ];
              return isEquippableSolution(solution)
                && !shownEquipmentSlots(cardAvatar.inventory).includes(entry.solutionId);
            }}
            scrollDataAttribute="equipment-inventory-scroll"
            sourceContainer="items"
            visible
          />
        </div>
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
    </>
  );
}

export default AvatarSelectionPanel;
