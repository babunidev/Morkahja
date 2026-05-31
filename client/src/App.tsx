import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AchievementProgressDto,
  ActivityFeedJoinRoomActionDto,
  EncounterRoomSnapshotDto,
  FriendSummaryDto,
  RoomHelpInvitationDto,
} from '@shared/contracts';
import {
  createAvatar,
  fetchAchievements,
  fetchActiveEncounter,
  fetchAvatar,
  fetchFriends,
  fetchPendingHelpInvitations,
  heartbeatSession,
  joinFriendRoom,
  loadStoredSession,
  logoutSession,
  clearStoredSession,
  fetchPlayer,
  fetchSession,
  fetchStaticGameDataStatus,
  respondHelpInvite,
  selectAvatar,
  type EncounterSnapshot,
  type PersistedAvatar,
} from './api/http.js';
import { ApiRequestError, isApiErrorCode } from './api/httpErrorMessage.js';
import AchievementsOverlay from './ui/dashboard/AchievementsOverlay.js';
import {
  findNewRankUnlocks,
  pickPrimaryUnlock,
} from './ui/dashboard/achievementUnlockDetection.js';
import { markAchievementsSeen } from './ui/dashboard/achievementsAttentionState.js';
import ScribesAchievementToast from './ui/dashboard/ScribesAchievementToast.js';
import { BackgroundProvider, PersistentBackground } from './ui/background/BackgroundProvider.js';
import { preloadAvatarSelectionAssets } from './ui/avatar/avatarPreload.js';
import {
  buildAvatarFromPreset,
  resolveCreationSlotIndex,
} from './ui/avatar/avatarFromPreset.js';
import {
  loadDeadAvatarIds,
  prepareAvatarSelection,
  refreshAvatarSelectionAfterHome,
  saveDeadAvatarIds,
} from './ui/avatar/avatarSelectionPrepare.js';
import { formatAvatarDisplayName, normalizePersistedAvatar } from './ui/avatar/avatarDisplayName.js';
import GameMessageToast from './ui/game/GameMessageToast.js';
import PurchaseReturnToast from './ui/commerce/PurchaseReturnToast.js';
import Dashboard from './ui/dashboard/Dashboard.js';
import AvatarDeathOverlay from './ui/game/AvatarDeathOverlay.js';
import GameEnvironment from './ui/game/GameEnvironment.js';
import RoomFullOverlay from './ui/game/RoomFullOverlay.js';
import {
  ensureSoloLeaderRoom,
  leaveJoinedRoomForDashboard,
  resolveDashboardLeaveAvatarId,
} from './ui/game/roomSession.js';
import AvatarEnterHandoff from './ui/transitions/AvatarEnterHandoff.js';
import type { AvatarEnterHandoffSnapshot } from './ui/transitions/avatarEnterTransition.js';
import { seedDefaultAudioVolumesIfUnset } from './ui/audioVolume.js';
import LoadingScreen from './ui/loading/LoadingScreen.js';
import MusicEngine, { type MusicZone } from './ui/music/MusicEngine.js';
import OnboardingGateway from './ui/onboarding/OnboardingGateway.js';
import { useMobileFullscreen } from './ui/layout/useMobileFullscreen.js';
import { useProtectedImages } from './ui/protectedImage.js';
import { FADE_DURATION_MS } from './ui/transitions/fade.js';

type AppScreen = 'loading' | 'gateway' | 'dashboard' | 'game';

const ACHIEVEMENT_POLL_MS = 10_000;
const HELP_INVITE_POLL_MS = 5_000;
const FRIEND_JOIN_POLL_MS = 12_000;

interface FriendJoinToastState {
  friendPlayerId: string;
  friendPlayerName: string;
  roomId: string;
  encounterTitle: string;
  inviteId?: string;
}

interface RoomFullPromptState {
  avatar: PersistedAvatar;
  avatarName: string;
}

function isAchievementWatchScreen(screen: AppScreen): boolean {
  return screen === 'game' || screen === 'dashboard';
}

function musicZoneForScreen(screen: AppScreen): MusicZone {
  if (screen === 'dashboard') {
    return 'menu';
  }

  if (screen === 'game') {
    return 'ambient';
  }

  return 'silent';
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
  const [activeRoom, setActiveRoom] = useState<EncounterRoomSnapshotDto | null>(null);
  const [avatarSelectionAvatars, setAvatarSelectionAvatars] = useState<PersistedAvatar[]>([]);
  const [avatarCreationPreset, setAvatarCreationPreset] = useState<PersistedAvatar | null>(null);
  const [excludedAvatarIds, setExcludedAvatarIds] = useState(loadDeadAvatarIds);
  const [avatarSelectionPrepared, setAvatarSelectionPrepared] = useState(false);
  const [avatarSlotsVisible, setAvatarSlotsVisible] = useState(false);
  const [musicFadeOutSignal, setMusicFadeOutSignal] = useState(0);
  const [gameEnterHandoff, setGameEnterHandoff] = useState(false);
  const [avatarEnterHandoff, setAvatarEnterHandoff] =
    useState<AvatarEnterHandoffSnapshot | null>(null);
  const [handoffLanded, setHandoffLanded] = useState(false);
  const [deathOverlayAvatar, setDeathOverlayAvatar] = useState<PersistedAvatar | null>(null);
  const [deathCreationHandoff, setDeathCreationHandoff] = useState(false);
  const [avatarSelectionNotice, setAvatarSelectionNotice] = useState<string | null>(null);
  const [playPreparePending, setPlayPreparePending] = useState(false);
  const [achievementToast, setAchievementToast] = useState<AchievementProgressDto | null>(null);
  const [hearthBlessingToast, setHearthBlessingToast] = useState(false);
  const [achievementsOverlayOpen, setAchievementsOverlayOpen] = useState(false);
  const [helpInviteToast, setHelpInviteToast] = useState<RoomHelpInvitationDto | null>(null);
  const [friendJoinToast, setFriendJoinToast] = useState<FriendJoinToastState | null>(null);
  const [roomFullPrompt, setRoomFullPrompt] = useState<RoomFullPromptState | null>(null);
  const [roomFullContinuePending, setRoomFullContinuePending] = useState(false);
  const [gameEntryKey, setGameEntryKey] = useState(0);
  const achievementsBaselineRef = useRef<AchievementProgressDto[] | null>(null);
  const dailyRewardBaselineRef = useRef<{
    utcDay: string;
    claimable: boolean;
    claimedToday: boolean;
    encountersPlayed: number;
  } | null>(null);
  const seenHelpInviteIdsRef = useRef<Set<string>>(new Set());
  const seenFriendJoinKeysRef = useRef<Set<string>>(new Set());
  const helpInviteAcceptPendingRef = useRef(false);
  const session = loadStoredSession();
  const playerId = session?.playerId ?? '';
  const playerName = session?.playerName ?? '';
  useMobileFullscreen();
  useProtectedImages();

  useEffect(() => {
    seedDefaultAudioVolumesIfUnset();
  }, []);

  const checkAchievementUnlocks = useCallback(async (options?: {
    seedBaseline?: boolean;
  }): Promise<void> => {
    if (!playerId || !isAchievementWatchScreen(screen)) {
      return;
    }

    try {
      const response = await fetchAchievements();
      const previous = achievementsBaselineRef.current;

      const dailyReward = response.dailyReward;
      const previousDaily = dailyRewardBaselineRef.current;

      if (options?.seedBaseline || !previous) {
        achievementsBaselineRef.current = response.achievements;
        dailyRewardBaselineRef.current = {
          utcDay: dailyReward.utcDay,
          claimable: dailyReward.claimable,
          claimedToday: dailyReward.claimedToday,
          encountersPlayed: dailyReward.encountersPlayed,
        };
        return;
      }

      const unlock = pickPrimaryUnlock(findNewRankUnlocks(previous, response.achievements));
      achievementsBaselineRef.current = response.achievements;

      if (unlock) {
        setAchievementToast(unlock.achievement);
      }

      if (
        previousDaily
        && !previousDaily.claimable
        && dailyReward.claimable
        && !dailyReward.claimedToday
        && dailyReward.utcDay === previousDaily.utcDay
      ) {
        setHearthBlessingToast(true);
      }

      dailyRewardBaselineRef.current = {
        utcDay: dailyReward.utcDay,
        claimable: dailyReward.claimable,
        claimedToday: dailyReward.claimedToday,
        encountersPlayed: dailyReward.encountersPlayed,
      };
    } catch (error) {
      console.error('Achievement unlock check failed', error);
    }
  }, [playerId, screen]);

  useEffect(() => {
    if (!isAchievementWatchScreen(screen)) {
      setAchievementToast(null);
      setHearthBlessingToast(false);
      setAchievementsOverlayOpen(false);
      achievementsBaselineRef.current = null;
      dailyRewardBaselineRef.current = null;
      return;
    }

    void checkAchievementUnlocks({ seedBaseline: true });

    const pollTimer = window.setInterval(() => {
      void checkAchievementUnlocks();
    }, ACHIEVEMENT_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [checkAchievementUnlocks, screen]);

  useEffect(() => {
    if (screen !== 'dashboard') {
      return;
    }

    void (async () => {
      const avatarId = await resolveDashboardLeaveAvatarId();
      await leaveJoinedRoomForDashboard(avatarId);
    })();
  }, [screen]);

  const dismissHelpInviteToast = useCallback((invite: RoomHelpInvitationDto | null) => {
    if (invite) {
      seenHelpInviteIdsRef.current.add(invite.inviteId);
    }
    setHelpInviteToast(null);
  }, []);

  const enterGameFromRoom = useCallback((joinedRoom: EncounterRoomSnapshotDto) => {
    const localParticipant = joinedRoom.participants.find((participant) => participant.isLocal);
    if (!localParticipant?.avatar) {
      return;
    }

    setActiveAvatar(normalizePersistedAvatar(localParticipant.avatar));
    setActiveEncounter(joinedRoom.activeEncounter);
    setActiveRoom(joinedRoom);
    setGameEntryKey((current) => current + 1);
    resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
    setAvatarSlotsVisible(false);
    setScreen('game');
  }, []);

  const resolveJoinAvatar = useCallback(async (): Promise<PersistedAvatar | null> => {
    const response = await fetchAvatar(null);
    return response.avatar ? normalizePersistedAvatar(response.avatar) : null;
  }, []);

  const showRoomFullPrompt = useCallback(async () => {
    const avatar = await resolveJoinAvatar();
    if (!avatar) {
      return;
    }

    setRoomFullPrompt({
      avatar,
      avatarName: formatAvatarDisplayName(avatar),
    });
  }, [resolveJoinAvatar]);

  const continueSoloJourneyFromRoomFull = useCallback(async () => {
    if (!roomFullPrompt || roomFullContinuePending) {
      return;
    }

    setRoomFullContinuePending(true);

    try {
      const { avatar: selectedAvatar } = await selectAvatar(roomFullPrompt.avatar);
      const room = await ensureSoloLeaderRoom(selectedAvatar.id);
      setRoomFullPrompt(null);
      enterGameFromRoom(room);
    } catch (error) {
      console.error('Continue solo journey failed', error);
    } finally {
      setRoomFullContinuePending(false);
    }
  }, [enterGameFromRoom, roomFullContinuePending, roomFullPrompt]);

  const joinFriendEncounter = useCallback(async (
    friendPlayerId: string,
    inviteId?: string,
  ): Promise<void> => {
    if (helpInviteAcceptPendingRef.current) {
      return;
    }

    helpInviteAcceptPendingRef.current = true;
    setHelpInviteToast(null);
    setFriendJoinToast(null);

    try {
      if (inviteId) {
        seenHelpInviteIdsRef.current.add(inviteId);
        const response = await respondHelpInvite(inviteId);
        if (response.room) {
          enterGameFromRoom(response.room);
        }
        return;
      }

      const response = await joinFriendRoom(friendPlayerId);
      enterGameFromRoom(response.room);
    } catch (error) {
      if (isApiErrorCode(error, 'ROOM_FULL')) {
        await showRoomFullPrompt();
        return;
      }
      console.error('Join friend room failed', error);
    } finally {
      helpInviteAcceptPendingRef.current = false;
    }
  }, [enterGameFromRoom, showRoomFullPrompt]);

  const acceptHelpInvite = useCallback(async (invite: RoomHelpInvitationDto) => {
    await joinFriendEncounter(invite.fromPlayerId, invite.inviteId);
  }, [joinFriendEncounter]);

  const handleJoinFriend = useCallback(async (friend: FriendSummaryDto) => {
    if (!friend.joinableRoom) {
      return;
    }

    await joinFriendEncounter(
      friend.playerId,
      friend.joinableRoom.inviteId,
    );
  }, [joinFriendEncounter]);

  const handleJoinRoomFromScribes = useCallback(async (action: ActivityFeedJoinRoomActionDto) => {
    await joinFriendEncounter(action.fromPlayerId, action.inviteId);
  }, [joinFriendEncounter]);

  useEffect(() => {
    if (!playerId || !isAchievementWatchScreen(screen)) {
      setHelpInviteToast(null);
      return;
    }

    async function pollHelpInvites(): Promise<void> {
      if (helpInviteToast || helpInviteAcceptPendingRef.current) {
        return;
      }

      try {
        const response = await fetchPendingHelpInvitations();
        const now = Date.now();
        const nextInvite = response.invitations.find(
          (invitation) => (
            !seenHelpInviteIdsRef.current.has(invitation.inviteId)
            && invitation.expiresAt > now
          ),
        );

        if (nextInvite) {
          setHelpInviteToast(nextInvite);
        }
      } catch (error) {
        console.error('Help invite poll failed', error);
      }
    }

    void pollHelpInvites();

    const pollTimer = window.setInterval(() => {
      void pollHelpInvites();
    }, HELP_INVITE_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [helpInviteToast, playerId, screen]);

  useEffect(() => {
    if (!playerId || !isAchievementWatchScreen(screen)) {
      setFriendJoinToast(null);
      return;
    }

    async function pollJoinableFriends(): Promise<void> {
      if (friendJoinToast || helpInviteToast || helpInviteAcceptPendingRef.current) {
        return;
      }

      try {
        const response = await fetchFriends();
        const candidate = response.friends.find((friend) => {
          if (!friend.online || !friend.recentlyActive || !friend.joinableRoom) {
            return false;
          }

          if (friend.joinableRoom.inviteId) {
            return false;
          }

          const toastKey = `${friend.playerId}:${friend.joinableRoom.roomId}`;
          if (seenFriendJoinKeysRef.current.has(toastKey)) {
            return false;
          }

          return friend.joinableRoom.participantCount === 1;
        });

        if (!candidate?.joinableRoom) {
          return;
        }

        const toastKey = `${candidate.playerId}:${candidate.joinableRoom.roomId}`;
        seenFriendJoinKeysRef.current.add(toastKey);
        setFriendJoinToast({
          friendPlayerId: candidate.playerId,
          friendPlayerName: candidate.playerName,
          roomId: candidate.joinableRoom.roomId,
          encounterTitle: candidate.joinableRoom.encounterTitle,
        });
      } catch (error) {
        console.error('Joinable friends poll failed', error);
      }
    }

    void pollJoinableFriends();

    const pollTimer = window.setInterval(() => {
      void pollJoinableFriends();
    }, FRIEND_JOIN_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [friendJoinToast, helpInviteToast, playerId, screen]);

  const loadingHooks = useMemo(
    () => ({
      loadSession: fetchSession,
      loadAvatarSelection: async () => {
        try {
          return await prepareAvatarSelection();
        } catch (error) {
          console.error('Avatar selection prepare during loading failed', error);
          return null;
        }
      },
      loadPlayer: loadPlayerForBootstrap,
      loadAvatar: loadAvatarForBootstrap,
      loadEncounter: loadEncounterForBootstrap,
      syncState: async () => {
        await fetchStaticGameDataStatus();
      },
    }),
    [],
  );

  async function ensureAvatarSelectionPrepared(): Promise<boolean> {
    if (avatarSelectionPrepared) {
      return true;
    }

    setPlayPreparePending(true);

    try {
      const avatars = await prepareAvatarSelection();
      setAvatarSelectionAvatars(avatars);
      setAvatarSelectionPrepared(true);
      return true;
    } catch (error) {
      console.error('Avatar selection prepare failed', error);
      setAvatarSelectionPrepared(false);
      return false;
    } finally {
      setPlayPreparePending(false);
    }
  }

  async function syncAvatarSelectionAfterHomeState(): Promise<void> {
    const { avatars, purge } = await refreshAvatarSelectionAfterHome();
    setAvatarSelectionAvatars(avatars);
    setExcludedAvatarIds(purge.failedIds);
    setAvatarSelectionPrepared(true);
    setAvatarSelectionNotice(
      purge.failedIds.length > 0
        ? 'Could not remove fallen avatar; try Home again.'
        : null,
    );
  }

  async function applyAvatarSelectionFromHome(): Promise<void> {
    try {
      await syncAvatarSelectionAfterHomeState();
    } catch (error) {
      console.error('Avatar selection refresh after home failed', error);
      setAvatarSelectionPrepared(false);
      setAvatarSelectionNotice(null);
    }
  }

  useEffect(() => {
    if (screen === 'loading' || screen === 'gateway') {
      return undefined;
    }

    let transientFailures = 0;
    const interval = window.setInterval(() => {
      void heartbeatSession().then(() => {
        transientFailures = 0;
      }).catch((error: unknown) => {
        console.error('Session heartbeat failed', error);
        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
          clearStoredSession();
          setActiveAvatar(null);
          setActiveEncounter(null);
          setScreen('gateway');
          return;
        }

        transientFailures += 1;
        if (transientFailures < 3) {
          return;
        }

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

  return (
    <BackgroundProvider>
      <PersistentBackground />
      <MusicEngine
        ambientRace={screen === 'game' ? activeAvatar?.race : null}
        ambientRole={screen === 'game' ? activeAvatar?.role : null}
        fadeOutSignal={musicFadeOutSignal}
        zone={musicZoneForScreen(screen)}
      >
        <PurchaseReturnToast />
        {screen === 'loading' ? (
          <LoadingScreen
            hooks={loadingHooks}
            onError={(error) => {
              console.error('Loading bootstrap failed', error);
            }}
            onReady={(_route, context) => {
              const selection = context.avatarSelection as PersistedAvatar[] | null;

              if (selection) {
                setAvatarSelectionAvatars(selection);
                setAvatarSelectionPrepared(true);
              } else {
                setAvatarSelectionPrepared(false);
              }

              setScreen(loadStoredSession()?.accessToken ? 'dashboard' : 'gateway');
            }}
          />
        ) : null}
        {screen === 'gateway' ? (
          <OnboardingGateway
            onSessionReady={() => {
              setAvatarSlotsVisible(false);
              setActiveAvatar(null);
              setActiveEncounter(null);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);

              void (async () => {
                try {
                  const avatars = await prepareAvatarSelection();
                  setAvatarSelectionAvatars(avatars);
                  setAvatarSelectionPrepared(true);
                } catch (error) {
                  console.error('Avatar selection prepare after login failed', error);
                  setAvatarSelectionAvatars([]);
                  setAvatarSelectionPrepared(false);
                } finally {
                  setScreen('dashboard');
                }
              })();
            }}
          />
        ) : null}
        {screen === 'dashboard' || gameEnterHandoff ? (
          <Dashboard
            achievementsOpen={achievementsOverlayOpen}
            avatars={avatarSelectionAvatars}
            avatarSlotsVisible={avatarSlotsVisible}
            onAchievementCheck={() => {
              void checkAchievementUnlocks();
            }}
            onAchievementsOpenChange={setAchievementsOverlayOpen}
            creationPreset={avatarCreationPreset}
            creationRevealDelayMs={deathCreationHandoff ? FADE_DURATION_MS : 0}
            excludedAvatarIds={excludedAvatarIds}
            hidden={gameEnterHandoff}
            selectionNotice={avatarSelectionNotice}
            onAvatarSlotsVisibleChange={setAvatarSlotsVisible}
            onAvatarsChanged={(avatars) => {
              setAvatarSelectionAvatars(avatars);
              setActiveAvatar((current) => {
                if (!current) {
                  return current;
                }

                const updated = avatars.find((avatar) => avatar.id === current.id);
                return updated ?? current;
              });
              void preloadAvatarSelectionAssets(avatars).catch((error: unknown) => {
                console.error('Avatar selection preload after change failed', error);
              });
            }}
            onAvatarSelectionHome={() => {
              void applyAvatarSelectionFromHome();
            }}
            onCreationPresetConsumed={() => {
              setAvatarCreationPreset(null);
              setDeathCreationHandoff(false);
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
            playPreparePending={playPreparePending}
            onPlay={ensureAvatarSelectionPrepared}
            onAvatarEnter={() => {
              setMusicFadeOutSignal((signal) => signal + 1);
            }}
            onJoinFriend={(friend) => {
              void handleJoinFriend(friend);
            }}
            onJoinRoomFromScribes={(action) => {
              void handleJoinRoomFromScribes(action);
            }}
            onPrepareGame={(avatar, encounter) => {
              setActiveAvatar(avatar);
              setActiveEncounter(encounter);
              setActiveRoom(null);
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
                  setActiveRoom(null);
                  setScreen('gateway');
                });
            }}
          />
        ) : null}
        {screen === 'game' && activeAvatar && activeEncounter ? (
          <GameEnvironment
            key={gameEntryKey}
            deathPending={deathOverlayAvatar !== null}
            deferReveal={gameEnterHandoff && !handoffLanded}
            hideAvatarPortraitForHandoff={gameEnterHandoff && !handoffLanded}
            initialAvatar={activeAvatar}
            initialEncounter={activeEncounter}
            initialRoom={activeRoom}
            onHome={() => {
              const avatarId = activeAvatar?.id;
              setActiveAvatar(null);
              setActiveEncounter(null);
              setActiveRoom(null);
              setAvatarSlotsVisible(false);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
              void (async () => {
                await leaveJoinedRoomForDashboard(avatarId);
                await applyAvatarSelectionFromHome();
              })();
            }}
            onAchievementCheck={() => {
              void checkAchievementUnlocks();
            }}
            onAvatarDeath={(presetAvatar) => {
              setExcludedAvatarIds((currentIds) => {
                const nextIds = currentIds.includes(presetAvatar.id)
                  ? currentIds
                  : [...currentIds, presetAvatar.id];
                saveDeadAvatarIds(nextIds);
                return nextIds;
              });
              setAvatarSelectionAvatars((currentAvatars) => (
                currentAvatars.filter((avatar) => avatar.id !== presetAvatar.id)
              ));
              setDeathOverlayAvatar(presetAvatar);
            }}
          />
        ) : null}
        {deathOverlayAvatar ? (
          <AvatarDeathOverlay
            avatarName={formatAvatarDisplayName(deathOverlayAvatar)}
            onHandoffComplete={() => {
              setDeathOverlayAvatar(null);
            }}
            onNewAvatar={async () => {
              const preset = deathOverlayAvatar;
              if (!preset) {
                return;
              }

              try {
                await syncAvatarSelectionAfterHomeState();
              } catch (error) {
                console.error('Death overlay new avatar prepare failed', error);
                setAvatarSelectionPrepared(false);
                setAvatarSelectionNotice('Could not refresh avatars. Try again.');
                throw error;
              }

              setDeathCreationHandoff(true);
              setActiveAvatar(null);
              setActiveEncounter(null);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
              setAvatarSlotsVisible(true);
              setAvatarCreationPreset(null);
              window.requestAnimationFrame(() => {
                setAvatarCreationPreset(preset);
              });
            }}
            onSameSoul={async () => {
              const preset = deathOverlayAvatar;
              if (!preset) {
                return;
              }

              let avatars: PersistedAvatar[];
              let purgeFailedIds: string[];

              try {
                const refresh = await refreshAvatarSelectionAfterHome();
                avatars = refresh.avatars;
                purgeFailedIds = refresh.purge.failedIds;
                setAvatarSelectionAvatars(avatars);
                setExcludedAvatarIds(purgeFailedIds);
                setAvatarSelectionPrepared(true);
                setAvatarSelectionNotice(
                  purgeFailedIds.length > 0
                    ? 'Could not remove fallen avatar; try again.'
                    : null,
                );
              } catch (error) {
                console.error('Death overlay same soul prepare failed', error);
                setAvatarSelectionPrepared(false);
                setAvatarSelectionNotice('Could not refresh avatars. Try again.');
                throw error;
              }

              const slotIndex = resolveCreationSlotIndex(avatars, purgeFailedIds);

              try {
                await createAvatar(buildAvatarFromPreset(preset, slotIndex));
                const refreshedAvatars = await prepareAvatarSelection();
                setAvatarSelectionAvatars(refreshedAvatars);
                void checkAchievementUnlocks();
              } catch (error) {
                console.error('Death overlay same soul create failed', error);
                setAvatarSelectionNotice('Could not create avatar. Try again.');
                throw error;
              }

              setDeathCreationHandoff(false);
              setAvatarCreationPreset(null);
              setActiveAvatar(null);
              setActiveEncounter(null);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
              setAvatarSlotsVisible(true);
            }}
            open
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
        {isAchievementWatchScreen(screen) && achievementToast ? (
          <ScribesAchievementToast
            achievement={achievementToast}
            onDismiss={() => {
              setAchievementToast(null);
            }}
            onOpenAchievements={() => {
              setAchievementsOverlayOpen(true);
            }}
            playerName={playerName}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && hearthBlessingToast ? (
          <GameMessageToast
            label="Scribes"
            message="Your Hearth Blessing is ready to be claimed."
            onClick={() => {
              setAchievementsOverlayOpen(true);
            }}
            onDismiss={() => {
              setHearthBlessingToast(false);
            }}
            stackOffsetPx={achievementToast ? 78 : 0}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && helpInviteToast ? (
          <GameMessageToast
            label="Call for help"
            message={`${helpInviteToast.fromPlayerName} calls for help. Tap to join.`}
            onClick={() => {
              void acceptHelpInvite(helpInviteToast);
            }}
            onDismiss={() => {
              dismissHelpInviteToast(helpInviteToast);
            }}
            stackOffsetPx={achievementToast || hearthBlessingToast ? 78 : 0}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && friendJoinToast ? (
          <GameMessageToast
            label="Join friend"
            message={`${friendJoinToast.friendPlayerName} is at ${friendJoinToast.encounterTitle}. Tap to join.`}
            onClick={() => {
              void joinFriendEncounter(friendJoinToast.friendPlayerId);
            }}
            onDismiss={() => {
              seenFriendJoinKeysRef.current.add(
                `${friendJoinToast.friendPlayerId}:${friendJoinToast.roomId}`,
              );
              setFriendJoinToast(null);
            }}
            stackOffsetPx={
              achievementToast || hearthBlessingToast || helpInviteToast ? 78 : 0
            }
          />
        ) : null}
        {roomFullPrompt ? (
          <RoomFullOverlay
            avatarName={roomFullPrompt.avatarName}
            continuePending={roomFullContinuePending}
            onContinueJourney={() => {
              void continueSoloJourneyFromRoomFull();
            }}
            onGoToDashboard={() => {
              setRoomFullPrompt(null);
            }}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && achievementsOverlayOpen && playerId ? (
          <AchievementsOverlay
            onClose={() => {
              setAchievementsOverlayOpen(false);
            }}
            onProgressChange={() => {
              void checkAchievementUnlocks();
            }}
            onSnapshotViewed={(snapshot) => {
              markAchievementsSeen(playerId, snapshot);
              achievementsBaselineRef.current = snapshot.achievements;
              dailyRewardBaselineRef.current = {
                utcDay: snapshot.dailyReward.utcDay,
                claimable: snapshot.dailyReward.claimable,
                claimedToday: snapshot.dailyReward.claimedToday,
                encountersPlayed: snapshot.dailyReward.encountersPlayed,
              };
              if (!snapshot.dailyReward.claimable) {
                setHearthBlessingToast(false);
              }
            }}
            open
            playerId={playerId}
          />
        ) : null}
      </MusicEngine>
    </BackgroundProvider>
  );
}
