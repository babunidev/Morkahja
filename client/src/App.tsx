import { useEffect, useMemo, useState } from 'react';
import {
  fetchActiveEncounter,
  fetchAvatar,
  fetchAvatars,
  heartbeatSession,
  loadStoredSession,
  logoutSession,
  deleteAvatar,
  clearStoredSession,
  fetchPlayer,
  fetchSession,
  fetchStaticGameDataStatus,
  type EncounterSnapshot,
  type PersistedAvatar,
} from './api/http.js';
import { BackgroundProvider, PersistentBackground } from './ui/background/BackgroundProvider.js';
import { preloadAvatarSelectionAssets } from './ui/avatar/avatarPreload.js';
import Dashboard from './ui/dashboard/Dashboard.js';
import GameEnvironment from './ui/game/GameEnvironment.js';
import AvatarEnterHandoff from './ui/transitions/AvatarEnterHandoff.js';
import type { AvatarEnterHandoffSnapshot } from './ui/transitions/avatarEnterTransition.js';
import LoadingScreen from './ui/loading/LoadingScreen.js';
import MusicEngine, { type MusicZone } from './ui/music/MusicEngine.js';
import OnboardingGateway from './ui/onboarding/OnboardingGateway.js';
type AppScreen = 'loading' | 'gateway' | 'dashboard' | 'game';
const AVATAR_SELECTION_PREPARE_TIMEOUT_MS = 1800;
const DEAD_AVATAR_IDS_STORAGE_KEY = 'morkahja.deadAvatarIds';

function musicZoneForScreen(screen: AppScreen): MusicZone {
  if (screen === 'dashboard') {
    return 'menu';
  }

  if (screen === 'game') {
    return 'ambient';
  }

  return 'silent';
}

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

function resetEnterHandoffState(
  setGameEnterHandoff: (value: boolean) => void,
  setHandoffLanded: (value: boolean) => void,
  setAvatarEnterHandoff: (value: AvatarEnterHandoffSnapshot | null) => void,
): void {
  setGameEnterHandoff(false);
  setHandoffLanded(false);
  setAvatarEnterHandoff(null);
}

function uniqueAvatars(avatars: PersistedAvatar[]): PersistedAvatar[] {
  const seen = new Set<string>();

  return avatars.filter((avatar) => {
    if (seen.has(avatar.id)) {
      return false;
    }

    seen.add(avatar.id);
    return true;
  });
}

async function loadAvatarSelectionList(): Promise<PersistedAvatar[]> {
  const storedAvatars = await fetchAvatars();
  const deadAvatarIds = loadDeadAvatarIds();

  await Promise.allSettled(deadAvatarIds.map((avatarId) => deleteAvatar(avatarId)));

  return uniqueAvatars(
    storedAvatars.filter((avatar) => !deadAvatarIds.includes(avatar.id)),
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
  const [avatarSlotsVisible, setAvatarSlotsVisible] = useState(false);
  const [musicFadeOutSignal, setMusicFadeOutSignal] = useState(0);
  const [gameEnterHandoff, setGameEnterHandoff] = useState(false);
  const [avatarEnterHandoff, setAvatarEnterHandoff] =
    useState<AvatarEnterHandoffSnapshot | null>(null);
  const [handoffLanded, setHandoffLanded] = useState(false);
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
    if (screen === 'loading' || screen === 'gateway') {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void heartbeatSession().catch((error: unknown) => {
        console.error('Session heartbeat failed', error);
        clearStoredSession();
        setActiveAvatar(null);
        setActiveEncounter(null);
        setScreen('gateway');
      });
    }, 45_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [screen]);

  useEffect(() => {
    if (screen !== 'dashboard' || avatarSelectionPrepared || avatarSelectionPreloading) {
      return;
    }

    let cancelled = false;

    async function prepareAvatarSelection(): Promise<void> {
      setAvatarSelectionPreloading(true);

      try {
        const storedAvatars = await Promise.race([
          loadAvatarSelectionList(),
          timeout(AVATAR_SELECTION_PREPARE_TIMEOUT_MS),
        ]);
        const avatars = storedAvatars;

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
      const avatars = await loadAvatarSelectionList();
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

  function refreshAvatarSelectionInBackground(): void {
    void (async () => {
      try {
        const avatars = await loadAvatarSelectionList();
        setAvatarSelectionAvatars(avatars);

        if (avatars.length > 0) {
          void preloadAvatarSelectionAssets(avatars);
        }

        setAvatarSelectionPrepared(true);
      } catch (error) {
        console.error('Avatar selection refresh failed', error);
      }
    })();
  }

  return (
    <BackgroundProvider>
      <PersistentBackground />
      <MusicEngine
        ambientRace={screen === 'game' ? activeAvatar?.race : null}
        ambientRole={screen === 'game' ? activeAvatar?.role : null}
        fadeOutSignal={musicFadeOutSignal}
        zone={musicZoneForScreen(screen)}
      >
        {screen === 'loading' ? (
          <LoadingScreen
            hooks={loadingHooks}
            onError={(error) => {
              console.error('Loading bootstrap failed', error);
            }}
            onReady={() => {
              setScreen(loadStoredSession()?.accessToken ? 'dashboard' : 'gateway');
            }}
          />
        ) : null}
        {screen === 'gateway' ? (
          <OnboardingGateway
            onSessionReady={() => {
              setAvatarSelectionAvatars([]);
              setAvatarSelectionPrepared(false);
              setAvatarSlotsVisible(false);
              setActiveAvatar(null);
              setActiveEncounter(null);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
            }}
          />
        ) : null}
        {screen === 'dashboard' || gameEnterHandoff ? (
          <Dashboard
            avatars={avatarSelectionAvatars}
            avatarSlotsVisible={avatarSlotsVisible}
            creationPreset={avatarCreationPreset}
            excludedAvatarIds={excludedAvatarIds}
            hidden={gameEnterHandoff}
            isPreparingAvatars={avatarSelectionPreloading && !avatarSelectionPrepared}
            onAvatarSlotsVisibleChange={setAvatarSlotsVisible}
            onAvatarsChanged={setAvatarSelectionAvatars}
            onCreationPresetConsumed={() => {
              setAvatarCreationPreset(null);
            }}
            onEnterGameComplete={() => {
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setAvatarSlotsVisible(false);
            }}
            onEnterHandoffChange={setAvatarEnterHandoff}
            onEnterWorldFailed={() => {
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
            }}
            onHandoffLand={() => {
              setHandoffLanded(true);
            }}
            onPlay={async () => {
              if (avatarSelectionPrepared) {
                refreshAvatarSelectionInBackground();
                return;
              }

              await syncAvatarSelectionForPlay();
            }}
            onAvatarEnter={() => {
              setMusicFadeOutSignal((signal) => signal + 1);
            }}
            onPrepareGame={(avatar, encounter) => {
              setActiveAvatar(avatar);
              setActiveEncounter(encounter);
              setHandoffLanded(false);
              setGameEnterHandoff(true);
              setScreen('game');
            }}
            onLogout={() => {
              void logoutSession()
                .catch((error: unknown) => {
                  console.error('Logout failed', error);
                  clearStoredSession();
                })
                .finally(() => {
                  setAvatarSelectionAvatars([]);
                  setAvatarSelectionPrepared(false);
                  setAvatarSlotsVisible(false);
                  setActiveAvatar(null);
                  setActiveEncounter(null);
                  setScreen('gateway');
                });
            }}
          />
        ) : null}
        {screen === 'game' && activeAvatar && activeEncounter ? (
          <GameEnvironment
            deferReveal={gameEnterHandoff && !handoffLanded}
            hideAvatarPortraitForHandoff={gameEnterHandoff && !handoffLanded}
            initialAvatar={activeAvatar}
            initialEncounter={activeEncounter}
            onHome={() => {
              setActiveAvatar(null);
              setActiveEncounter(null);
              setAvatarSlotsVisible(false);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
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
              setAvatarSlotsVisible(true);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
            }}
          />
        ) : null}
        {avatarEnterHandoff ? (
          <AvatarEnterHandoff
            avatar={avatarEnterHandoff.avatar}
            bounds={avatarEnterHandoff.bounds}
            fading={avatarEnterHandoff.fading}
            glowAtCenter={avatarEnterHandoff.phase === 'at-center'}
            moveDurationMs={avatarEnterHandoff.moveDurationMs}
          />
        ) : null}
      </MusicEngine>
    </BackgroundProvider>
  );
}
