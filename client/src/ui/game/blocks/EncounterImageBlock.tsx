import { useEffect, useState, type CSSProperties } from 'react';
import type {
  AvatarInventory,
  EncounterAction,
  EncounterSnapshot,
} from '../../../api/http.js';
import { claimLoreGem, offerLoreGem } from '../../../api/http.js';
import InventoryBlock from './InventoryBlock.js';
import LoreBlock from './LoreBlock.js';
import SkillbookBlock from './SkillbookBlock.js';
import { ENCOUNTER_FADE_DURATION_MS, encounterFadeTransition } from '../../transitions/fade.js';
import ResultBlock from './ResultBlock.js';
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
  encounter,
  imageSrc,
  inventory,
  inventoryOpen,
  loreOpen,
  onContinue,
  skillbookOpen,
  title,
}: {
  avatarId: string;
  continuePending: boolean;
  encounter: EncounterSnapshot;
  imageSrc: string;
  inventory: AvatarInventory | undefined;
  inventoryOpen: boolean;
  loreOpen: boolean;
  skillbookOpen: boolean;
  onContinue: (
    action: EncounterAction,
    roll: number | null,
    solutionId: number | null,
  ) => Promise<void>;
  title: string;
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

  async function handleContinue(): Promise<void> {
    await onContinue(selectedAction, revealedRoll, selectedSolutionId);
    setRevealedRoll(null);
    setSelectedAction('dice');
    setSelectedSolutionId(null);
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
          }}
        />
      )}
      <ResultBlock
        disabled={continuePending}
        encounterId={encounter.encounterId}
        encounterDifficulty={encounter.encounterDifficulty ?? 1}
        hidden={loreOpen || inventoryOpen || skillbookOpen}
        inventory={inventory}
        onContinue={() => {
          void handleContinue();
        }}
        prosperityRewardId={encounter.prosperityRewardId}
        resolutionAction={revealedRoll !== null ? selectedAction : null}
        rewardIds={encounter.rewardIds}
        roll={revealedRoll}
        usedSolutionId={selectedSolutionId}
      />
      <SolutionBlock
        encounter={encounter}
        encounterRevealKey={encounter.snapshotId}
        hidden={revealedRoll !== null || loreOpen || inventoryOpen || skillbookOpen}
        inventory={inventory}
        onActionReveal={handleActionReveal}
      />
      <InventoryBlock inventory={inventory} visible={inventoryOpen} />
      <SkillbookBlock inventory={inventory} visible={skillbookOpen} />
      <LoreBlock
        encounterKey={encounter.snapshotId}
        onLoreGemCollect={async () => {
          await claimLoreGem(avatarId, encounter.snapshotId);
        }}
        onLoreGemOffer={async () => offerLoreGem(avatarId)}
        text={encounter.encounterText ?? ''}
        visible={loreOpen}
      />
    </section>
  );
}

export default EncounterImageBlock;
