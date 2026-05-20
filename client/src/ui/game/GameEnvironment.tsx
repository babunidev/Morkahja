import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import encountersData from '../../data/game/encountersdata.json';
import solutionData from '../../data/game/solutiondata.json';
import {
  deleteAvatar,
  resolveEncounterAction,
  type AvatarInventory,
  type EncounterAction,
  type EncounterSnapshot,
  type InventoryItem,
  type PersistedAvatar,
} from '../../api/http.js';
import GameLayout from '../layout/GameLayout.js';
import { LEVEL_UP_SOUND, playSfx } from '../sfx.js';
import { fadeStyle, waitForFade } from '../transitions/fade.js';
import EncounterHeader from './blocks/EncounterHeader.js';
import EncounterImageBlock from './blocks/EncounterImageBlock.js';
import PlayerHub from './blocks/PlayerHub.js';

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

type RollOutcome = 'Misery' | 'Hardship' | 'Disengage' | 'Fortune' | 'Prosperity';

const solutionsById = solutionData as Record<string, SolutionDataRecord>;

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve();
    };
    image.onerror = () => {
      resolve();
    };
    image.src = src;
  });
}

interface GameEnvironmentProps {
  deferReveal?: boolean;
  hideAvatarPortraitForHandoff?: boolean;
  initialAvatar: PersistedAvatar;
  initialEncounter: EncounterSnapshot;
  onAvatarDeath: (presetAvatar: PersistedAvatar) => void;
  onHome: () => void;
}

const topZoneStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: '15% minmax(0, 1fr)',
};

const headerSlotStyle: CSSProperties = {
  minHeight: 0,
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

function encounterLookup(encounterId: number): EncounterDataRecord | null {
  const directKey = String(encounterId).padStart(5, '0');
  const records = encountersData as Record<string, EncounterDataRecord>;

  return records[directKey] ?? records[String(encounterId)] ?? null;
}

function imagePath(imageName: string): string {
  const fileName = imageName.endsWith('.webp') ? imageName : `${imageName}.webp`;
  return `${ENCOUNTER_IMAGE_ROOT}/${fileName}`;
}

function interpretRoll(roll: number): RollOutcome | null {
  if (roll >= 1 && roll <= 10) {
    return 'Misery';
  }
  if (roll >= 11 && roll <= 39) {
    return 'Hardship';
  }
  if (roll >= 40 && roll <= 60) {
    return 'Disengage';
  }
  if (roll >= 61 && roll <= 95) {
    return 'Fortune';
  }
  if (roll >= 96 && roll <= 100) {
    return 'Prosperity';
  }
  return null;
}

function rewardName(rewardId: number): string {
  return solutionsById[String(rewardId)]?.mSolutionName ?? `Reward ${rewardId}`;
}

function inventoryUseMap(inventory: AvatarInventory | undefined): Map<number, number> {
  const map = new Map<number, number>();

  if (!inventory) {
    return map;
  }

  const items: InventoryItem[] = [
    ...inventory.spellbook,
    ...inventory.items,
    ...inventory.essences,
  ];

  for (const item of items) {
    map.set(item.solutionId, (map.get(item.solutionId) ?? 0) + item.uses);
  }

  return map;
}

function inventoryMovementEntries(
  before: AvatarInventory | undefined,
  after: AvatarInventory | undefined,
  usedSolutionIds: number[],
): string[] {
  const beforeUses = inventoryUseMap(before);
  const afterUses = inventoryUseMap(after);
  const solutionIds = new Set([...beforeUses.keys(), ...afterUses.keys()]);
  const usedIds = new Set(usedSolutionIds);
  const entries: string[] = [];

  for (const solutionId of solutionIds) {
    const delta = (afterUses.get(solutionId) ?? 0) - (beforeUses.get(solutionId) ?? 0);

    if (delta > 0) {
      entries.push(`Got: ${rewardName(solutionId)} +${delta}`);
    }

    if (delta < 0) {
      const verb = usedIds.has(solutionId) ? 'Used' : 'Lost';
      entries.push(`${verb}: ${rewardName(solutionId)} ${delta}`);
    }
  }

  return entries;
}

function actionLogEntries({
  encounterTitle,
  inventoryEntries,
  message,
  rewards,
  roll,
  solutionIds,
}: {
  encounterTitle: string;
  inventoryEntries: string[];
  message: string;
  rewards: number[];
  roll: number | null;
  solutionIds: number[];
}): string[] {
  const outcome = roll === null ? null : interpretRoll(roll);
  const inventoryRewardIds = new Set(
    inventoryEntries
      .filter((entry) => entry.startsWith('Got: '))
      .map((entry) => entry.match(/^Got: (.+) \+\d+$/)?.[1])
      .filter((entry): entry is string => Boolean(entry)),
  );

  return [
    `Encounter: ${encounterTitle}`,
    solutionIds.length > 0
      ? `Solution: ${solutionIds.map(rewardName).join(', ')}`
      : 'Solution: Dice',
    roll === null
      ? 'Roll: unknown'
      : `Roll: ${roll}${outcome ? ` (${outcome})` : ''}`,
    ...inventoryEntries,
    ...rewards
      .map(rewardName)
      .filter((name) => !inventoryRewardIds.has(name))
      .map((name) => `Got: ${name}`),
    message ? `Result: ${message}` : '',
  ].filter((entry) => entry.length > 0);
}

function isFatalAtranorRoll(encounter: EncounterSnapshot, encounterTitle: string, roll: number | null): boolean {
  const outcome = roll === null ? null : interpretRoll(roll);
  const isAtranor = encounter.encounterId === 1 || encounterTitle.toLowerCase() === 'atranor';

  return isAtranor && (outcome === 'Misery' || outcome === 'Hardship');
}

export function GameEnvironment({
  deferReveal = false,
  hideAvatarPortraitForHandoff = false,
  initialAvatar,
  initialEncounter,
  onAvatarDeath,
  onHome,
}: GameEnvironmentProps) {
  const [visible, setVisible] = useState(!deferReveal);
  const [avatar, setAvatar] = useState(initialAvatar);
  const [encounter, setEncounter] = useState(initialEncounter);
  const [continuePending, setContinuePending] = useState(false);
  const [loreOpen, setLoreOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [skillbookOpen, setSkillbookOpen] = useState(false);
  const [homeVisible, setHomeVisible] = useState(false);
  const [actionLog, setActionLog] = useState<string[]>([]);
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
    () => preparedEncounterId
      ? encounterLookup(preparedEncounterId)
      : null,
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
    if (deferReveal) {
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [deferReveal]);

  async function handleContinueEncounter(
    action: EncounterAction,
    selectedRoll: number | null,
    selectedSolutionId: number | null,
  ): Promise<void> {
    if (continuePending) {
      return;
    }

    setContinuePending(true);

    try {
      const resolvedEncounterTitle = title;
      const resolvedRoll = selectedRoll;
      const fatalAtranorRoll = isFatalAtranorRoll(encounter, resolvedEncounterTitle, resolvedRoll);

      if (fatalAtranorRoll) {
        setActionLog((currentLog) => [
          ...currentLog,
          ...actionLogEntries({
            encounterTitle: resolvedEncounterTitle,
            inventoryEntries: [],
            message: 'Atranor claimed your avatar.',
            rewards: [],
            roll: resolvedRoll,
            solutionIds: [],
          }),
        ].slice(-24));
        try {
          await deleteAvatar(avatar.id);
        } catch (error) {
          console.error('Failed to delete dead avatar', error);
        }
        onAvatarDeath(avatar);
        return;
      }

      const inventoryBefore = avatar.inventory;
      const result = await resolveEncounterAction(action, avatar.id);
      const inventoryAfter = result.avatar?.inventory;
      const usedSolutionIds = result.usedInventorySolutions ?? [];
      const loggedSolutionIds = usedSolutionIds.length > 0
        ? usedSolutionIds
        : selectedSolutionId === null
          ? []
          : [selectedSolutionId];
      const resultRoll = result.selectedRoll ?? resolvedRoll;
      setActionLog((currentLog) => [
        ...currentLog,
        ...actionLogEntries({
          encounterTitle: resolvedEncounterTitle,
          inventoryEntries: inventoryMovementEntries(inventoryBefore, inventoryAfter, usedSolutionIds),
          message: result.message,
          rewards: result.rewards,
          roll: resultRoll,
          solutionIds: loggedSolutionIds,
        }),
      ].slice(-24));

      setEncounter(result.snapshot);
      setLoreOpen(false);
      setInventoryOpen(false);
      setSkillbookOpen(false);

      if (result.avatar) {
        if (result.avatar.level > avatar.level) {
          playSfx(LEVEL_UP_SOUND);
        }
        setAvatar(result.avatar);
      }
    } finally {
      setContinuePending(false);
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

  return (
    <div aria-label="Game Environment" style={fadeStyle(visible)}>
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
            </div>
            <div style={{ ...encounterImageSlotStyle, ...delayStyle(visible, 1) }}>
              <EncounterImageBlock
                encounter={encounter}
                imageSrc={imagePath(encounterImageName)}
                inventory={avatar.inventory}
                continuePending={continuePending}
                inventoryOpen={inventoryOpen}
                loreOpen={loreOpen}
                onContinue={handleContinueEncounter}
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
            />
          </div>
        }
      />
    </div>
  );
}

export default GameEnvironment;
