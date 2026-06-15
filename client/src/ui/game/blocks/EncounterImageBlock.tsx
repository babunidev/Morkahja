import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterRoomSnapshotDto,
  EncounterSnapshot,
  ParticipantResolutionSummaryDto,
  RoomStateDto,
} from '../../../api/http.js';
import { activateRoomLoreGem, submitRoomChoice, submitRoomSelection } from '../../../api/http.js';
import { isApiErrorCode } from '../../../api/httpErrorMessage.js';
import InventoryBlock from './InventoryBlock.js';
import LoreBlock from './LoreBlock.js';
import SkillbookBlock from './SkillbookBlock.js';
import {
  ENCOUNTER_FADE_DURATION_MS,
  encounterFadeTransition,
  fadeStyle,
} from '../../transitions/fade.js';
import { useOpacityPresence } from '../../transitions/opacityPresence.js';
import ResultBlock, { type ResultBlockHandle } from './ResultBlock.js';
import SolutionBlock from './SolutionBlock.js';
import { predictUsedSolutionIds } from '../encounterInventoryPreview.js';

const ENCOUNTER_IMAGE_RELEASE_BUFFER_MS = 100;
const SYSTEM_EVENT_CHOICE_RETRY_MS = 400;
const SYSTEM_EVENT_CHOICE_MAX_RETRIES = 12;

const blockStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
  alignItems: 'stretch',
  justifyItems: 'stretch',
  position: 'relative',
  overflow: 'visible',
};

const imageStyle: CSSProperties = {
  gridArea: '1 / 1',
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  zIndex: 1,
  transition: encounterFadeTransition,
  userSelect: 'none',
};

const previousImageStyle: CSSProperties = {
  ...imageStyle,
  zIndex: 1,
};

const currentImageStyle: CSSProperties = {
  ...imageStyle,
  zIndex: 3,
};

const missingImageStyle: CSSProperties = {
  gridArea: '1 / 1',
  zIndex: 1,
  display: 'grid',
  placeItems: 'center',
  width: '100%',
  height: '100%',
  padding: 24,
  boxSizing: 'border-box',
  background: 'rgba(6, 7, 10, 0.72)',
  color: '#ffcc66',
  fontFamily: 'Georgia, serif',
  fontSize: 'clamp(1rem, 3.8vw, 1.45rem)',
  lineHeight: 1.35,
  textAlign: 'center',
  textShadow: '0 2px 8px rgba(0, 0, 0, 0.9)',
  transition: encounterFadeTransition,
};

function imageFileName(imageSrc: string): string {
  return decodeURIComponent(imageSrc.split('/').pop() ?? imageSrc);
}

const witnessFloatingLabelStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 22,
  maxWidth: 'min(88%, 320px)',
  padding: '10px 18px',
  boxSizing: 'border-box',
  borderRadius: 8,
  background: 'rgba(6, 7, 10, 0.82)',
  fontSize: 'clamp(0.95rem, 2.8vw, 1.2rem)',
  lineHeight: 1.2,
  textAlign: 'center',
  textTransform: 'none',
  letterSpacing: '0.04em',
  pointerEvents: 'none',
};

export function EncounterImageBlock({
  avatarId,
  avatarLevel,
  continuePending,
  diceButtonAsset,
  continueGlowClass,
  continueWaitingAfterPress = false,
  deferRewardDismiss = false,
  encounter,
  loreGemCollected = false,
  onRoomSnapshot,
  showLoreGemReward = false,
  imageSrc,
  inventory,
  inventoryOpen,
  localContinuePressed = false,
  loreOpen,
  onContinue,
  onResultsVisibleChange,
  resultBlockRef,
  roomState = 'active_encounter',
  serverResolution,
  serverCommittedAction,
  skillbookOpen,
  title,
  witnessSuppressLocalResolution = false,
  isSystemEventActor = false,
  isWitnessingLabel = false,
  showWitnessResult = false,
  witnessCanContinue = false,
  actorShowContinue = true,
  systemEventActorName,
  outcomeRoll,
  outcomeResolutionAction,
  witnessOutcome,
  witnessAvatarLevel,
  witnessEncounterId,
  holdResultRollReset = false,
}: {
  avatarId: string;
  avatarLevel: number;
  continuePending: boolean;
  diceButtonAsset: string;
  continueGlowClass?: string;
  continueWaitingAfterPress?: boolean;
  deferRewardDismiss?: boolean;
  encounter: EncounterSnapshot;
  loreGemCollected?: boolean;
  onRoomSnapshot?: (room: EncounterRoomSnapshotDto) => void;
  showLoreGemReward?: boolean;
  imageSrc: string;
  inventory: AvatarInventory | undefined;
  inventoryOpen: boolean;
  localContinuePressed?: boolean;
  loreOpen: boolean;
  onContinue: (
    action: EncounterAction,
    roll: number | null,
    solutionId: number | null,
  ) => Promise<void>;
  onResultsVisibleChange?: (visible: boolean) => void;
  resultBlockRef?: Ref<ResultBlockHandle>;
  roomState?: RoomStateDto;
  serverResolution?: ParticipantResolutionSummaryDto;
  serverCommittedAction?: EncounterAction;
  skillbookOpen: boolean;
  title: string;
  witnessSuppressLocalResolution?: boolean;
  isSystemEventActor?: boolean;
  isWitnessingLabel?: boolean;
  showWitnessResult?: boolean;
  witnessCanContinue?: boolean;
  actorShowContinue?: boolean;
  systemEventActorName?: string;
  outcomeRoll?: number;
  outcomeResolutionAction?: EncounterAction;
  witnessOutcome?: ParticipantResolutionSummaryDto | null;
  witnessAvatarLevel?: number;
  witnessEncounterId?: number;
  /** When true, keep outcome roll visible until reward dismiss finishes. */
  holdResultRollReset?: boolean;
}) {
  const [revealedRoll, setRevealedRoll] = useState<number | null>(null);
  const [selectedAction, setSelectedAction] = useState<EncounterAction>('dice');
  const [selectedSolutionId, setSelectedSolutionId] = useState<number | null>(null);
  const [missingImageSrcs, setMissingImageSrcs] = useState<string[]>([]);
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [currentImageFading, setCurrentImageFading] = useState(false);
  const [transitionImageSrc, setTransitionImageSrc] = useState<string | null>(null);
  const [underlayHoldSrc, setUnderlayHoldSrc] = useState<string | null>(null);
  const underlayImageSrc = transitionImageSrc ?? underlayHoldSrc ?? undefined;
  const underlayVisible = underlayImageSrc !== undefined;
  const lastSyncedSelectionKeyRef = useRef<string | null>(null);
  const selectionSyncInFlightRef = useRef(false);
  const choiceCommitInFlightRef = useRef(false);
  const pendingSystemEventChoiceRef = useRef<{
    action: EncounterAction;
    solutionId?: number;
  } | null>(null);
  const showWitnessLabel = isWitnessingLabel && !showWitnessResult;
  const witnessLabelPresence = useOpacityPresence(showWitnessLabel);
  const witnessResultLatchRef = useRef(false);
  const witnessResultSnapRef = useRef<{
    outcome: ParticipantResolutionSummaryDto;
    encounterId: number;
    avatarLevel: number;
    resolutionAction: EncounterAction;
  } | null>(null);

  if (showWitnessResult && witnessOutcome) {
    witnessResultLatchRef.current = true;
  }

  useEffect(() => {
    if (!witnessSuppressLocalResolution) {
      witnessResultLatchRef.current = false;
      witnessResultSnapRef.current = null;
    }
  }, [witnessSuppressLocalResolution]);

  if (witnessResultLatchRef.current && witnessOutcome) {
    witnessResultSnapRef.current = {
      outcome: witnessOutcome,
      encounterId: witnessEncounterId ?? encounter.encounterId,
      avatarLevel: witnessAvatarLevel ?? avatarLevel,
      resolutionAction: outcomeResolutionAction ?? 'dice',
    };
  }

  const witnessResultActive = witnessResultLatchRef.current
    && witnessResultSnapRef.current != null;
  const witnessResultPresence = useOpacityPresence(witnessResultActive);

  function markMissingImage(src: string): void {
    setMissingImageSrcs((currentMissingImageSrcs) => (
      currentMissingImageSrcs.includes(src)
        ? currentMissingImageSrcs
        : [...currentMissingImageSrcs, src]
    ));
  }

  useEffect(() => {
    if (imageSrc === currentImageSrc) {
      return undefined;
    }

    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      if (!cancelled) {
        setTransitionImageSrc(imageSrc);
        setCurrentImageFading(true);
      }
    }, 0);
    const finishTimer = window.setTimeout(() => {
      if (!cancelled) {
        setCurrentImageSrc(imageSrc);
        setCurrentImageFading(false);
        setUnderlayHoldSrc(imageSrc);
        setTransitionImageSrc(null);
      }
    }, ENCOUNTER_FADE_DURATION_MS);
    const releaseTimer = window.setTimeout(() => {
      if (!cancelled) {
        setUnderlayHoldSrc(null);
      }
    }, ENCOUNTER_FADE_DURATION_MS + ENCOUNTER_IMAGE_RELEASE_BUFFER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(finishTimer);
      window.clearTimeout(releaseTimer);
    };
  }, [currentImageSrc, imageSrc]);

  useEffect(() => {
    if (holdResultRollReset) {
      return;
    }
    setRevealedRoll(null);
    setSelectedAction('dice');
    setSelectedSolutionId(null);
    lastSyncedSelectionKeyRef.current = null;
    pendingSystemEventChoiceRef.current = null;
  }, [encounter.snapshotId, holdResultRollReset]);

  useEffect(() => {
    if (witnessSuppressLocalResolution) {
      return;
    }

    if (serverResolution?.selectedRoll !== undefined) {
      setRevealedRoll(serverResolution.selectedRoll);
      if (serverCommittedAction) {
        setSelectedAction(serverCommittedAction);
      }
    }
  }, [
    encounter.snapshotId,
    serverCommittedAction,
    serverResolution?.selectedRoll,
    serverResolution?.rewards,
    witnessSuppressLocalResolution,
  ]);

  useEffect(() => {
    if (showWitnessResult) {
      onResultsVisibleChange?.(true);
      return;
    }

    if (!witnessSuppressLocalResolution) {
      onResultsVisibleChange?.(revealedRoll !== null);
    }
  }, [onResultsVisibleChange, revealedRoll, showWitnessResult, witnessSuppressLocalResolution]);

  async function handleContinue(): Promise<void> {
    if (roomState === 'waiting_continue') {
      await onContinue(selectedAction, revealedRoll, selectedSolutionId);
      return;
    }

    await onContinue(selectedAction, revealedRoll, selectedSolutionId);
    if (roomState === 'active_encounter' || roomState === 'system_event') {
      setRevealedRoll(revealedRoll);
    } else {
      setRevealedRoll(null);
      setSelectedAction('dice');
      setSelectedSolutionId(null);
    }
  }

  function selectionSyncKey(
    action: EncounterAction,
    solutionId: number | undefined,
  ): string {
    return `${action}:${solutionId ?? ''}`;
  }

  function syncSelectionToRoom(
    action: EncounterAction,
    solutionId: number | undefined,
  ): void {
    if (witnessSuppressLocalResolution || isWitnessingLabel) {
      return;
    }

    if (
      roomState !== 'active_encounter'
      && roomState !== 'system_event'
    ) {
      return;
    }

    const key = selectionSyncKey(action, solutionId);
    if (lastSyncedSelectionKeyRef.current === key || selectionSyncInFlightRef.current) {
      return;
    }

    selectionSyncInFlightRef.current = true;
    void submitRoomSelection(avatarId, action, solutionId)
      .then((room) => {
        lastSyncedSelectionKeyRef.current = key;
        onRoomSnapshot?.(room);
      })
      .catch(() => undefined)
      .finally(() => {
        selectionSyncInFlightRef.current = false;
        flushPendingSystemEventChoice();
      });
  }

  async function submitSystemEventChoiceWithRetry(
    action: EncounterAction,
    solutionId: number | undefined,
    attempt = 0,
  ): Promise<void> {
    try {
      const nextRoom = await submitRoomChoice(avatarId, action, solutionId);
      onRoomSnapshot?.(nextRoom);
    } catch (error) {
      if (
        attempt < SYSTEM_EVENT_CHOICE_MAX_RETRIES
        && isApiErrorCode(error, 'ACTION_NOT_READY')
      ) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, SYSTEM_EVENT_CHOICE_RETRY_MS);
        });
        await submitSystemEventChoiceWithRetry(action, solutionId, attempt + 1);
        return;
      }

      if (isApiErrorCode(error, 'OUTCOME_ALREADY_PREPARED')) {
        return;
      }

      console.error('System event choice commit failed', error);
    }
  }

  function flushPendingSystemEventChoice(): void {
    const pending = pendingSystemEventChoiceRef.current;
    if (!pending || choiceCommitInFlightRef.current || selectionSyncInFlightRef.current) {
      return;
    }

    pendingSystemEventChoiceRef.current = null;
    choiceCommitInFlightRef.current = true;

    void submitSystemEventChoiceWithRetry(pending.action, pending.solutionId)
      .finally(() => {
        choiceCommitInFlightRef.current = false;
        if (pendingSystemEventChoiceRef.current) {
          flushPendingSystemEventChoice();
        }
      });
  }

  function commitSystemEventChoice(
    action: EncounterAction,
    solutionId: number | undefined,
  ): void {
    pendingSystemEventChoiceRef.current = { action, solutionId };
    flushPendingSystemEventChoice();
  }

  function commitEncounterChoice(
    action: EncounterAction,
    solutionId: number | undefined,
  ): void {
    if (choiceCommitInFlightRef.current) {
      return;
    }

    choiceCommitInFlightRef.current = true;
    void submitRoomChoice(avatarId, action, solutionId)
      .then((nextRoom) => {
        onRoomSnapshot?.(nextRoom);
      })
      .catch(() => undefined)
      .finally(() => {
        choiceCommitInFlightRef.current = false;
      });
  }

  function handleActionReveal(
    action: EncounterAction,
    roll: number | null,
    solutionId?: number,
  ): void {
    setSelectedAction(action);
    setRevealedRoll(roll);
    setSelectedSolutionId(solutionId ?? null);

    if (roll !== null && roomState === 'system_event' && isSystemEventActor) {
      commitSystemEventChoice(action, solutionId);
      return;
    }

    if (roll !== null && roomState === 'active_encounter') {
      commitEncounterChoice(action, solutionId);
      return;
    }

    const isSelectionMoment = roll === null && (
      solutionId !== undefined || action === 'dice'
    );
    if (isSelectionMoment) {
      syncSelectionToRoom(action, solutionId);
    }
  }

  const outcomeAction = outcomeRoll !== undefined
    ? (outcomeResolutionAction ?? selectedAction)
    : (revealedRoll !== null ? selectedAction : null);
  const usedSolutionIds = serverResolution?.usedInventorySolutions?.length
    ? serverResolution.usedInventorySolutions
    : outcomeAction && outcomeAction !== 'dice'
      ? predictUsedSolutionIds({ encounter, inventory, action: outcomeAction })
      : [];

  return (
    <section aria-label="Encounter Image" style={blockStyle}>
      {underlayImageSrc ? (
        missingImageSrcs.includes(underlayImageSrc) ? (
          <div
            role="img"
            aria-label={`Missing encounter image ${imageFileName(underlayImageSrc)}`}
            style={{
              ...missingImageStyle,
              opacity: underlayVisible ? 1 : 0,
              zIndex: 1,
            }}
          >
            Missing encounter image:
            <br />
            {imageFileName(underlayImageSrc)}
          </div>
        ) : (
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => {
              markMissingImage(underlayImageSrc);
            }}
            src={underlayImageSrc}
            style={{
              ...previousImageStyle,
              opacity: underlayVisible ? 1 : 0,
            }}
          />
        )
      ) : null}
      {missingImageSrcs.includes(currentImageSrc) ? (
        <div
          role="img"
          aria-label={`Missing encounter image ${imageFileName(currentImageSrc)}`}
          style={{
            ...missingImageStyle,
            opacity: currentImageFading ? 0 : 1,
            zIndex: 3,
          }}
        >
          Missing encounter image:
          <br />
          {imageFileName(currentImageSrc)}
        </div>
      ) : (
        <img
          alt={title}
          draggable={false}
          onError={() => {
            markMissingImage(currentImageSrc);
          }}
          src={currentImageSrc}
          style={{
            ...currentImageStyle,
            opacity: currentImageFading ? 0 : 1,
            pointerEvents:
              inventoryOpen || skillbookOpen || loreOpen ? 'none' : 'auto',
          }}
        />
      )}
      {witnessLabelPresence.mounted ? (
        <div
          aria-live="polite"
          className="morkahja-result-outcome"
          style={{
            ...witnessFloatingLabelStyle,
            ...fadeStyle(witnessLabelPresence.visible),
          }}
        >
          {systemEventActorName
            ? `Witnessing ${systemEventActorName}'s fate…`
            : 'Witnessing a shared moment…'}
        </div>
      ) : null}
      {witnessResultPresence.mounted && witnessResultSnapRef.current ? (
        <ResultBlock
          readOnlyWitness
          witnessShowContinue={witnessCanContinue}
          continueGlowClass={continueGlowClass}
          continueWaitingAfterPress={continueWaitingAfterPress}
          deferRewardDismiss={deferRewardDismiss}
          disabled={continuePending}
          diceOutcomeIcon={diceButtonAsset}
          encounterDifficulty={encounter.encounterDifficulty ?? 1}
          avatarLevel={witnessResultSnapRef.current.avatarLevel}
          encounterId={witnessResultSnapRef.current.encounterId}
          hidden={loreOpen || inventoryOpen || skillbookOpen}
          localContinuePressed={localContinuePressed}
          onContinue={() => {
            void handleContinue();
          }}
          presenceVisible={witnessResultPresence.visible}
          prosperityRewardId={null}
          resolutionAction={witnessResultSnapRef.current.resolutionAction}
          rewardIds={witnessResultSnapRef.current.outcome.rewards}
          roll={witnessResultSnapRef.current.outcome.selectedRoll ?? null}
          usedSolutionIds={witnessResultSnapRef.current.outcome.usedInventorySolutions ?? []}
          lostSolutionIds={witnessResultSnapRef.current.outcome.lostInventorySolutions ?? []}
        />
      ) : !isWitnessingLabel ? (
        <ResultBlock
          diceOutcomeIcon={diceButtonAsset}
          actorShowContinue={isSystemEventActor ? actorShowContinue : true}
          continueGlowClass={continueGlowClass}
          encounterSnapshotId={encounter.snapshotId}
          continueWaitingAfterPress={continueWaitingAfterPress}
          deferRewardDismiss={deferRewardDismiss}
          disabled={continuePending}
          showLoreGemReward={showLoreGemReward}
          encounterId={encounter.encounterId}
          encounterDifficulty={encounter.encounterDifficulty ?? 1}
          avatarLevel={avatarLevel}
          hidden={loreOpen || inventoryOpen || skillbookOpen}
          inventory={inventory}
          localContinuePressed={localContinuePressed}
          onContinue={() => {
            void handleContinue();
          }}
          prosperityRewardId={encounter.prosperityRewardId}
          ref={resultBlockRef}
          resolutionAction={
            outcomeRoll !== undefined
              ? (outcomeResolutionAction ?? selectedAction)
              : (revealedRoll !== null ? selectedAction : null)
          }
          rewardIds={serverResolution?.rewards ?? encounter.rewardIds}
          roll={outcomeRoll ?? revealedRoll}
          usedSolutionIds={usedSolutionIds}
          lostSolutionIds={serverResolution?.lostInventorySolutions ?? []}
        />
      ) : null}
      <SolutionBlock
        diceButtonAsset={diceButtonAsset}
        encounter={encounter}
        encounterRevealKey={encounter.snapshotId}
        hidden={
          isWitnessingLabel ||
          showWitnessResult ||
          revealedRoll !== null ||
          loreOpen ||
          inventoryOpen ||
          skillbookOpen ||
          roomState === 'waiting_continue' ||
          roomState === 'advancing' ||
          roomState === 'resolving'
        }
        inventory={inventory}
        onActionReveal={handleActionReveal}
      />
      <LoreBlock
        encounterKey={encounter.snapshotId}
        loreGemCollected={loreGemCollected}
        loreGemOffer={encounter.loreGemOffer}
        onLoreGemCollect={async () => {
          const result = await activateRoomLoreGem(avatarId, encounter.snapshotId);
          onRoomSnapshot?.(result.room);
        }}
        text={encounter.encounterText ?? ''}
        visible={loreOpen}
      />
      <SkillbookBlock inventory={inventory} visible={skillbookOpen} />
      <InventoryBlock inventory={inventory} visible={inventoryOpen} />
    </section>
  );
}

export default EncounterImageBlock;
