import { useEffect, useRef, useState, type CSSProperties, type Ref } from 'react';
import type { CollectedInventoryChange } from '../collectedInventory.js';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterRoomSnapshotDto,
  EncounterSnapshot,
  ParticipantResolutionSummaryDto,
  RoomStateDto,
} from '../../../api/http.js';
import {
  activateRoomLoreGem, chooseLevelUpReward, submitRoomChoice, submitRoomSelection, submitRoomSetDice, submitRoomSetPick } from '../../../api/http.js';
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
import DecorativeEdgeFrame from './DecorativeEdgeFrame.js';
import { FRAME_OUTSET_PX } from './encounterFrameGeometry.js';
import EncounterHeader from './EncounterHeader.js';
import { predictUsedSolutionIds } from '../encounterInventoryPreview.js';
import { committedActionFor, committedSolutionSetFor, recordCommittedAction } from '../rewardFlyAnimation.js';
import LevelUpChoiceBar from './LevelUpChoiceBar.js';
import { LEVEL_UP_ENCOUNTER_ID } from '../visibleEncounterRewards.js';
import { isCommitMoment, type ActionRevealPhase } from './actionRevealPhase.js';
import { gameEncounters, gameExpansions } from '../../../data/gameContent.js';
import { plateLabelFor } from '../regionName.js';
import { ENCOUNTER_LOCATIONS } from '../worldMap/encounterLocations.js';
import { expansionFromEncounterMap } from '../../music/encounterExpansion.js';
import WorldMap from '../worldMap/WorldMap.js';
import { fadeTransition } from '../../transitions/fade.js';
import { TITLE_INTRO_FADE_IN_MS, TITLE_INTRO_FADE_OUT_MS, TITLE_INTRO_HOLD_MS } from './titleIntro.js';

const ENCOUNTER_IMAGE_RELEASE_BUFFER_MS = 100;
const SYSTEM_EVENT_CHOICE_RETRY_MS = 400;
const SYSTEM_EVENT_CHOICE_MAX_RETRIES = 12;

const blockStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'visible',
};

/** Square encounter art + frame + all in-frame overlays share one box. */
const artFrameStyle: CSSProperties = {
  position: 'relative',
  height: '100%',
  width: 'auto',
  // Leaves room for the frame lines outside the picture on narrow screens.
  maxWidth: `calc(100% - ${2 * FRAME_OUTSET_PX}px)`,
  aspectRatio: '1 / 1',
  flexShrink: 0,
  overflow: 'visible',
};

const imageClipStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  display: 'grid',
  gridTemplateRows: '1fr',
  gridTemplateColumns: '1fr',
};

const imageStyle: CSSProperties = {
  gridArea: '1 / 1',
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'top center',
  zIndex: 1,
  transition: encounterFadeTransition,
  userSelect: 'none',
};

const titleHoverZoneStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: '58%',
  height: '52%',
  transform: 'translate(-50%, -50%)',
  zIndex: 35,
  pointerEvents: 'auto',
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

function regionLabelFor(encounterId: number): string | null | undefined {
  try {
    return plateLabelFor(encounterId, ENCOUNTER_LOCATIONS, gameEncounters(), gameExpansions());
  } catch {
    return null;
  }
}

function expansionFor(encounterId: number): number | null {
  try {
    return expansionFromEncounterMap(gameEncounters(), encounterId);
  } catch {
    return null;
  }
}

/** The world map covers the picture like Lore and the inventory, under the frame. */
const worldMapLayerStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  // Above the closed Lore, Inventory and Skillbook layers, below the frame.
  zIndex: 21,
  overflow: 'hidden',
  transition: fadeTransition,
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
  imageSrc,
  inventory,
  displayInventory,
  onItemCollected,
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
  onClosePanels,
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
  lockedSetPicks,
  lockedDiceRolls,
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
  imageSrc: string;
  inventory: AvatarInventory | undefined;
  /** Inventory shown in the Inventory and Skillbook panels, including items collected this round. */
  displayInventory?: AvatarInventory;
  onItemCollected?: (change: CollectedInventoryChange) => void;
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
  /** Closes Inventory and Skillbook (their title plate on the frame). */
  onClosePanels?: () => void;
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
  /** The local player's solution set picks the server already locked (D-025). */
  lockedSetPicks?: Array<{ slot: 'A' | 'B' | 'C' | 'D'; solutionId: number; roll: number }>;
  /** Dice faces already revealed in this set, in the order rolled (D-040). */
  lockedDiceRolls?: number[];
}) {
  const [revealedRoll, setRevealedRoll] = useState<number | null>(null);
  /**
   * Level-up choice (D-049): from the pick until the pick has shown its roll,
   * the result waits (the bar plays the roll first).
   */
  const [levelUpRollHeld, setLevelUpRollHeld] = useState(false);
  /** The bar's pick stays a moment over the result fading in, so it never dims. */
  const [levelUpBarLingers, setLevelUpBarLingers] = useState(false);
  const [selectedAction, setSelectedAction] = useState<EncounterAction>('dice');
  const [selectedSolutionId, setSelectedSolutionId] = useState<number | null>(null);
  const [missingImageSrcs, setMissingImageSrcs] = useState<string[]>([]);
  const [currentImageSrc, setCurrentImageSrc] = useState(imageSrc);
  const [currentImageFading, setCurrentImageFading] = useState(false);
  const [encounterTitleHovered, setEncounterTitleHovered] = useState(false);
  const [titleIntro, setTitleIntro] = useState<'idle' | 'in' | 'out'>('idle');
  const [mapOpen, setMapOpen] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
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
  const encounterOverlaysOpen = loreOpen || inventoryOpen || skillbookOpen;
  const panelsOpen = encounterOverlaysOpen || mapOpen;
  const encounterTitleVisible = (encounterTitleHovered || titleIntro === 'in') && !panelsOpen;
  // The level-up names no land of its own, so the plate keeps the last one.
  const lastRegionLabelRef = useRef<string | null>(null);
  const plateLabel = regionLabelFor(encounter.encounterId);
  if (plateLabel !== undefined) {
    lastRegionLabelRef.current = plateLabel;
  }
  const regionLabel = plateLabel === undefined ? lastRegionLabelRef.current : plateLabel;
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
    if (encounterOverlaysOpen) {
      setEncounterTitleHovered(false);
      // Lore, the inventory or the skillbook take the picture's place instead.
      setMapOpen(false);
    }
  }, [encounterOverlaysOpen]);

  useEffect(() => {
    if (!mapOpen) {
      return undefined;
    }
    setMapMounted(true);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMapOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapOpen]);

  // Each new encounter shows its name for a moment, then leaves the picture
  // (Babuni, 2026-11-17): fade in, hold, fade out.
  useEffect(() => {
    setTitleIntro('idle');
    const frame = window.requestAnimationFrame(() => setTitleIntro('in'));
    const outTimer = window.setTimeout(() => setTitleIntro('out'), TITLE_INTRO_FADE_IN_MS + TITLE_INTRO_HOLD_MS);
    const doneTimer = window.setTimeout(
      () => setTitleIntro('idle'),
      TITLE_INTRO_FADE_IN_MS + TITLE_INTRO_HOLD_MS + TITLE_INTRO_FADE_OUT_MS,
    );
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(outTimer);
      window.clearTimeout(doneTimer);
    };
  }, [encounter.snapshotId]);

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
    setLevelUpRollHeld(false);
  }, [encounter.snapshotId]);

  useEffect(() => {
    if (witnessSuppressLocalResolution || levelUpRollHeld) {
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
    levelUpRollHeld,
  ]);

  const levelUpChoiceIds = encounter.levelUpChoiceIds ?? [];
  const levelUpChoiceMode = isSystemEventActor
    && encounter.encounterId === LEVEL_UP_ENCOUNTER_ID
    && levelUpChoiceIds.length > 0
    && (serverResolution === undefined || levelUpRollHeld || levelUpBarLingers);
  // The pick made before the roll stays as the first reward (ResultBlock).
  const levelUpPickedFirst = committedActionFor(encounter.snapshotId) === 'level-up-choice'
    ? serverResolution?.levelUpChosenId
    : undefined;

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
      const nextRoom = await submitRoomChoice(
        avatarId,
        action,
        solutionId,
        committedSolutionSetFor(encounter.snapshotId),
      );
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
    void submitRoomChoice(avatarId, action, solutionId, committedSolutionSetFor(encounter.snapshotId))
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
    phase?: ActionRevealPhase,
  ): void {
    setSelectedAction(action);
    setRevealedRoll(roll);
    setSelectedSolutionId(solutionId ?? null);

    // Commit on the reveal moment, not on "roll is known": the server only
    // sends rolls after the commit, and the serverResolution effect above then
    // reveals the authoritative roll.
    const committing = isCommitMoment(phase, roll);

    if (committing && roomState === 'system_event' && isSystemEventActor) {
      commitSystemEventChoice(action, solutionId);
      return;
    }

    if (committing && roomState === 'active_encounter') {
      commitEncounterChoice(action, solutionId);
      return;
    }

    const isSelectionMoment = !committing && (
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
      ? predictUsedSolutionIds({
        encounter,
        inventory,
        action: outcomeAction,
        picks: committedSolutionSetFor(encounter.snapshotId)?.picks,
      })
      : [];

  return (
    <section aria-label="Encounter Image" style={blockStyle}>
      <div data-morkahja-encounter-art="" style={artFrameStyle}>
        <div style={imageClipStyle}>
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
        </div>
        {mapMounted ? (
          <div
            aria-hidden={!mapOpen}
            style={{ ...worldMapLayerStyle, opacity: mapOpen ? 1 : 0, pointerEvents: mapOpen ? 'auto' : 'none' }}
          >
            <WorldMap encounterId={encounter.encounterId} expansion={expansionFor(encounter.encounterId)} open={mapOpen} />
          </div>
        ) : null}
        <DecorativeEdgeFrame
          onRegionClick={() => setMapOpen((open) => !open)}
          // Inventory and Skillbook show their own title on this plate.
          regionLabel={inventoryOpen || skillbookOpen ? null : regionLabel}
          regionPressed={mapOpen}
          showTimer
        />
        {!panelsOpen ? (
          <div
            aria-hidden="true"
            onMouseEnter={() => {
              setEncounterTitleHovered(true);
            }}
            onMouseLeave={() => {
              setEncounterTitleHovered(false);
            }}
            style={titleHoverZoneStyle}
          />
        ) : null}
        <EncounterHeader
          hidden={!encounterTitleVisible}
          title={title}
          transition={titleIntro === 'in'
            ? `opacity ${TITLE_INTRO_FADE_IN_MS}ms ease-in-out`
            : titleIntro === 'out'
              ? `opacity ${TITLE_INTRO_FADE_OUT_MS}ms ease-in-out`
              : undefined}
        />
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
          encounterDifficulty={encounter.encounterDifficulty ?? 1}
          avatarLevel={witnessResultSnapRef.current.avatarLevel}
          encounterId={witnessResultSnapRef.current.encounterId}
          hidden={loreOpen || inventoryOpen || skillbookOpen || mapOpen}
          localContinuePressed={localContinuePressed}
          onContinue={() => {
            void handleContinue();
          }}
          presenceVisible={witnessResultPresence.visible}
          prosperityRewardId={null}
          resolutionAction={witnessResultSnapRef.current.resolutionAction}
          rewardIds={witnessResultSnapRef.current.outcome.rewards}
          rewardChargeBonus={witnessResultSnapRef.current.outcome.rewardChargeBonus}
          roll={witnessResultSnapRef.current.outcome.selectedRoll ?? null}
          usedSolutionIds={witnessResultSnapRef.current.outcome.usedInventorySolutions ?? []}
          lostSolutionIds={witnessResultSnapRef.current.outcome.lostInventorySolutions ?? []}
        />
      ) : !isWitnessingLabel ? (
        <ResultBlock
          actorShowContinue={isSystemEventActor ? actorShowContinue : true}
          continueGlowClass={continueGlowClass}
          encounterSnapshotId={encounter.snapshotId}
          continueWaitingAfterPress={continueWaitingAfterPress}
          deferRewardDismiss={deferRewardDismiss}
          disabled={continuePending}
          encounterId={encounter.encounterId}
          encounterDifficulty={encounter.encounterDifficulty ?? 1}
          avatarLevel={avatarLevel}
          hidden={loreOpen || inventoryOpen || skillbookOpen || mapOpen}
          inventory={inventory}
          localContinuePressed={localContinuePressed}
          onContinue={() => {
            void handleContinue();
          }}
          prosperityRewardId={
            serverResolution?.rewards ? null : encounter.prosperityRewardId
          }
          ref={resultBlockRef}
          resolutionAction={
            outcomeRoll !== undefined
              ? (outcomeResolutionAction ?? selectedAction)
              : (revealedRoll !== null ? selectedAction : null)
          }
          rewardIds={serverResolution?.rewards ?? encounter.rewardIds}
          rewardChargeBonus={serverResolution?.rewardChargeBonus}
          roll={levelUpRollHeld ? null : (outcomeRoll ?? revealedRoll)}
          levelUpPickedFirstId={levelUpPickedFirst}
          usedSolutionIds={usedSolutionIds}
          lostSolutionIds={serverResolution?.lostInventorySolutions ?? []}
          onItemCollected={onItemCollected}
          levelUpChoiceIds={
            isSystemEventActor && serverResolution?.levelUpChosenId === undefined
              ? serverResolution?.levelUpChoiceIds
              : undefined
          }
          onChooseLevelUpReward={async (rewardId) => {
            const room = await chooseLevelUpReward(avatarId, rewardId);
            onRoomSnapshot?.(room);
          }}
        />
      ) : null}
      {levelUpChoiceMode ? (
        <LevelUpChoiceBar
          avatarLevel={avatarLevel}
          choiceIds={levelUpChoiceIds}
          encounterKey={encounter.snapshotId}
          hidden={loreOpen || inventoryOpen || skillbookOpen || mapOpen}
          onChoose={async (rewardId) => {
            setLevelUpRollHeld(true);
            recordCommittedAction(encounter.snapshotId, 'level-up-choice');
            try {
              const room = await chooseLevelUpReward(avatarId, rewardId);
              onRoomSnapshot?.(room);
            } catch (error) {
              setLevelUpRollHeld(false);
              throw error;
            }
          }}
          onRollShown={() => {
            setLevelUpRollHeld(false);
            setLevelUpBarLingers(true);
            window.setTimeout(() => setLevelUpBarLingers(false), 600);
          }}
          roll={serverResolution?.selectedRoll}
        />
      ) : null}
      <SolutionBlock
        panelOpen={loreOpen || inventoryOpen || skillbookOpen || mapOpen}
        diceButtonAsset={diceButtonAsset}
        encounter={encounter}
        encounterRevealKey={encounter.snapshotId}
        hidden={
          levelUpChoiceMode ||
          isWitnessingLabel ||
          showWitnessResult ||
          revealedRoll !== null ||
          loreOpen ||
          inventoryOpen ||
          skillbookOpen ||
          mapOpen ||
          roomState === 'waiting_continue' ||
          roomState === 'advancing' ||
          roomState === 'resolving'
        }
        inventory={inventory}
        onActionReveal={handleActionReveal}
        setRolls={serverResolution
          ? {
            pickRolls: serverResolution.pickRolls,
            diceFillRoll: serverResolution.diceFillRoll,
            diceFillRolls: serverResolution.diceFillRolls,
          }
          : null}
        lockedSetPicks={lockedSetPicks}
        lockedDiceRolls={lockedDiceRolls}
        restoreLockedHover={roomState !== 'system_event'}
        onSetPick={async (slot) => {
          const result = await submitRoomSetPick(avatarId, slot);
          onRoomSnapshot?.(result.room);
          return result.picks;
        }}
        onSetDice={async () => {
          const result = await submitRoomSetDice(avatarId);
          onRoomSnapshot?.(result.room);
          return result.rolls;
        }}
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
        title={title}
        visible={loreOpen}
      />
      <SkillbookBlock inventory={displayInventory ?? inventory} onClose={onClosePanels} visible={skillbookOpen} />
      <InventoryBlock inventory={displayInventory ?? inventory} onClose={onClosePanels} visible={inventoryOpen} />
      </div>
    </section>
  );
}

export default EncounterImageBlock;
