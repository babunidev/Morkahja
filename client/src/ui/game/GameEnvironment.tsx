import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import encountersData from '../../data/game/encountersdata.json';
import solutionData from '../../data/game/solutiondata.json';
import {
  diceButtonAssetPath,
  DEFAULT_DICE_ID,
  isDiceId,
} from '@shared/diceCatalog.js';
import {
  fetchActiveRoom,
  fetchActiveRoomState,
  fetchPlayer,
  ROOM_POLL_MS,
  requestRoomHelp,
  submitRoomChoice,
  submitRoomContinue,
  submitRoomFocus,
  submitRoomSlotState,
  kickRoomParticipant,
  leaveAllEncounterRooms,
  type EncounterAction,
  type EncounterRoomSnapshotDto,
  type EncounterSnapshot,
  type PersistedAvatar,
  type SlotStateDto,
} from '../../api/http.js';
import { ApiRequestError } from '../../api/httpErrorMessage.js';
import { formatAvatarDisplayName, normalizePersistedAvatar } from '../avatar/avatarDisplayName.js';
import { ensureSoloLeaderRoom } from './roomSession.js';
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
import EncounterHeaderSeam from './blocks/EncounterHeaderSeam.js';
import EncounterImageBlock from './blocks/EncounterImageBlock.js';
import type { ResultBlockHandle } from './blocks/ResultBlock.js';
import PlayerHub from './blocks/PlayerHub.js';
import GameMessageToast from './GameMessageToast.js';
import {
  continueGlowClassForRoom,
  localContinuePressed,
  localNeedsContinueAck,
  localWaitingForRoomAdvance,
  shouldDeferRewardDismiss,
} from './roomContinue.js';
import { witnessSystemEventDisplay } from './witnessSystemEventDisplay.js';
import {
  encounterSnapshotAdvanced,
  runEncounterAdvanceTransition,
} from './roomAdvanceOrchestrator.js';

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
  onKickedFromParty?: () => void;
  onHome: () => void;
}

const topZoneStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '15% minmax(0, 1fr)',
};

/** Header row (title + seam) always stacks above the encounter row and its overlays (lore, inventory, results). */
const ENCOUNTER_HEADER_ROW_Z_INDEX = 50;

const headerSlotStyle: CSSProperties = {
  position: 'relative',
  zIndex: ENCOUNTER_HEADER_ROW_Z_INDEX,
  minHeight: 0,
};

const encounterImageSlotStyle: CSSProperties = {
  gridRow: '2',
  gridColumn: '1',
  position: 'relative',
  zIndex: 1,
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

function experienceRequiredForNextLevel(level: number): number {
  return 7 * 2 ** (Math.max(1, level) - 1);
}

function progressionToLifetimeExperience(level: number, experience: number): number {
  let total = Math.max(0, experience);
  for (let currentLevel = 1; currentLevel < Math.max(1, level); currentLevel += 1) {
    total += experienceRequiredForNextLevel(currentLevel);
  }
  return total;
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

function currentFocusState(
  loreOpen: boolean,
  inventoryOpen: boolean,
  skillbookOpen: boolean,
  avatarDetailsOpen: boolean,
): 'none' | 'lore' | 'inventory' | 'skillbook' | 'avatar_details' {
  if (loreOpen) return 'lore';
  if (inventoryOpen) return 'inventory';
  if (skillbookOpen) return 'skillbook';
  if (avatarDetailsOpen) return 'avatar_details';
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
  onKickedFromParty,
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
  const [diceButtonAsset, setDiceButtonAsset] = useState(
    () => diceButtonAssetPath(DEFAULT_DICE_ID),
  );
  const dismissHelpToast = useCallback(() => {
    setHelpToastMessage(null);
  }, []);
  const avatarRef = useRef(avatar);
  const roomRef = useRef(room);
  const continueSubmitInFlightRef = useRef(false);
  const encounterTransitionInFlightRef = useRef(false);
  /** Prevents duplicate death handling and stops room poll from re-binding after death. */
  const deathLeaveHandledRef = useRef<string | null>(null);
  const userLeavingRef = useRef(false);
  const [holdResultRollReset, setHoldResultRollReset] = useState(false);
  const [localXpGainAmount, setLocalXpGainAmount] = useState(0);
  const [partyXpPulseByPlayer, setPartyXpPulseByPlayer] = useState<Record<string, number>>({});
  const resultBlockRef = useRef<ResultBlockHandle>(null);
  const seenXpEventKeysRef = useRef<Set<string>>(new Set());
  const previousAvatarProgressRef = useRef({
    level: initialAvatar.level,
    experience: initialAvatar.experience,
  });
  avatarRef.current = avatar;
  roomRef.current = room;

  const handleLocalAvatarDeath = useCallback((deadAvatar: PersistedAvatar) => {
    if (deathLeaveHandledRef.current === deadAvatar.id) {
      return;
    }
    deathLeaveHandledRef.current = deadAvatar.id;
    onAvatarDeath(deadAvatar);
  }, [onAvatarDeath]);

  const applySnapshotOnly = useCallback((nextRoom: EncounterRoomSnapshotDto) => {
    applyRoomSnapshot(
      nextRoom,
      setRoom,
      setEncounter,
      setAvatar,
      avatarRef.current,
      roomRef.current,
    );
  }, []);

  const roomAdvanceHooks = useMemo(() => ({
    applySnapshotOnly,
    playDismissAnimations: async () => {
      setHoldResultRollReset(true);
      try {
        await resultBlockRef.current?.playDismissAnimations().catch(() => undefined);
      } finally {
        setHoldResultRollReset(false);
      }
    },
    setTransitionInFlight: (inFlight: boolean) => {
      encounterTransitionInFlightRef.current = inFlight;
    },
    onAdvanceComplete: () => {
      setResultRollVisible(false);
    },
  }), [applySnapshotOnly]);

  const localParticipant = room?.participants.find((participant) => participant.isLocal);
  const serverResolution = localParticipant?.preparedResult ?? localParticipant?.resolutionSummary;

  useEffect(() => {
    const previous = previousAvatarProgressRef.current;
    const previousLifetimeExperience = progressionToLifetimeExperience(
      previous.level,
      previous.experience,
    );
    const currentLifetimeExperience = progressionToLifetimeExperience(
      avatar.level,
      avatar.experience,
    );
    const gainedExperience = currentLifetimeExperience - previousLifetimeExperience;
    if (gainedExperience > 0) {
      setLocalXpGainAmount(gainedExperience);
      window.setTimeout(() => setLocalXpGainAmount(0), 900);
    }
    previousAvatarProgressRef.current = {
      level: avatar.level,
      experience: avatar.experience,
    };
  }, [avatar.level, avatar.experience]);

  useEffect(() => {
    if (!room) {
      return;
    }
    const activeParticipantCount = room.participants.filter(
      (participant) => participant.choiceState !== 'disengaged',
    ).length;

    for (const participant of room.participants) {
      const summaryExperience = participant.resolutionSummary?.gainedExperience ?? 0;
      const preparedExperience = participant.preparedResult?.gainedExperience ?? 0;
      const gainedExperience = summaryExperience > 0
        ? summaryExperience
        : (
            activeParticipantCount <= 1
              ? preparedExperience
              : 0
          );
      if (gainedExperience <= 0) {
        continue;
      }

      const eventKey = `${room.activeEncounter.snapshotId}:${participant.playerId}:${gainedExperience}`;
      if (seenXpEventKeysRef.current.has(eventKey)) {
        continue;
      }
      seenXpEventKeysRef.current.add(eventKey);

      if (!participant.isLocal) {
        setPartyXpPulseByPlayer((current) => ({
          ...current,
          [participant.playerId]: Date.now(),
        }));
      }
    }
  }, [room]);

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
    let cancelled = false;

    void fetchPlayer(null).then((player) => {
      if (cancelled) {
        return;
      }

      const diceId = player.selectedDiceId;

      setDiceButtonAsset(
        isDiceId(diceId)
          ? diceButtonAssetPath(diceId)
          : diceButtonAssetPath(DEFAULT_DICE_ID),
      );
    }).catch(() => {
      // Keep the default die skin when player data is unavailable.
    });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const witnessPollActive = witnessSystemEventDisplay(room).isWitness;

  useEffect(() => {
    let cancelled = false;
    const pollMs = witnessPollActive ? 750 : ROOM_POLL_MS;

    async function ensureRoom(): Promise<void> {
      try {
        const room = await ensureSoloLeaderRoom(avatarRef.current.id);
        if (cancelled) {
          return;
        }
        applyRoomSnapshot(
          room,
          setRoom,
          setEncounter,
          setAvatar,
          avatarRef.current,
          roomRef.current,
        );
      } catch (error) {
        console.error('Failed to initialize encounter room', error);
      }
    }

    if (!initialRoom) {
      void ensureRoom();
    }

    const poll = window.setInterval(() => {
      void fetchActiveRoomState(avatarRef.current.id).then(async ({ room: nextRoom, partyEjection }) => {
        if (cancelled) {
          return;
        }

        if (
          partyEjection?.reason === 'kicked'
          && !userLeavingRef.current
          && onKickedFromParty
        ) {
          onKickedFromParty();
          return;
        }

        if (
          !nextRoom
          || continueSubmitInFlightRef.current
          || deathLeaveHandledRef.current === avatarRef.current.id
        ) {
          return;
        }

        const baseline = roomRef.current;
        if (!baseline) {
          applySnapshotOnly(nextRoom);
        } else if (encounterTransitionInFlightRef.current) {
          if (nextRoom.activeEncounter.snapshotId === baseline.activeEncounter.snapshotId) {
            applySnapshotOnly(nextRoom);
          }
        } else if (encounterSnapshotAdvanced(baseline, nextRoom)) {
          await runEncounterAdvanceTransition(baseline, nextRoom, roomAdvanceHooks);
        } else {
          applySnapshotOnly(nextRoom);
        }

        const skipAutoContinueForWitness = witnessSystemEventDisplay(nextRoom).isWitness;
        if (localNeedsContinueAck(nextRoom) && !skipAutoContinueForWitness) {
          await acknowledgeRoomContinue(nextRoom);
          return;
        }

        const local = nextRoom.participants.find((participant) => participant.isLocal);
        const deathSummary = local?.preparedResult ?? local?.resolutionSummary;
        if (deathSummary?.avatarDied && local) {
          handleLocalAvatarDeath(local.avatar);
        }
      }).catch(() => undefined);
    }, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [
    applySnapshotOnly,
    handleLocalAvatarDeath,
    initialRoom,
    onKickedFromParty,
    roomAdvanceHooks,
    witnessPollActive,
  ]);

  useEffect(() => {
    if (!room) {
      return;
    }
    const focusState = currentFocusState(loreOpen, inventoryOpen, skillbookOpen, homeVisible);
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
  }, [homeVisible, loreOpen, inventoryOpen, skillbookOpen, room?.roomId, localParticipant?.focusState]);

  async function syncEncounterRoom(): Promise<EncounterRoomSnapshotDto | null> {
    const room = await ensureSoloLeaderRoom(avatarRef.current.id);
    applyRoomSnapshot(
      room,
      setRoom,
      setEncounter,
      setAvatar,
      avatarRef.current,
      roomRef.current,
    );
    return room;
  }

  function appendActionLog(entries: string[]): void {
    setActionLog((currentLog) => [...currentLog, ...entries].slice(-24));
  }

  /** Submit continue (ready). Dismiss runs only when the server advances the encounter snapshot. */
  async function acknowledgeRoomContinue(
    currentRoom: EncounterRoomSnapshotDto,
  ): Promise<EncounterRoomSnapshotDto> {
    setLoreOpen(false);
    setInventoryOpen(false);
    setSkillbookOpen(false);
    setHomeVisible(false);

    continueSubmitInFlightRef.current = true;

    try {
      let workingRoom = currentRoom;
      const local = workingRoom.participants.find((participant) => participant.isLocal);
      if (local?.focusState !== 'none') {
        workingRoom = await submitRoomFocus(avatarRef.current.id, 'none');
        applySnapshotOnly(workingRoom);
      }

      const roomAfterContinue = await submitRoomContinue(avatarRef.current.id);
      await runEncounterAdvanceTransition(workingRoom, roomAfterContinue, roomAdvanceHooks);
      return roomAfterContinue;
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
        const nextRoom = await acknowledgeRoomContinue(currentRoom);
        appendActionLog([
          nextRoom.roomState === 'active_encounter'
            ? 'Continue: Encounter advanced.'
            : 'Continue: Ready — waiting for the party.',
        ]);
        onAchievementCheck?.();
        return;
      }

      if (currentRoom.roomState === 'system_event' && witnessSystemEventDisplay(currentRoom).isWitness) {
        appendActionLog(['Only the actor can resolve this moment.']);
        return;
      }

      let nextRoom = await submitRoomChoice(
        avatarRef.current.id,
        action,
        selectedSolutionId ?? undefined,
      );
      applySnapshotOnly(nextRoom);

      const localAfterChoice = nextRoom.participants.find((participant) => participant.isLocal);
      if (
        nextRoom.roomState === 'waiting_continue'
        && localAfterChoice?.continuePressed !== true
      ) {
        nextRoom = await acknowledgeRoomContinue(nextRoom);
      }

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
        nextRoom = await acknowledgeRoomContinue(nextRoom);
        appendActionLog([
          nextRoom.roomState === 'active_encounter'
            ? 'Continue: Encounter advanced.'
            : 'Continue: Ready — waiting for the party.',
        ]);
      }

      if (summary?.avatarDied) {
        handleLocalAvatarDeath(local?.avatar ?? avatar);
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

  async function handleKickParticipant(targetPlayerId: string): Promise<void> {
    try {
      const nextRoom = await kickRoomParticipant(avatarRef.current.id, targetPlayerId);
      applyRoomSnapshot(
        nextRoom,
        setRoom,
        setEncounter,
        setAvatar,
        avatarRef.current,
        roomRef.current,
      );
    } catch (error) {
      console.error('Failed to kick party member', error);
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
    userLeavingRef.current = true;
    setVisible(false);
    await waitForFade();
    try {
      await leaveAllEncounterRooms();
    } catch (error) {
      console.error('Failed to leave all rooms on home', error);
    }
    onHome();
  }

  const bottomDelay: CSSProperties = {
    ...fadeStyle(visible),
    transitionDelay: visible ? '160ms' : '0ms',
  };

  const witnessDisplay = witnessSystemEventDisplay(room);
  const systemEvent = room?.systemEvent;
  const systemEventActor = witnessDisplay.actor;
  const witnessActorOutcome = witnessDisplay.outcome;
  const isWitnessingLabel = witnessDisplay.showWaitingLabel;
  const showWitnessResult = witnessDisplay.showActorResult;
  const witnessEncounterId = systemEvent?.encounterId ?? encounter.encounterId;
  const displayResolution = witnessDisplay.isWitness
    ? witnessActorOutcome
    : serverResolution;
  const displayAvatarLevel = witnessActorOutcome
    ? (systemEventActor?.avatar.level ?? avatar.level)
    : avatar.level;

  const waitingForResolution = room?.roomState === 'advancing';
  const showServerResult = witnessDisplay.isWitness
    ? showWitnessResult
    : displayResolution !== undefined && (
      room?.roomState === 'waiting_continue' ||
      room?.roomState === 'advancing' ||
      localParticipant?.preparedResult !== undefined
    );
  const outcomeRollForDisplay = witnessDisplay.isWitness
    ? witnessActorOutcome?.selectedRoll
    : undefined;
  const outcomeResolutionAction = witnessDisplay.isWitness
    ? systemEventActor?.selectedAction
    : undefined;
  const deferRewardDismiss = shouldDeferRewardDismiss(room, resultRollVisible);
  const localHasContinuePressed = room ? localContinuePressed(room) : false;
  const continueGlow = continueGlowClassForRoom(room);
  const continueWaitingAfterPress = localWaitingForRoomAdvance(room);
  const roomLoreGemEarned = encounter.loreGemOffer?.eligible === true
    && room?.loreGemActivated === true
    && room.loreGemActivatedSnapshotId === encounter.snapshotId
    && localParticipant?.choiceState !== 'disengaged';
  const loreGemCollected = localParticipant?.loreGemCollected === true || roomLoreGemEarned;
  const showLoreGemReward = roomLoreGemEarned
    || serverResolution?.loreGemGranted === true
    || localParticipant?.preparedResult?.loreGemGranted === true;
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
            <div style={headerSlotStyle}>
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
              <EncounterHeaderSeam />
            </div>
            <div
              style={{
                ...encounterImageSlotStyle,
                ...encounterRevealStyle(visible, ENCOUNTER_ACTIONS_REVEAL_DELAY_MS),
              }}
            >
              <EncounterImageBlock
                avatarId={avatar.id}
                avatarLevel={displayAvatarLevel}
                diceButtonAsset={diceButtonAsset}
                continueGlowClass={continueGlow}
                continuePending={continuePending || deathPending || waitingForResolution}
                continueWaitingAfterPress={continueWaitingAfterPress}
                deferRewardDismiss={deferRewardDismiss}
                encounter={encounter}
                holdResultRollReset={holdResultRollReset}
                loreGemCollected={loreGemCollected}
                onRoomSnapshot={applyLoreGemRoomSnapshot}
                showLoreGemReward={showLoreGemReward}
                imageSrc={imagePath(encounterImageName)}
                inventory={avatar.inventory}
                inventoryOpen={inventoryOpen}
                localContinuePressed={localHasContinuePressed}
                loreOpen={loreOpen}
                onContinue={handleContinueEncounter}
                onResultsVisibleChange={setResultRollVisible}
                resultBlockRef={resultBlockRef}
                roomState={room?.roomState ?? 'active_encounter'}
                serverResolution={showServerResult ? displayResolution : undefined}
                witnessSuppressLocalResolution={witnessDisplay.isWitness}
                isWitnessingLabel={isWitnessingLabel}
                showWitnessResult={showWitnessResult}
                witnessEncounterId={witnessEncounterId}
                witnessOutcome={witnessActorOutcome ?? null}
                witnessAvatarLevel={systemEventActor?.avatar.level}
                systemEventActorName={
                  systemEventActor?.avatar
                    ? formatAvatarDisplayName(systemEventActor.avatar)
                    : undefined
                }
                outcomeRoll={outcomeRollForDisplay}
                outcomeResolutionAction={outcomeResolutionAction}
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
              onKickParticipant={(targetPlayerId) => {
                void handleKickParticipant(targetPlayerId);
              }}
              onSlotStateChange={(slotIndex, slotState) => {
                void handleSlotStateChange(slotIndex, slotState);
              }}
              room={room}
              roomState={room?.roomState}
              localXpGainAmount={localXpGainAmount}
              partyXpPulseByPlayer={partyXpPulseByPlayer}
            />
          </div>
        }
      />
    </div>
  );
}

export default GameEnvironment;
