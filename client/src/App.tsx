import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AchievementProgressDto,
  ActivityFeedEntryDto,
  ActivityFeedJoinRoomActionDto,
  EncounterRoomSnapshotDto,
  FriendSummaryDto,
  RoomHelpInvitationDto,
} from '@shared/contracts';
import {
  createAvatar,
  fetchAchievements,
  fetchAvatar,
  fetchAvatars,
  fetchPendingHelpInvitations,
  heartbeatSession,
  joinFriendRoom,
  leaveAllEncounterRooms,
  leaveEncounterRoom,
  processRoomAwayKeepalive,
  loadStoredSession,
  logoutSession,
  clearStoredSession,
  fetchPlayer,
  fetchRecentActivity,
  fetchSession,
  fetchStaticGameDataStatus,
  finalizeAvatarDeath,
  respondHelpInvite,
  sacrificeAvatar,
  selectAvatar,
  type EncounterSnapshot,
  type PersistedAvatar,
} from './api/http.js';
import { ApiRequestError, isApiErrorCode, userFacingApiErrorMessage } from './api/httpErrorMessage.js';
import AchievementsOverlay from './ui/dashboard/AchievementsOverlay.js';
import {
  findNewRankUnlocks,
  pickPrimaryUnlock,
} from './ui/dashboard/achievementUnlockDetection.js';
import { markAchievementsSeen } from './ui/dashboard/achievementsAttentionState.js';
import {
  findNextHelpJoinToastEntry,
  findNextRoomStartJoinToastEntry,
  markActivityJoinToastShown,
  seedActivityJoinToastsSeen,
} from './ui/dashboard/activityJoinToastState.js';
import {
  findNextPrivateScribeToastEntry,
  markPrivateScribeToastShown,
} from './ui/dashboard/privateScribeToastState.js';
import ScribesAchievementToast from './ui/dashboard/ScribesAchievementToast.js';
import { BackgroundProvider, PersistentBackground } from './ui/background/BackgroundProvider.js';
import SolutionStarfield from './ui/background/SolutionStarfield.js';
import { preloadAvatarSelectionAssets } from './ui/avatar/avatarPreload.js';
import {
  buildAvatarFromPreset,
  resolveCreationSlotIndex,
} from './ui/avatar/avatarFromPreset.js';
import {
  prepareAvatarSelection,
  refreshAvatarSelectionAfterHome,
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
  leaveAllRoomsForDashboard,
} from './ui/game/roomSession.js';
import AvatarEnterHandoff from './ui/transitions/AvatarEnterHandoff.js';
import AvatarSolutionInflow from './ui/transitions/AvatarSolutionInflow.js';
import type { AvatarEnterHandoffSnapshot } from './ui/transitions/avatarEnterTransition.js';
import {
  enterGameWithHandoff,
} from './ui/transitions/avatarEnterTransition.js';
import { enrichDeathOverlayAvatar } from './ui/game/roomContinue.js';
import { seedDefaultAudioVolumesIfUnset } from './ui/audioVolume.js';
import { LEVEL_UP_SOUND, playSfx } from './ui/sfx.js';
import LoadingScreen from './ui/loading/LoadingScreen.js';
import MusicEngine, { type MusicZone } from './ui/music/MusicEngine.js';
import OnboardingGateway from './ui/onboarding/OnboardingGateway.js';
import { useMobileFullscreen } from './ui/layout/useMobileFullscreen.js';
import { useProtectedImages } from './ui/protectedImage.js';
import { FADE_DURATION_MS } from './ui/transitions/fade.js';

type AppScreen = 'loading' | 'gateway' | 'dashboard' | 'game';

const ACHIEVEMENT_POLL_MS = 10_000;
const HELP_INVITE_POLL_MS = 5_000;

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

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading');
  const [activeAvatar, setActiveAvatar] = useState<PersistedAvatar | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<EncounterSnapshot | null>(null);
  const [activeRoom, setActiveRoom] = useState<EncounterRoomSnapshotDto | null>(null);
  const [avatarSelectionAvatars, setAvatarSelectionAvatars] = useState<PersistedAvatar[]>([]);
  const [avatarCreationPreset, setAvatarCreationPreset] = useState<PersistedAvatar | null>(null);
  const [avatarSelectionPrepared, setAvatarSelectionPrepared] = useState(false);
  const [avatarSlotsVisible, setAvatarSlotsVisible] = useState(false);
  const [musicFadeOutSignal, setMusicFadeOutSignal] = useState(0);
  const [gameEnterHandoff, setGameEnterHandoff] = useState(false);
  const [avatarEnterHandoff, setAvatarEnterHandoff] =
    useState<AvatarEnterHandoffSnapshot | null>(null);
  const [handoffLanded, setHandoffLanded] = useState(false);
  const [deathOverlayAvatar, setDeathOverlayAvatar] = useState<PersistedAvatar | null>(null);
  const [playerGemBalance, setPlayerGemBalance] = useState(0);
  const [partyKickToast, setPartyKickToast] = useState<string | null>(null);
  const deathLeaveDoneRef = useRef(false);
  const [deathCreationHandoff, setDeathCreationHandoff] = useState(false);
  const [avatarSelectionNotice, setAvatarSelectionNotice] = useState<string | null>(null);
  const [playPreparePending, setPlayPreparePending] = useState(false);
  const [achievementToast, setAchievementToast] = useState<AchievementProgressDto | null>(null);
  const [hearthBlessingToast, setHearthBlessingToast] = useState(false);
  const [privateScribeToast, setPrivateScribeToast] = useState<string | null>(null);
  const [achievementsOverlayOpen, setAchievementsOverlayOpen] = useState(false);
  const helpInviteToastRef = useRef<RoomHelpInvitationDto | null>(null);
  const activityJoinToastRef = useRef<ActivityFeedEntryDto | null>(null);
  const [helpInviteToast, setHelpInviteToast] = useState<RoomHelpInvitationDto | null>(null);
  const [activityJoinToast, setActivityJoinToast] = useState<ActivityFeedEntryDto | null>(null);
  helpInviteToastRef.current = helpInviteToast;
  activityJoinToastRef.current = activityJoinToast;
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
  const completeDeathRoomLeave = useCallback(async (presetAvatar: PersistedAvatar) => {
    if (deathLeaveDoneRef.current) {
      return;
    }
    deathLeaveDoneRef.current = true;
    try {
      await leaveEncounterRoom(presetAvatar.id);
    } catch (error) {
      console.error('Failed to leave encounter room after death overlay', error);
    }
    setActiveRoom(null);
  }, []);

  const finalizeDeathWithRoomCleanup = useCallback(async (avatarId: string) => {
    if (!deathLeaveDoneRef.current) {
      deathLeaveDoneRef.current = true;
      try {
        await leaveEncounterRoom(avatarId);
      } catch (error) {
        console.error('Failed to leave encounter room before death finalization', error);
      }
    }

    await finalizeAvatarDeath(avatarId);

    try {
      await leaveAllEncounterRooms();
    } catch (error) {
      console.error('Failed to leave all rooms after death finalization', error);
    }

    setActiveRoom(null);
    setActiveEncounter(null);
  }, []);

  const seenHelpInviteIdsRef = useRef<Set<string>>(new Set());
  const helpInvitesSeededRef = useRef(false);
  const helpInviteAcceptPendingRef = useRef(false);
  const session = loadStoredSession();
  const playerId = session?.playerId ?? '';
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
      } else {
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
      }

      const activity = await fetchRecentActivity();
      const privateToastEntry = findNextPrivateScribeToastEntry(playerId, activity.entries);
      if (privateToastEntry) {
        markPrivateScribeToastShown(playerId, privateToastEntry.eventId);
        setPrivateScribeToast(privateToastEntry.message);
      }

      if (options?.seedBaseline) {
        seedActivityJoinToastsSeen(playerId, activity.entries);
      } else if (!helpInviteToastRef.current && !activityJoinToastRef.current) {
        const roomStartEntry = findNextRoomStartJoinToastEntry(playerId, activity.entries);
        if (roomStartEntry) {
          markActivityJoinToastShown(playerId, roomStartEntry.eventId);
          setActivityJoinToast(roomStartEntry);
        } else {
          const helpEntry = findNextHelpJoinToastEntry(playerId, activity.entries);
          if (helpEntry) {
            markActivityJoinToastShown(playerId, helpEntry.eventId);
            setActivityJoinToast(helpEntry);
          }
        }
      }
    } catch (error) {
      console.error('Achievement unlock check failed', error);
    }
  }, [playerId, screen]);

  useEffect(() => {
    if (!isAchievementWatchScreen(screen)) {
      setAchievementToast(null);
      setHearthBlessingToast(false);
      setPrivateScribeToast(null);
      setActivityJoinToast(null);
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

    void leaveAllRoomsForDashboard(activeAvatar?.id);
  }, [screen, activeAvatar?.id]);

  useEffect(() => {
    if (screen !== 'game' || !activeAvatar) {
      return;
    }

    const handleUnload = () => {
      processRoomAwayKeepalive(activeAvatar.id);
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [screen, activeAvatar]);

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

  const applyPreparedGameEntry = useCallback((
    preparedAvatar: PersistedAvatar,
    preparedRoom: EncounterRoomSnapshotDto,
    options?: { incrementEntryKey?: boolean; hideAvatarSlots?: boolean },
  ) => {
    setActiveAvatar(preparedAvatar);
    setActiveEncounter(preparedRoom.activeEncounter);
    setActiveRoom(preparedRoom);
    setHandoffLanded(false);
    setGameEnterHandoff(true);
    if (options?.incrementEntryKey !== false) {
      setGameEntryKey((current) => current + 1);
    }
    if (options?.hideAvatarSlots !== false) {
      setAvatarSlotsVisible(false);
    }
    setScreen('game');
  }, []);

  const runEnterGameHandoff = useCallback(async (
    avatar: PersistedAvatar,
    room: EncounterRoomSnapshotDto,
    sourceElement?: HTMLElement | null,
    options?: { incrementEntryKey?: boolean; hideAvatarSlots?: boolean },
  ) => {
    const fallbackElement = document.querySelector('[data-dashboard-play-button]') as HTMLElement | null;
    const source = sourceElement ?? fallbackElement ?? document.body;

    setMusicFadeOutSignal((signal) => signal + 1);
    playSfx(LEVEL_UP_SOUND);

    await enterGameWithHandoff({
      avatar,
      room,
      sourceElement: source,
      onEnterHandoffChange: setAvatarEnterHandoff,
      onHandoffLand: () => {
        setHandoffLanded(true);
      },
      onPrepareGame: (preparedAvatar, preparedRoom) => {
        applyPreparedGameEntry(preparedAvatar, preparedRoom, options);
      },
    });
    resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
  }, [applyPreparedGameEntry]);

  const enterGameWithHandoffFromRoom = useCallback(async (
    joinedRoom: EncounterRoomSnapshotDto,
    sourceElement?: HTMLElement | null,
  ) => {
    const localParticipant = joinedRoom.participants.find((participant) => participant.isLocal);
    if (!localParticipant?.avatar) {
      return;
    }

    const avatar = normalizePersistedAvatar(localParticipant.avatar);

    try {
      await runEnterGameHandoff(avatar, joinedRoom, sourceElement);
    } catch (error) {
      console.error('Join handoff failed', error);
      enterGameFromRoom(joinedRoom);
    }
  }, [enterGameFromRoom, runEnterGameHandoff]);

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
    sourceElement?: HTMLElement | null,
  ): Promise<void> => {
    if (helpInviteAcceptPendingRef.current) {
      return;
    }

    helpInviteAcceptPendingRef.current = true;
    setHelpInviteToast(null);

    try {
      if (inviteId) {
        seenHelpInviteIdsRef.current.add(inviteId);
        try {
          const response = await respondHelpInvite(inviteId);
          if (response.room) {
            await enterGameWithHandoffFromRoom(response.room, sourceElement);
          }
          return;
        } catch (error) {
          if (!isApiErrorCode(error, 'INVITE_EXPIRED') && !isApiErrorCode(error, 'INVITE_NOT_FOUND')) {
            throw error;
          }
        }
      }

      const response = await joinFriendRoom(friendPlayerId);
      await enterGameWithHandoffFromRoom(response.room, sourceElement);
    } catch (error) {
      if (isApiErrorCode(error, 'ROOM_FULL')) {
        await showRoomFullPrompt();
        return;
      }
      console.error('Join friend room failed', error);
    } finally {
      helpInviteAcceptPendingRef.current = false;
    }
  }, [enterGameWithHandoffFromRoom, showRoomFullPrompt]);

  const acceptHelpInvite = useCallback(async (
    invite: RoomHelpInvitationDto,
    sourceElement?: HTMLElement | null,
  ) => {
    await joinFriendEncounter(invite.fromPlayerId, invite.inviteId, sourceElement);
  }, [joinFriendEncounter]);

  const handleJoinFriend = useCallback(async (
    friend: FriendSummaryDto,
    sourceElement?: HTMLElement | null,
  ) => {
    if (!friend.joinableRoom) {
      return;
    }

    await joinFriendEncounter(
      friend.playerId,
      friend.joinableRoom.inviteId,
      sourceElement,
    );
  }, [joinFriendEncounter]);

  const handleJoinRoomFromScribes = useCallback(async (
    action: ActivityFeedJoinRoomActionDto,
    sourceElement?: HTMLElement | null,
  ) => {
    await joinFriendEncounter(action.fromPlayerId, action.inviteId, sourceElement);
  }, [joinFriendEncounter]);

  useEffect(() => {
    if (!playerId || !isAchievementWatchScreen(screen)) {
      helpInvitesSeededRef.current = false;
      setHelpInviteToast(null);
      return;
    }

    async function pollHelpInvites(): Promise<void> {
      try {
        const response = await fetchPendingHelpInvitations();
        const now = Date.now();
        const activeInvites = response.invitations.filter(
          (invitation) => invitation.expiresAt > now,
        );

        if (!helpInvitesSeededRef.current) {
          helpInvitesSeededRef.current = true;
          for (const invitation of activeInvites) {
            seenHelpInviteIdsRef.current.add(invitation.inviteId);
          }
          return;
        }

        if (helpInviteToastRef.current || helpInviteAcceptPendingRef.current) {
          return;
        }

        const nextInvite = activeInvites.find(
          (invitation) => !seenHelpInviteIdsRef.current.has(invitation.inviteId),
        );

        if (nextInvite) {
          setActivityJoinToast(null);
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
  }, [playerId, screen]);

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
    const { avatars } = await refreshAvatarSelectionAfterHome();
    setAvatarSelectionAvatars(avatars);
    setAvatarSelectionPrepared(true);
    setAvatarSelectionNotice(null);
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

  const handleKickedFromParty = useCallback(() => {
    setActiveAvatar(null);
    setActiveEncounter(null);
    setActiveRoom(null);
    resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
    setScreen('dashboard');
    setPartyKickToast('The party leader removed you from the room.');
    void (async () => {
      try {
        await leaveAllEncounterRooms();
      } catch (error) {
        console.error('Failed to leave all rooms after kick', error);
      }
      await applyAvatarSelectionFromHome();
    })();
  }, []);

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

  useEffect(() => {
    if (!deathOverlayAvatar || !session?.accessToken) {
      return;
    }

    void fetchPlayer(session)
      .then((player) => {
        setPlayerGemBalance(player.currencies?.yellow_red_gem ?? 0);
      })
      .catch((error) => {
        console.error('Failed to load gem balance for death overlay', error);
      });
  }, [deathOverlayAvatar, session?.accessToken]);

  return (
    <BackgroundProvider>
      <PersistentBackground />
        {avatarEnterHandoff ? (
          <SolutionStarfield fadingOut={avatarEnterHandoff.fading === true} />
        ) : null}
        {avatarEnterHandoff ? <AvatarSolutionInflow avatar={avatarEnterHandoff.avatar} /> : null}
      <MusicEngine
        ambientRace={screen === 'game' ? activeAvatar?.race : null}
        ambientRole={screen === 'game' ? activeAvatar?.role : null}
        fadeOutSignal={musicFadeOutSignal}
        zone={musicZoneForScreen(screen)}
      >
        <PurchaseReturnToast
          onPurchaseSuccess={() => {
            void checkAchievementUnlocks();
          }}
        />
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
            onJoinFriend={(friend, sourceElement) => {
              void handleJoinFriend(friend, sourceElement);
            }}
            onJoinRoomFromScribes={(action, sourceElement) => {
              void handleJoinRoomFromScribes(action, sourceElement);
            }}
            onFailedAvatarSelect={(avatar) => {
              setDeathOverlayAvatar(avatar);
            }}
            onPrepareGame={(avatar, room) => {
              applyPreparedGameEntry(avatar, room, {
                incrementEntryKey: false,
                hideAvatarSlots: false,
              });
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
              setActiveAvatar(null);
              setActiveEncounter(null);
              setActiveRoom(null);
              setAvatarSlotsVisible(false);
              resetEnterHandoffState(setGameEnterHandoff, setHandoffLanded, setAvatarEnterHandoff);
              setScreen('dashboard');
              void (async () => {
                await leaveAllRoomsForDashboard(activeAvatar?.id);
                await applyAvatarSelectionFromHome();
              })();
            }}
            onAchievementCheck={() => {
              void checkAchievementUnlocks();
            }}
            onAvatarDeath={(presetAvatar) => {
              deathLeaveDoneRef.current = false;
              const enriched = enrichDeathOverlayAvatar(presetAvatar);
              setDeathOverlayAvatar(enriched);
              setAvatarSelectionAvatars((currentAvatars) => (
                currentAvatars.map((avatar) => (
                  avatar.id === enriched.id
                    ? { ...avatar, status: 'failed', sacrificeGemCost: enriched.sacrificeGemCost ?? avatar.sacrificeGemCost }
                    : avatar
                ))
              ));
              void fetchAvatars()
                .then((avatars) => {
                  const fresh = avatars.find((avatar) => avatar.id === enriched.id);
                  if (!fresh) {
                    return;
                  }
                  const refreshed = enrichDeathOverlayAvatar(fresh);
                  setDeathOverlayAvatar(refreshed);
                  setAvatarSelectionAvatars((currentAvatars) => (
                    currentAvatars.map((avatar) => (
                      avatar.id === refreshed.id
                        ? { ...avatar, ...refreshed }
                        : avatar
                    ))
                  ));
                })
                .catch((error) => {
                  console.error('Failed to refresh failed avatar for death overlay', error);
                });
            }}
            onKickedFromParty={handleKickedFromParty}
          />
        ) : null}
        {deathOverlayAvatar ? (
          <AvatarDeathOverlay
            avatarName={formatAvatarDisplayName(deathOverlayAvatar)}
            gemBalance={playerGemBalance}
            onHandoffComplete={() => {
              deathLeaveDoneRef.current = false;
              setDeathOverlayAvatar(null);
            }}
            onOptionsVisible={() => {
              const preset = deathOverlayAvatar;
              if (preset) {
                void completeDeathRoomLeave(preset);
              }
            }}
            onSacrifice={async () => {
              const preset = deathOverlayAvatar;
              if (!preset) {
                return;
              }

              try {
                const result = await sacrificeAvatar(preset.id);
                setPlayerGemBalance(result.currencies.yellow_red_gem ?? 0);
                setAvatarSelectionAvatars((currentAvatars) => (
                  currentAvatars.map((avatar) => (
                    avatar.id === preset.id ? result.avatar : avatar
                  ))
                ));
                setDeathOverlayAvatar(null);

                const { avatar: selectedAvatar } = await selectAvatar(result.avatar);
                const room = result.room ?? await ensureSoloLeaderRoom(selectedAvatar.id);
                await runEnterGameHandoff(selectedAvatar, room, document.body);
              } catch (error) {
                console.error('Sacrifice failed', error);
                setAvatarSelectionNotice(userFacingApiErrorMessage(error, 'Sacrifice failed. Try again.'));
              }
            }}
            onNewAvatar={async () => {
              const preset = deathOverlayAvatar;
              if (!preset) {
                return;
              }

              await finalizeDeathWithRoomCleanup(preset.id);

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

              await finalizeDeathWithRoomCleanup(preset.id);

              let avatars: PersistedAvatar[];

              try {
                const refresh = await refreshAvatarSelectionAfterHome();
                avatars = refresh.avatars;
                setAvatarSelectionAvatars(avatars);
                setAvatarSelectionPrepared(true);
                setAvatarSelectionNotice(null);
              } catch (error) {
                console.error('Death overlay same soul prepare failed', error);
                setAvatarSelectionPrepared(false);
                setAvatarSelectionNotice('Could not refresh avatars. Try again.');
                throw error;
              }

              const slotIndex = resolveCreationSlotIndex(avatars);

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
            sacrificeGemCost={deathOverlayAvatar.sacrificeGemCost ?? 0}
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
            label="Join"
            message={`${helpInviteToast.fromAvatarName ?? helpInviteToast.fromPlayerName} calls out for help.`}
            onClick={() => {
              void acceptHelpInvite(helpInviteToast);
            }}
            onDismiss={() => {
              dismissHelpInviteToast(helpInviteToast);
            }}
            stackOffsetPx={achievementToast || hearthBlessingToast ? 78 : 0}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && activityJoinToast?.joinAction ? (
          <GameMessageToast
            label="Join"
            message={activityJoinToast.message}
            onClick={() => {
              void handleJoinRoomFromScribes(activityJoinToast.joinAction!);
              markActivityJoinToastShown(playerId, activityJoinToast.eventId);
              setActivityJoinToast(null);
            }}
            onDismiss={() => {
              markActivityJoinToastShown(playerId, activityJoinToast.eventId);
              setActivityJoinToast(null);
            }}
            stackOffsetPx={
              achievementToast || hearthBlessingToast || helpInviteToast
                ? 78
                : 0
            }
          />
        ) : null}
        {partyKickToast ? (
          <GameMessageToast
            message={partyKickToast}
            onDismiss={() => {
              setPartyKickToast(null);
            }}
          />
        ) : null}
        {isAchievementWatchScreen(screen) && privateScribeToast ? (
          <GameMessageToast
            label="Scribes"
            message={privateScribeToast}
            onDismiss={() => {
              setPrivateScribeToast(null);
            }}
            stackOffsetPx={
              achievementToast
              || hearthBlessingToast
              || helpInviteToast
              || activityJoinToast
                ? 78
                : 0
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
