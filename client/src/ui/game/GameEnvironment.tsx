import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import encountersData from '../../data/game/encountersdata.json';
import solutionData from '../../data/game/solutiondata.json';
import {
  createEncounterRoom,
  fetchActiveRoom,
  ROOM_POLL_MS,
  requestRoomHelp,
  submitRoomChoice,
  submitRoomContinue,
  submitRoomFocus,
  submitRoomSlotState,
  type EncounterAction,
  type EncounterRoomSnapshotDto,
  type EncounterSnapshot,
  type PersistedAvatar,
  type SlotStateDto,
} from '../../api/http.js';
import { ApiRequestError } from '../../api/httpErrorMessage.js';
import { normalizePersistedAvatar } from '../avatar/avatarDisplayName.js';
import GameLayout from '../layout/GameLayout.js';
import { LEVEL_UP_SOUND, playSfx } from '../sfx.js';
import { interpretRoll } from './encounterInventoryPreview.js';
import {
  ENCOUNTER_ACTIONS_REVEAL_DELAY_MS,
  encounterFadeTransition,
  fadeStyle,
  waitForFade,
} from '../transitions/fade.js';
import EncounterHeader from './blocks/EncounterHeader.js';
import EncounterImageBlock from './blocks/EncounterImageBlock.js';
import type { ResultBlockHandle } from './blocks/ResultBlock.js';
import PlayerHub from './blocks/PlayerHub.js';
import GameMessageToast from './GameMessageToast.js';
import {
  continueReadinessClass,
  isPartySession,
  localContinuePressed,
  multiplayerContinueWaiting,
  shouldDeferRewardDismiss,
} from './roomContinue.js';

const ENCOUNTER_IMAGE_ROOT = '/game/encounterimages';

interface EncounterDataRecord {
  mEncounterID: number;
  mEncounterImageName: string;
  mEncounterTitle: string;
}

interface SolutionDataRecord {
  mSolutionID: number;
  mSolutionName: string;
}

const solutionsById = solutionData as Record<string, SolutionDataRecord>;

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = src;
  });
}

interface GameEnvironmentProps {
  deathPending?: boolean;
  deferReveal?: boolean;
  hideAvatarPortraitForHandoff?: boolean;
  initialAvatar: PersistedAvatar;
  initialEncounter: EncounterSnapshot;
  initialRoom?: EncounterRoomSnapshotDto | null;
  onAchievementCheck?: () => void;
  onAvatarDeath: (presetAvatar: PersistedAvatar) => void;
  onHome: () => void;
}

const topZoneStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '15% minmax(0, 1fr)',
};

const headerSlotStyle: CSSProperties = { minHeight: 0 };

const headerSlotRaisedStyle: CSSProperties = {
  position: 'relative',
  zIndex: 25,
};

const encounterImageSlotStyle: CSSProperties = {
  gridRow: '2',
  gridColumn: '1',
  minHeight: 0,
  width: '100%',
  display: 'flex',
};

function delayStyle(visible: boolean, order: number): CSSProperties {
  return {
    ...fadeStyle(visible),
    transitionDelay: visible ? `${order * 120}ms` : '0ms',
  };
}

function encounterRevealStyle(visible: boolean, delayMs = 120): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transition: encounterFadeTransition,
    transitionDelay: visible ? `${delayMs}ms` : '0ms',
  };
}

function encounterLookup(encounterId: number): EncounterDataRecord | null {
  const directKey = String(encounterId).padStart(5, '0');
  const records = encountersData as Record<string, EncounterDataRecord>;
  return records[directKey] ?? records[String(encounterId)] ?? null;
}

function imagePath(imageName: string): string {
  const fileName = imageName.endsWith('.webp') ? imageName : `${imageName}.webp`;
  return `${ENCOUNTER_IMAGE_ROOT}/${fileName}`;
}

function rewardName(rewardId: number): string {
  return solutionsById[String(rewardId)]?.mSolutionName ?? `Reward ${rewardId}`;
}

function applyRoomSnapshot(
  room: EncounterRoomSnapshotDto,
  setRoom: (room: EncounterRoomSnapshotDto | null) => void,
  setEncounter: (encounter: EncounterSnapshot) => void,
  setAvatar: (avatar: PersistedAvatar) => void,
  currentAvatar: PersistedAvatar,
  currentRoom: EncounterRoomSnapshotDto | null,
): boolean {
  if (currentRoom && room.updatedAt < currentRoom.updatedAt) {
    return false;
  }

  setRoom(room);
  setEncounter(room.activeEncounter);
  const localParticipant = room.participants.find((participant) => participant.isLocal);
  const mergeCommittedInventory = room.roomState === 'active_encounter';
  if (localParticipant?.avatar) {
    setAvatar(normalizePersistedAvatar({
      ...currentAvatar,
      ...localParticipant.avatar,
      inventory: mergeCommittedInventory
        ? (localParticipant.avatar.inventory ?? currentAvatar.inventory)
        : currentAvatar.inventory,
    }));
  }

  return true;
}

function isSoloRoom(room: EncounterRoomSnapshotDto): boolean {
  return !isPartySession(room);
}

function currentFocusState(
  loreOpen: boolean,
  inventoryOpen: boolean,
  skillbookOpen: boolean,
): 'none' | 'lore' | 'inventory' | 'skillbook' {
  if (loreOpen) return 'lore';
  if (inventoryOpen) return 'inventory';
  if (skillbookOpen) return 'skillbook';
  return 'none';
}

export function GameEnvironment({
  deferReveal = false,
  hideAvatarPortraitForHandoff = false,
  initialAvatar,
  initialEncounter,
  initialRoom = null,
  deathPending = false,
  onAchievementCheck,
  onAvatarDeath,
  onHome,
}: GameEnvironmentProps) {
  const [visible, setVisible] = useState(!deferReveal);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [encounter, setEncounter] = useState(initialEncounter);
  const [room, setRoom] = useState<EncounterRoomSnapshotDto | null>(initialRoom);
  const [continuePending, setContinuePending] = useState(false);
  const [loreOpen, setLoreOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [skillbookOpen, setSkillbookOpen] = useState(false);
  const [homeVisible, setHomeVisible] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [helpToastMessage, setHelpToastMessage] = useState<string | null>(null);
  const [resultRollVisible, setResultRollVisible] = useState(false);
  const dismissHelpToast = useCallback(() => {
    setHelpToastMessage(null);
  }, []);
  const avatarRef = useRef(avatar);
  const roomRef = useRef(room);
  const continueSubmitInFlightRef = useRef(false);
  const resultBlockRef = useRef<ResultBlockHandle>(null);
  avatarRef.current = avatar;
  roomRef.current = room;

  const localParticipant = room?.participants.find((participant) => participant.isLocal);
  const serverResolution = localParticipant?.preparedResult ?? localParticipant?.resolutionSummary;

  const encounterData = useMemo(
    () => encounterLookup(encounter.encounterId),
    [encounter.encounterId],
  );
  const title = encounter.encounterTitle ?? encounterData?.mEncounterTitle ?? 'Encounter';
  const encounterImageName = encounter.encounterImageName
    ?? encounterData?.mEncounterImageName
    ?? 'im_encounter_placeholder_bg_new';
  const preparedEncounterId = encounter.preparedEncounter?.encounterId;
  const preparedEncounterData = useMemo(
    () => (preparedEncounterId ? encounterLookup(preparedEncounterId) : null),
    [preparedEncounterId],
  );
  const nextEncounterImageSrc = preparedEncounterData?.mEncounterImageName
    ? imagePath(preparedEncounterData.mEncounterImageName)
    : undefined;

  useEffect(() => {
    if (nextEncounterImageSrc) {
      void preloadImage(nextEncounterImageSrc);
    }
  }, [nextEncounterImageSrc]);

  useEffect(() => {
    setResultRollVisible(false);
  }, [encounter.snapshotId]);

  useEffect(() => {
    if (deferReveal) {
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(timer);
  }, [deferReveal]);

  useEffect(() => {
    let cancelled = false;

    async function ensureRoom(): Promise<void> {
      try {
        const active = await fetchActiveRoom(avatarRef.current.id);
        if (cancelled) {
          return;
        }
        if (active) {
          applyRoomSnapshot(
            active,
            setRoom,
            setEncounter,
            setAvatar,
            avatarRef.current,
            roomRef.current,
          );
          return;
        }
        const created = await createEncounterRoom(avatarRef.current.id);
        if (!cancelled) {
          applyRoomSnapshot(
            created,
            setRoom,
            setEncounter,
            setAvatar,
            avatarRef.current,
            roomRef.current,
          );
        }
      } catch (error) {
        console.error('Failed to initialize encounter room', error);
      }
    }

    if (!initialRoom) {
      void ensureRoom();
    }

    const poll = window.setInterval(() => {
      void fetchActiveRoom(avatarRef.current.id).then(async (nextRoom) => {
        if (!nextRoom || cancelled || continueSubmitInFlightRef.current) {
          return;
        }

        const currentRoom = roomRef.current;
        const shouldDismissBeforeAdvance = Boolean(
          currentRoom
          && (currentRoom.roomState === 'waiting_continue' || currentRoom.roomState === 'advancing')
          && (nextRoom.roomState === 'active_encounter' || nextRoom.roomState === 'advancing')
          && currentRoom.participants.some(
            (participant) => participant.isLocal && (
              participant.preparedResult !== undefined ||
              participant.resolutionSummary !== undefined
            ),
          ),
        );

        if (shouldDismissBeforeAdvance) {
          await resultBlockRef.current?.playDismissAnimations().catch(() => undefined);
        }

        applyRoomSnapshot(
          nextRoom,
          setRoom,
          setEncounter,
          setAvatar,
          avatarRef.current,
          roomRef.current,
        );

        const local = nextRoom.participants.find((participant) => participant.isLocal);
        if (local?.resolutionSummary?.avatarDied) {
          onAvatarDeath(local.avatar);
        }
      }).catch(() => undefined);
    }, ROOM_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [initialRoom, onAvatarDeath]);

  useEffect(() => {
    if (!room) {
      return;
    }
    const focusState = currentFocusState(loreOpen, inventoryOpen, skillbookOpen);
    if (localParticipant?.focusState === focusState) {
      return;
    }
    void submitRoomFocus(avatarRef.current.id, focusState)
      .then((nextRoom) => {
        applyRoomSnapshot(
          nextRoom,
          setRoom,
          setEncounter,
          setAvatar,
          avatarRef.current,
          roomRef.current,
        );
      })
      .catch(() => undefined);
  }, [loreOpen, inventoryOpen, skillbookOpen, room?.roomId, localParticipant?.focusState]);

  async function syncEncounterRoom(): Promise<EncounterRoomSnapshotDto | null> {
    const active = await fetchActiveRoom(avatarRef.current.id);
    if (active) {
      applyRoomSnapshot(
        active,
        setRoom,
        setEncounter,
        setAvatar,
        avatarRef.current,
        roomRef.current,
      );
      return active;
    }

    const created = await createEncounterRoom(avatarRef.current.id);
    applyRoomSnapshot(
      created,
      setRoom,
      setEncounter,
      setAvatar,
      avatarRef.current,
      roomRef.current,
    );
    return created;
  }

  function appendActionLog(entries: string[]): void {
    setActionLog((currentLog) => [...currentLog, ...entries].slice(-24));
  }

  async function advanceResolvedEncounter(
    currentRoom: EncounterRoomSnapshotDto,
  ): Promise<EncounterRoomSnapshotDto> {
    setLoreOpen(false);
    setInventoryOpen(false);
    setSkillbookOpen(false);

    continueSubmitInFlightRef.current = true;

    try {
      let workingRoom = currentRoom;
      const local = workingRoom.participants.find((participant) => participant.isLocal);
      if (local?.focusState !== 'none') {
        workingRoom = await submitRoomFocus(avatarRef.current.id, 'none');
        applyRoomSnapshot(
          workingRoom,
          setRoom,
          setEncounter,
          setAvatar,
          avatarRef.current,
          roomRef.current,
        );
      }

      const nextRoom = await submitRoomContinue(avatarRef.current.id);
      const advancedFromWaiting = currentRoom.roomState === 'waiting_continue'
        && nextRoom.roomState === 'active_encounter';

      if (advancedFromWaiting) {
        await resultBlockRef.current?.playDismissAnimations().catch(() => undefined);
      }

      applyRoomSnapshot(
        nextRoom,
        setRoom,
        setEncounter,
        setAvatar,
        avatarRef.current,
        roomRef.current,
      );

      return nextRoom;
    } finally {
      continueSubmitInFlightRef.current = false;
    }
  }

  async function handleContinueEncounter(
    action: EncounterAction,
    _selectedRoll: number | null,
    selectedSolutionId: number | null,
  ): Promise<void> {
    if (continuePending || deathPending) {
      appendActionLog(['Continue blocked: another action is in progress.']);
      return;
    }

    setContinuePending(true);

    try {
      let currentRoom = roomRef.current;
      if (!currentRoom) {
        currentRoom = await syncEncounterRoom();
      }

      if (!currentRoom) {
        appendActionLog(['Continue failed: Could not sync encounter room.']);
        return;
      }

      if (currentRoom.roomState === 'waiting_continue') {
        const nextRoom = await advanceResolvedEncounter(currentRoom);
        appendActionLog([
          nextRoom.roomState === 'active_encounter'
            ? 'Continue: Encounter advanced.'
            : 'Continue: Waiting for other players.',
        ]);
        onAchievementCheck?.();
        return;
      }

      if (currentRoom.roomState === 'system_event' && currentRoom.systemEvent?.isLocalWitness) {
        appendActionLog(['Only the actor can resolve this moment.']);
        return;
      }

      let nextRoom = await submitRoomChoice(
        avatarRef.current.id,
        action,
        selectedSolutionId ?? undefined,
      );
      applyRoomSnapshot(
        nextRoom,
        setRoom,
        setEncounter,
        setAvatar,
        avatarRef.current,
        roomRef.current,
      );

      const local = nextRoom.participants.find((participant) => participant.isLocal);
      const summary = local?.preparedResult ?? local?.resolutionSummary;
      if (summary) {
        const outcome = summary.selectedRoll === undefined
          ? ''
          : interpretRoll(summary.selectedRoll);
        appendActionLog([
          `Encounter: ${title}`,
          selectedSolutionId ? `Solution: ${rewardName(selectedSolutionId)}` : 'Solution: Dice',
          summary.selectedRoll !== undefined
            ? `Roll: ${summary.selectedRoll}${outcome ? ` (${outcome})` : ''}`
            : 'Roll: unknown',
          summary.message ? `Result: ${summary.message}` : '',
        ]);
      } else {
        appendActionLog([`Continue: Room state is ${nextRoom.roomState}.`]);
      }

      const shouldAutoAcknowledgeSystemEvent =
        currentRoom.roomState === 'system_event' &&
        currentRoom.systemEvent?.isLocalActor === true &&
        nextRoom.roomState === 'waiting_continue' &&
        nextRoom.systemEvent?.lastEventRecap !== undefined;
      if (shouldAutoAcknowledgeSystemEvent) {
        nextRoom = await advanceResolvedEncounter(nextRoom);
        appendActionLog([
          nextRoom.roomState === 'active_encounter'
            ? 'Continue: Encounter advanced.'
            : 'Continue: Waiting for other players.',
        ]);
      }

      if (
        nextRoom.roomState === 'waiting_continue' &&
        isSoloRoom(nextRoom) &&
        !isPostSystemWaitingContinue(nextRoom) &&
        !shouldAutoAcknowledgeSystemEvent
      ) {
        nextRoom = await advanceResolvedEncounter(nextRoom);
        appendActionLog([
          nextRoom.roomState === 'active_encounter'
            ? 'Continue: Encounter advanced.'
            : 'Continue: Waiting for other players.',
        ]);
      }

      if (summary?.avatarDied) {
        onAvatarDeath(local?.avatar ?? avatar);
      }

      if (local && local.avatar.level > avatar.level) {
        playSfx(LEVEL_UP_SOUND);
      }

      onAchievementCheck?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not continue encounter.';
      appendActionLog([`Continue failed: ${message}`]);
    } finally {
      setContinuePending(false);
    }
  }

  const helpCalled = room?.helpCalledForEncounter ?? false;

  async function handleCallForHelp(): Promise<void> {
    if (helpCalled) {
      return;
    }

    try {
      const result = await requestRoomHelp(avatar.id);
      if (result.invitedCount === 0) {
        setHelpToastMessage('No one could hear you.');
      } else {
        const adventurerLabel = result.invitedCount === 1 ? 'adventurer has' : 'adventurers have';
        setHelpToastMessage(
          `You called for help, ${result.invitedCount} ${adventurerLabel} heard you.`,
        );
      }

      const nextRoom = await fetchActiveRoom(avatarRef.current.id);
      if (nextRoom) {
        applyRoomSnapshot(
          nextRoom,
          setRoom,
          setEncounter,
          setAvatar,
          avatarRef.current,
          roomRef.current,
        );
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        const nextRoom = await fetchActiveRoom(avatarRef.current.id);
        if (nextRoom) {
          applyRoomSnapshot(
            nextRoom,
            setRoom,
            setEncounter,
            setAvatar,
            avatarRef.current,
            roomRef.current,
          );
        }
        return;
      }
      setHelpToastMessage('No one could hear you.');
    }
  }

  async function handleSlotStateChange(
    slotIndex: number,
    slotState: SlotStateDto,
  ): Promise<void> {
    try {
      const nextRoom = await submitRoomSlotState(avatarRef.current.id, slotIndex, slotState);
      applyRoomSnapshot(
        nextRoom,
        setRoom,
        setEncounter,
        setAvatar,
        avatarRef.current,
        roomRef.current,
      );
    } catch (error) {
      console.error('Failed to update party slot state', error);
    }
  }

  async function handleHome(): Promise<void> {
    setVisible(false);
    await waitForFade();
    onHome();
  }

  const bottomDelay: CSSProperties = {
    ...fadeStyle(visible),
    transitionDelay: visible ? '160ms' : '0ms',
  };

  const systemEvent = room?.systemEvent;
  const isWitnessMode = room?.roomState === 'system_event' && systemEvent?.isLocalWitness === true;
  const systemEventActor = systemEvent
    ? room?.participants.find((participant) => participant.playerId === systemEvent.actorPlayerId)
    : undefined;
  const postSystemRecap = room?.roomState === 'waiting_continue'
    ? systemEvent?.lastEventRecap
    : undefined;
  const displayResolution = postSystemRecap ?? serverResolution;

  const waitingForResolution = room?.roomState === 'resolving' || room?.roomState === 'advancing';
  const showServerResult = displayResolution !== undefined && (
    room?.roomState === 'waiting_continue' ||
    room?.roomState === 'advancing' ||
    localParticipant?.preparedResult !== undefined
  );
  const deferRewardDismiss = shouldDeferRewardDismiss(room, resultRollVisible);
  const partyContinueWaiting = multiplayerContinueWaiting(room);
  const localHasContinuePressed = room ? localContinuePressed(room) : false;
  const continueGlow = continueReadinessClass(room?.continueReadiness);
  const loreGemCollected = localParticipant?.loreGemCollected === true;
  const showLoreGemReward = loreGemCollected && encounter.loreGemOffer?.eligible === true;

  function applyLoreGemRoomSnapshot(nextRoom: EncounterRoomSnapshotDto): void {
    applyRoomSnapshot(
      nextRoom,
      setRoom,
      setEncounter,
      setAvatar,
      avatarRef.current,
      roomRef.current,
    );
  }

  function isPostSystemWaitingContinue(currentRoom: EncounterRoomSnapshotDto): boolean {
    return currentRoom.roomState === 'waiting_continue'
      && currentRoom.systemEvent?.lastEventRecap !== undefined;
  }

  return (
    <div aria-label="Game Environment" style={fadeStyle(visible)}>
      {helpToastMessage ? (
        <GameMessageToast
          message={helpToastMessage}
          onDismiss={dismissHelpToast}
        />
      ) : null}
      <GameLayout
        top={
          <div style={{ ...topZoneStyle, ...delayStyle(visible, 0) }}>
            <div
              style={{
                ...headerSlotStyle,
                ...(inventoryOpen || skillbookOpen ? headerSlotRaisedStyle : {}),
              }}
            >
              <EncounterHeader
                overlayTitle={
                  inventoryOpen
                    ? 'Inventory'
                    : skillbookOpen
                      ? 'Skillbook'
                      : null
                }
                title={title}
              />
            </div>
            <div
              style={{
                ...encounterImageSlotStyle,
                ...(inventoryOpen || skillbookOpen || loreOpen
                  ? { position: 'relative', zIndex: 26 }
                  : {}),
                ...encounterRevealStyle(visible, ENCOUNTER_ACTIONS_REVEAL_DELAY_MS),
              }}
            >
              <EncounterImageBlock
                avatarId={avatar.id}
                continueGlowClass={continueGlow}
                continuePending={continuePending || deathPending || waitingForResolution}
                deferRewardDismiss={deferRewardDismiss}
                encounter={encounter}
                loreGemCollected={loreGemCollected}
                onRoomSnapshot={applyLoreGemRoomSnapshot}
                showLoreGemReward={showLoreGemReward}
                imageSrc={imagePath(encounterImageName)}
                inventory={avatar.inventory}
                inventoryOpen={inventoryOpen}
                localContinuePressed={localHasContinuePressed}
                loreOpen={loreOpen}
                multiplayerContinueWaiting={partyContinueWaiting}
                onContinue={handleContinueEncounter}
                onResultsVisibleChange={setResultRollVisible}
                resultBlockRef={resultBlockRef}
                roomState={room?.roomState ?? 'active_encounter'}
                serverResolution={showServerResult ? displayResolution : undefined}
                witnessMode={isWitnessMode}
                systemEventActorName={systemEventActor?.playerName}
                skillbookOpen={skillbookOpen}
                title={title}
              />
            </div>
          </div>
        }
        bottom={
          <div style={{ width: '100%', height: '100%', ...bottomDelay }}>
            <PlayerHub
              actionLog={actionLog}
              avatar={avatar}
              hideAvatarPortraitForHandoff={hideAvatarPortraitForHandoff}
              homeVisible={homeVisible}
              onAvatarDetailsVisibleChange={setHomeVisible}
              onCallForHelp={() => {
                void handleCallForHelp();
              }}
              helpCalled={helpCalled}
              onHome={() => {
                void handleHome();
              }}
              onInventoryToggle={() => {
                setInventoryOpen((open) => {
                  const next = !open;
                  if (next) {
                    setLoreOpen(false);
                    setSkillbookOpen(false);
                  }
                  return next;
                });
              }}
              onSkillbookToggle={() => {
                setSkillbookOpen((open) => {
                  const next = !open;
                  if (next) {
                    setLoreOpen(false);
                    setInventoryOpen(false);
                  }
                  return next;
                });
              }}
              onLoreToggle={() => {
                setLoreOpen((open) => {
                  const next = !open;
                  if (next) {
                    setInventoryOpen(false);
                    setSkillbookOpen(false);
                  }
                  return next;
                });
              }}
              onSlotStateChange={(slotIndex, slotState) => {
                void handleSlotStateChange(slotIndex, slotState);
              }}
              room={room}
              roomState={room?.roomState}
            />
          </div>
        }
      />
    </div>
  );
}

export default GameEnvironment;
