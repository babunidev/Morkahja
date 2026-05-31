import { useEffect, useState, type CSSProperties, type Ref } from 'react';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterRoomSnapshotDto,
  EncounterSnapshot,
  ParticipantResolutionSummaryDto,
  RoomStateDto,
} from '../../../api/http.js';
import { activateRoomLoreGem } from '../../../api/http.js';
import InventoryBlock from './InventoryBlock.js';
import LoreBlock from './LoreBlock.js';
import SkillbookBlock from './SkillbookBlock.js';
import { ENCOUNTER_FADE_DURATION_MS, encounterFadeTransition } from '../../transitions/fade.js';
import ResultBlock, { type ResultBlockHandle } from './ResultBlock.js';
import SolutionBlock from './SolutionBlock.js';

const ENCOUNTER_IMAGE_RELEASE_BUFFER_MS = 100;

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

export function EncounterImageBlock({
  avatarId,
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
  skillbookOpen,
  title,
  witnessMode = false,
  systemEventActorName,
}: {
  avatarId: string;
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
  skillbookOpen: boolean;
  title: string;
  witnessMode?: boolean;
  systemEventActorName?: string;
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
    setRevealedRoll(null);
    setSelectedAction('dice');
    setSelectedSolutionId(null);
  }, [encounter.snapshotId]);

  useEffect(() => {
    if (serverResolution?.selectedRoll !== undefined) {
      setRevealedRoll(serverResolution.selectedRoll);
    }
  }, [serverResolution?.selectedRoll, encounter.snapshotId]);

  useEffect(() => {
    onResultsVisibleChange?.(revealedRoll !== null);
  }, [onResultsVisibleChange, revealedRoll]);

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

  function handleActionReveal(
    action: EncounterAction,
    roll: number | null,
    solutionId?: number,
  ): void {
    setSelectedAction(action);
    setRevealedRoll(roll);
    setSelectedSolutionId(solutionId ?? null);
  }

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
      {witnessMode ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            zIndex: 22,
            padding: '10px 18px',
            borderRadius: 8,
            background: 'rgba(6, 7, 10, 0.82)',
            color: '#e8d4a8',
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(0.85rem, 2.5vw, 1.05rem)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {systemEventActorName
            ? `Witnessing ${systemEventActorName}'s fate…`
            : 'Witnessing a shared moment…'}
        </div>
      ) : null}
      <ResultBlock
        diceOutcomeIcon={diceButtonAsset}
        continueGlowClass={continueGlowClass}
        continueWaitingAfterPress={continueWaitingAfterPress}
        deferRewardDismiss={deferRewardDismiss}
        disabled={continuePending || (witnessMode && roomState === 'system_event')}
        showLoreGemReward={showLoreGemReward}
        encounterId={encounter.encounterId}
        encounterDifficulty={encounter.encounterDifficulty ?? 1}
        hidden={loreOpen || inventoryOpen || skillbookOpen}
        inventory={inventory}
        localContinuePressed={localContinuePressed}
        onContinue={() => {
          void handleContinue();
        }}
        prosperityRewardId={encounter.prosperityRewardId}
        ref={resultBlockRef}
        resolutionAction={revealedRoll !== null ? selectedAction : null}
        rewardIds={serverResolution?.rewards ?? encounter.rewardIds}
        roll={revealedRoll}
        usedSolutionId={selectedSolutionId}
      />
      <SolutionBlock
        diceButtonAsset={diceButtonAsset}
        encounter={encounter}
        encounterRevealKey={encounter.snapshotId}
        hidden={
          witnessMode ||
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
