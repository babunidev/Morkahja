import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AvatarRace, AvatarRole } from '@shared/contracts';
import {
  ambientPlaylistForAvatar,
  DEFAULT_AMBIENT_TRACKS,
} from './ambientTracks.js';
import {
  MUSIC_ENABLED_STORAGE_KEY,
  MUSIC_VOLUME_STORAGE_KEY,
  playbackVolume,
  storedMusicEnabled,
  storedMusicVolume,
} from '../audioVolume.js';
const MORKAHJA_MAIN_TRACKS = [
  '/UI/Music/Morkahja_main_full_intro.mp3',
  '/UI/Music/Morkahja_main_intro.mp3',
  '/UI/Music/Morkahja_main_track.mp3',
];
const DASHBOARD_MUSIC_DELAY_MS = 3000;
const MUSIC_FADE_MS = 420;
const MUSIC_MENU_EXIT_FADE_MS = 1400;
const MUSIC_TOGGLE_OFF_FADE_MS = 1400;
const MENU_LOOP_BREAK_MIN_MS = 6000;
const MENU_LOOP_BREAK_MAX_MS = 14000;

export type MusicZone = 'silent' | 'menu' | 'ambient';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

type MusicContextValue = {
  enabled: boolean;
  setVolume: (volume: number) => void;
  volume: number;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export function useMusic(): MusicContextValue {
  const music = useContext(MusicContext);

  if (!music) {
    throw new Error('useMusic must be used within MusicEngine');
  }

  return music;
}

export function MusicEngine({
  ambientRace,
  ambientRole,
  children,
  fadeOutSignal,
  zone,
}: {
  ambientRace?: AvatarRace | null;
  ambientRole?: AvatarRole | null;
  children: ReactNode;
  fadeOutSignal: number;
  zone: MusicZone;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<string | null>(null);
  const enabledRef = useRef(storedMusicEnabled());
  const fadeRunRef = useRef(0);
  const lastAmbientTrackRef = useRef<string | null>(null);
  const ambientTracksRef = useRef<string[]>(DEFAULT_AMBIENT_TRACKS);
  const lastMenuTrackRef = useRef<string | null>(null);
  const blockedUntilInactiveRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);
  const volumeRef = useRef(storedMusicVolume());
  const zoneRef = useRef<MusicZone>(zone);
  const audioUnlockedRef = useRef(false);
  const pendingPlaybackRef = useRef(false);
  const menuExitFadeRef = useRef<Promise<void> | null>(null);
  const [enabled, setEnabled] = useState(storedMusicEnabled);
  const [volume, setVolume] = useState(storedMusicVolume);
  useEffect(() => {
    const audio = new Audio(MORKAHJA_MAIN_TRACKS[0]);
    audio.loop = false;
    audio.volume = 0;
    const handleEnded = () => {
      if (zoneRef.current === 'silent' || !enabledRef.current || blockedUntilInactiveRef.current) {
        return;
      }

      schedulePlayback(randomLoopBreak());
    };
    const handleError = () => {
      if (zoneRef.current === 'silent' || !enabledRef.current || blockedUntilInactiveRef.current) {
        return;
      }

      schedulePlayback(randomLoopBreak());
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audioRef.current = audio;

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audioRef.current = null;
      clearRestartTimer();
    };
  }, []);

  useEffect(() => {
    zoneRef.current = zone;
  }, [zone]);

  const ambientProfileKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const nextProfileKey =
      ambientRace && ambientRole ? `${ambientRace}:${ambientRole}` : null;
    const previousProfileKey = ambientProfileKeyRef.current;
    ambientProfileKeyRef.current = nextProfileKey;
    ambientTracksRef.current = ambientPlaylistForAvatar(ambientRace, ambientRole);
    lastAmbientTrackRef.current = null;

    const profileChanged =
      previousProfileKey !== null &&
      nextProfileKey !== null &&
      previousProfileKey !== nextProfileKey;

    if (
      !profileChanged ||
      zoneRef.current !== 'ambient' ||
      !enabledRef.current ||
      blockedUntilInactiveRef.current
    ) {
      return;
    }

    clearRestartTimer();
    currentTrackRef.current = null;

    void (async () => {
      await fadeTo(0, MUSIC_FADE_MS);
      audioRef.current?.pause();

      if (zoneRef.current !== 'ambient' || !enabledRef.current || blockedUntilInactiveRef.current) {
        return;
      }

      schedulePlayback(0);
    })();
  }, [ambientRace, ambientRole]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    function unlockAudioFromInteraction(): void {
      if (audioUnlockedRef.current) {
        return;
      }

      void resumePendingPlayback();
    }

    window.addEventListener('pointerdown', unlockAudioFromInteraction);
    window.addEventListener('keydown', unlockAudioFromInteraction);

    return () => {
      window.removeEventListener('pointerdown', unlockAudioFromInteraction);
      window.removeEventListener('keydown', unlockAudioFromInteraction);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MUSIC_ENABLED_STORAGE_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    volumeRef.current = volume;
    window.localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(volume));
    if (audioRef.current && enabled) {
      audioRef.current.volume = playbackVolume(volume);
    }
  }, [enabled, volume]);

  async function fadeOutMenuMusic(durationMs = MUSIC_MENU_EXIT_FADE_MS): Promise<void> {
    blockedUntilInactiveRef.current = true;
    clearRestartTimer();
    pendingPlaybackRef.current = false;

    const exitFade = fadeTo(0, durationMs).then(() => {
      audioRef.current?.pause();
    });

    menuExitFadeRef.current = exitFade;

    try {
      await exitFade;
    } finally {
      if (menuExitFadeRef.current === exitFade) {
        menuExitFadeRef.current = null;
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    const previousZone = zoneRef.current;
    zoneRef.current = zone;
    clearRestartTimer();

    if (zone === 'silent' || !enabled) {
      blockedUntilInactiveRef.current = false;
      pendingPlaybackRef.current = false;
      void fadeTo(0, MUSIC_FADE_MS).then(() => audioRef.current?.pause());
      return () => {
        cancelled = true;
      };
    }

    async function transitionZone(): Promise<void> {
      const leavingMenu = previousZone === 'menu' && zone !== 'menu';

      if (zone === 'menu') {
        blockedUntilInactiveRef.current = false;
      }

      if (leavingMenu) {
        if (menuExitFadeRef.current) {
          await menuExitFadeRef.current;
        } else {
          await fadeOutMenuMusic();
        }
      } else {
        await fadeTo(0, MUSIC_FADE_MS);
        audioRef.current?.pause();
      }

      if (cancelled || zoneRef.current !== zone || !enabledRef.current) {
        return;
      }

      blockedUntilInactiveRef.current = false;
      schedulePlayback(zone === 'menu' ? DASHBOARD_MUSIC_DELAY_MS : 0);
    }

    void transitionZone();

    return () => {
      cancelled = true;
    };
  }, [zone, enabled]);

  useEffect(() => {
    if (fadeOutSignal === 0) {
      return;
    }

    void fadeOutMenuMusic();
  }, [fadeOutSignal]);

  function randomLoopBreak(): number {
    return Math.floor(
      MENU_LOOP_BREAK_MIN_MS + Math.random() * (MENU_LOOP_BREAK_MAX_MS - MENU_LOOP_BREAK_MIN_MS + 1),
    );
  }

  function randomTrackFromPool(
    tracks: string[],
    lastTrackRef: { current: string | null },
  ): string {
    if (tracks.length === 0) {
      return '';
    }

    if (tracks.length === 1) {
      return tracks[0] ?? '';
    }

    const availableTracks = tracks.filter((track) => track !== lastTrackRef.current);
    const selectedTrack =
      availableTracks[Math.floor(Math.random() * availableTracks.length)] ?? tracks[0] ?? '';
    lastTrackRef.current = selectedTrack;
    return selectedTrack;
  }

  function randomMenuTrack(): string {
    return randomTrackFromPool(MORKAHJA_MAIN_TRACKS, lastMenuTrackRef);
  }

  function randomAmbientTrack(): string {
    return randomTrackFromPool(ambientTracksRef.current, lastAmbientTrackRef);
  }

  function trackForZone(currentZone: MusicZone): string | null {
    if (currentZone === 'menu') {
      return randomMenuTrack();
    }

    if (currentZone === 'ambient') {
      return randomAmbientTrack();
    }

    return null;
  }

  function clearRestartTimer(): void {
    if (restartTimerRef.current === null) {
      return;
    }

    window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }

  async function startPlayback(): Promise<boolean> {
    const audio = audioRef.current;
    const currentZone = zoneRef.current;
    const track = trackForZone(currentZone);

    if (!audio || !track || !enabledRef.current || blockedUntilInactiveRef.current) {
      return false;
    }

    if (currentTrackRef.current !== track) {
      audio.src = track;
      currentTrackRef.current = track;
    }

    audio.currentTime = 0;
    audio.volume = playbackVolume(volumeRef.current);

    try {
      await audio.play();
      audioUnlockedRef.current = true;
      pendingPlaybackRef.current = false;
      return true;
    } catch {
      pendingPlaybackRef.current = true;
      return false;
    }
  }

  async function resumePendingPlayback(): Promise<void> {
    if (!pendingPlaybackRef.current || !enabledRef.current || zoneRef.current === 'silent') {
      return;
    }

    await startPlayback();
  }

  function schedulePlayback(delayMs: number): void {
    clearRestartTimer();
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      void startPlayback();
    }, delayMs);
  }

  async function ensureAudioPlaying(): Promise<boolean> {
    const audio = audioRef.current;

    if (!audio) {
      return false;
    }

    try {
      await audio.play();
      audioUnlockedRef.current = true;
      pendingPlaybackRef.current = false;
      return true;
    } catch {
      pendingPlaybackRef.current = true;
      return false;
    }
  }

  async function fadeTo(targetVolume: number, durationMs = MUSIC_FADE_MS): Promise<void> {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const run = fadeRunRef.current + 1;
    fadeRunRef.current = run;

    if (targetVolume > 0) {
      await ensureAudioPlaying();
    }

    const start = audio.volume;
    const startedAt = performance.now();

    while (fadeRunRef.current === run) {
      const progress = Math.min((performance.now() - startedAt) / durationMs, 1);
      audio.volume = start + (targetVolume - start) * progress;

      if (progress >= 1) {
        break;
      }

      await wait(16);
    }
  }

  function applyVolume(nextVolume: number): void {
    const clamped = Math.max(0, Math.min(nextVolume, 1));

    if (clamped === 0) {
      if (!enabledRef.current) {
        setVolume(0);
        return;
      }

      clearRestartTimer();
      pendingPlaybackRef.current = false;
      void fadeTo(0, MUSIC_TOGGLE_OFF_FADE_MS).then(() => {
        audioRef.current?.pause();
        setEnabled(false);
        setVolume(0);
      });
      return;
    }

    const wasDisabled = !enabledRef.current;
    setVolume(clamped);

    if (wasDisabled) {
      setEnabled(true);
      enabledRef.current = true;
      blockedUntilInactiveRef.current = false;
    }

    if (zoneRef.current === 'silent' || !audioRef.current) {
      return;
    }

    if (wasDisabled) {
      clearRestartTimer();
      const track = trackForZone(zoneRef.current);
      if (track && currentTrackRef.current !== track) {
        audioRef.current.src = track;
        currentTrackRef.current = track;
      }
      audioRef.current.currentTime = 0;
    }

    audioRef.current.volume = playbackVolume(clamped);
    void startPlayback();
  }

  return (
    <MusicContext.Provider
      value={{
        enabled,
        setVolume: applyVolume,
        volume,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export default MusicEngine;
