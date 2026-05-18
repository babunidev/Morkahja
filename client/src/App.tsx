import { useEffect, useMemo, useState } from 'react';
import {
  fetchActiveEncounter,
  fetchAvatar,
  fetchAvatars,
  deleteAvatar,
  fetchPlayer,
  fetchSession,
  fetchStaticGameDataStatus,
  type EncounterSnapshot,
  type PersistedAvatar,
} from './api/http.js';
import { BackgroundProvider, PersistentBackground } from './ui/background/BackgroundProvider.js';
import AvatarSelect from './ui/avatar/AvatarSelect.js';
import { preloadAvatarSelectionAssets } from './ui/avatar/avatarPreload.js';
import Dashboard from './ui/dashboard/Dashboard.js';
import GameEnvironment from './ui/game/GameEnvironment.js';
import LoadingScreen from './ui/loading/LoadingScreen.js';

type AppScreen = 'loading' | 'dashboard' | 'avatar-select' | 'game';
const AVATAR_SELECTION_PREPARE_TIMEOUT_MS = 1800;
const DEAD_AVATAR_IDS_STORAGE_KEY = 'morkahja.deadAvatarIds';

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    window.setTimeout(() => {
      reject(new Error(`Timed out after ${ms}ms`));
    }, ms);
  });
}

function loadDeadAvatarIds(): string[] {
  try {
    const value = window.localStorage.getItem(DEAD_AVATAR_IDS_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function saveDeadAvatarIds(ids: string[]): void {
  window.localStorage.setItem(
    DEAD_AVATAR_IDS_STORAGE_KEY,
    JSON.stringify([...new Set(ids)]),
  );
}

async function loadPlayerForBootstrap(
  session: Awaited<ReturnType<typeof fetchSession>> | null,
): Promise<Awaited<ReturnType<typeof fetchPlayer>>> {
  try {
    return await fetchPlayer(session);
  } catch (error) {
    console.error('Player bootstrap failed', error);
    return { playerId: session?.playerId ?? 'Babuni' };
  }
}

async function loadAvatarForBootstrap(
  player: Awaited<ReturnType<typeof fetchPlayer>> | null,
): Promise<Awaited<ReturnType<typeof fetchAvatar>>> {
  try {
    return await fetchAvatar(player);
  } catch (error) {
    console.error('Avatar bootstrap failed', error);
    return {};
  }
}

async function loadEncounterForBootstrap(
  avatar: Awaited<ReturnType<typeof fetchAvatar>> | null,
): Promise<Awaited<ReturnType<typeof fetchActiveEncounter>>> {
  try {
    return await fetchActiveEncounter(avatar);
  } catch (error) {
    console.error('Encounter bootstrap failed', error);
    return null;
  }
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [activeAvatar, setActiveAvatar] = useState<PersistedAvatar | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<EncounterSnapshot | null>(null);
  const [avatarSelectionAvatars, setAvatarSelectionAvatars] = useState<PersistedAvatar[]>([]);
  const [avatarCreationPreset, setAvatarCreationPreset] = useState<PersistedAvatar | null>(null);
  const [excludedAvatarIds, setExcludedAvatarIds] = useState(loadDeadAvatarIds);
  const [avatarSelectionPreloading, setAvatarSelectionPreloading] = useState(false);
  const [avatarSelectionPrepared, setAvatarSelectionPrepared] = useState(false);
  const loadingHooks = useMemo(
    () => ({
      loadSession: fetchSession,
      loadPlayer: loadPlayerForBootstrap,
      loadAvatar: loadAvatarForBootstrap,
      loadEncounter: loadEncounterForBootstrap,
      syncState: async () => {
        await fetchStaticGameDataStatus();
      },
    }),
    [],
  );

  useEffect(() => {
    if (screen !== 'dashboard' || avatarSelectionPrepared || avatarSelectionPreloading) {
      return;
    }

    let cancelled = false;

    async function prepareAvatarSelection(): Promise<void> {
      setAvatarSelectionPreloading(true);

      try {
        const storedAvatars = await Promise.race([
          fetchAvatars(),
          timeout(AVATAR_SELECTION_PREPARE_TIMEOUT_MS),
        ]);
        const deadAvatarIds = loadDeadAvatarIds();

        await Promise.allSettled(deadAvatarIds.map((avatarId) => deleteAvatar(avatarId)));

        const avatars = storedAvatars.filter((avatar) => !deadAvatarIds.includes(avatar.id));

        if (!cancelled) {
          setAvatarSelectionAvatars(avatars);
        }

        if (avatars.length > 0) {
          await preloadAvatarSelectionAssets(avatars);
        }
      } catch (error) {
        console.error('Avatar selection preload failed', error);
        if (!cancelled) {
          setAvatarSelectionAvatars([]);
        }
      } finally {
        if (!cancelled) {
          setAvatarSelectionPrepared(true);
          setAvatarSelectionPreloading(false);
        }
      }
    }

    void prepareAvatarSelection();

    return () => {
      cancelled = true;
    };
  }, [avatarSelectionPrepared, avatarSelectionPreloading, screen]);

  async function syncAvatarSelectionForPlay(): Promise<void> {
    setAvatarSelectionPreloading(true);

    try {
      const storedAvatars = await fetchAvatars();
      const deadAvatarIds = loadDeadAvatarIds();

      await Promise.allSettled(deadAvatarIds.map((avatarId) => deleteAvatar(avatarId)));

      const avatars = storedAvatars.filter((avatar) => !deadAvatarIds.includes(avatar.id));
      setAvatarSelectionAvatars(avatars);

      if (avatars.length > 0) {
        await preloadAvatarSelectionAssets(avatars);
      }

      setAvatarSelectionPrepared(true);
    } catch (error) {
      console.error('Avatar selection play sync failed', error);
      setAvatarSelectionPrepared(false);
    } finally {
      setAvatarSelectionPreloading(false);
    }
  }

  return (
    <BackgroundProvider>
      <PersistentBackground />
      {screen === 'loading' ? (
        <LoadingScreen
          hooks={loadingHooks}
          onError={(error) => {
            console.error('Loading bootstrap failed', error);
          }}
          onReady={() => {
            setScreen('dashboard');
          }}
        />
      ) : null}
      {screen === 'dashboard' ? (
        <Dashboard
          isPreparingAvatars={avatarSelectionPreloading}
          onPlay={async () => {
            await syncAvatarSelectionForPlay();
            setScreen('avatar-select');
          }}
        />
      ) : null}
      {screen === 'avatar-select' ? (
        <AvatarSelect
          avatars={avatarSelectionAvatars}
          avatarsLoaded={avatarSelectionPrepared}
          creationPreset={avatarCreationPreset}
          excludedAvatarIds={excludedAvatarIds}
          onCreationPresetConsumed={() => {
            setAvatarCreationPreset(null);
          }}
          onBack={() => {
            setScreen('dashboard');
          }}
          onEnterGame={(avatar, encounter) => {
            setActiveAvatar(avatar);
            setActiveEncounter(encounter);
            setScreen('game');
          }}
        />
      ) : null}
      {screen === 'game' && activeAvatar && activeEncounter ? (
        <GameEnvironment
          initialAvatar={activeAvatar}
          initialEncounter={activeEncounter}
          onHome={() => {
            setActiveAvatar(null);
            setActiveEncounter(null);
            setScreen('dashboard');
          }}
          onAvatarDeath={(presetAvatar) => {
            setExcludedAvatarIds((currentIds) => (
              (() => {
                const nextIds = currentIds.includes(presetAvatar.id)
                  ? currentIds
                  : [...currentIds, presetAvatar.id];
                saveDeadAvatarIds(nextIds);
                return nextIds;
              })()
            ));
            setAvatarSelectionAvatars((currentAvatars) => (
              currentAvatars.filter((avatar) => avatar.id !== presetAvatar.id)
            ));
            setAvatarCreationPreset(presetAvatar);
            setActiveAvatar(null);
            setActiveEncounter(null);
            setAvatarSelectionPrepared(true);
            setAvatarSelectionPreloading(false);
            setScreen('avatar-select');
          }}
        />
      ) : null}
    </BackgroundProvider>
  );
}
