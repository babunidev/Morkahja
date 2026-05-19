import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

const MENU_TRACK = '/UI/Music/menu/menu_full_intro.mp3';
const AMBIENT_TRACKS = 'abcdefghijklmnopqrstuvwxyz'
  .split('')
  .map((suffix) => `/UI/Music/menu/menu_ambient_${suffix}.mp3`);
const MUSIC_CONTROL = '/UI/06_SettingsMenu/im_music.webp';
const MUSIC_ENABLED_STORAGE_KEY = 'morkahja.music.enabled';
const MUSIC_VOLUME_STORAGE_KEY = 'morkahja.music.volume';
const DASHBOARD_MUSIC_DELAY_MS = 3000;
const MUSIC_FADE_MS = 420;
const MUSIC_TOGGLE_OFF_FADE_MS = 1400;
const MUSIC_CONTROL_HOLD_MS = 1000;
const MUSIC_CONTROL_PRESS_MS = 240;
const MENU_LOOP_BREAK_MIN_MS = 6000;
const MENU_LOOP_BREAK_MAX_MS = 14000;

export type MusicZone = 'silent' | 'menu' | 'ambient';

const controlButtonStyle: CSSProperties = {
  position: 'relative',
  width: 'min(17vw, 86px)',
  padding: 0,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  touchAction: 'none',
  userSelect: 'none',
};

const controlImageStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: 'auto',
  filter: 'drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5))',
};

const sliderTrackStyle: CSSProperties = {
  position: 'absolute',
  left: '10%',
  right: '10%',
  bottom: '6%',
  height: 7,
  border: '1px solid rgba(255, 204, 102, 0.68)',
  borderRadius: 999,
  background: 'rgba(17, 7, 4, 0.75)',
  overflow: 'hidden',
  opacity: 0,
  transition: 'opacity 180ms ease',
  pointerEvents: 'none',
};

const sliderFillStyle: CSSProperties = {
  height: '100%',
  borderRadius: 999,
  background: 'linear-gradient(90deg, #330000 0%, #ffcc66 100%)',
};

function storedEnabled(): boolean {
  return window.localStorage.getItem(MUSIC_ENABLED_STORAGE_KEY) !== 'false';
}

function storedVolume(): number {
  const parsed = Number(window.localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY));
  return Number.isFinite(parsed) ? Math.max(0, Math.min(parsed, 1)) : 0.58;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function playbackVolume(volume: number): number {
  return volume * volume;
}

type MusicContextValue = {
  enabled: boolean;
  volume: number;
  revealControl: boolean;
  setVolumeFromPointer: (clientX: number, target: HTMLElement) => void;
  toggleEnabled: () => void;
  showControl: () => void;
  hideControl: () => void;
};

const MusicContext = createContext<MusicContextValue | null>(null);

export function MusicEngine({
  children,
  fadeOutSignal,
  zone,
}: {
  children: ReactNode;
  fadeOutSignal: number;
  zone: MusicZone;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentTrackRef = useRef<string | null>(null);
  const enabledRef = useRef(false);
  const fadeRunRef = useRef(0);
  const lastAmbientTrackRef = useRef<string | null>(null);
  const blockedUntilInactiveRef = useRef(false);
  const hideControlTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const volumeRef = useRef(0);
  const zoneRef = useRef<MusicZone>(zone);
  const [enabled, setEnabled] = useState(storedEnabled);
  const [volume, setVolume] = useState(storedVolume);
  const [revealControl, setRevealControl] = useState(false);

  useEffect(() => {
    const audio = new Audio(MENU_TRACK);
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
      if (hideControlTimerRef.current !== null) {
        window.clearTimeout(hideControlTimerRef.current);
      }
      clearRestartTimer();
    };
  }, []);

  useEffect(() => {
    zoneRef.current = zone;
  }, [zone]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

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

  useEffect(() => {
    let cancelled = false;
    zoneRef.current = zone;
    blockedUntilInactiveRef.current = false;
    clearRestartTimer();

    if (zone === 'silent' || !enabledRef.current) {
      void fadeTo(0).then(() => audioRef.current?.pause());
      return () => {
        cancelled = true;
      };
    }

    async function transitionZone(): Promise<void> {
      await fadeTo(0);

      if (cancelled || zoneRef.current !== zone || !enabledRef.current) {
        return;
      }

      audioRef.current?.pause();
      schedulePlayback(zone === 'menu' ? DASHBOARD_MUSIC_DELAY_MS : 0);
    }

    void transitionZone();

    return () => {
      cancelled = true;
    };
  }, [zone]);

  useEffect(() => {
    if (fadeOutSignal === 0) {
      return;
    }

    blockedUntilInactiveRef.current = true;
    clearRestartTimer();
    void fadeTo(0).then(() => {
      audioRef.current?.pause();
    });
  }, [fadeOutSignal]);

  function randomLoopBreak(): number {
    return Math.floor(
      MENU_LOOP_BREAK_MIN_MS + Math.random() * (MENU_LOOP_BREAK_MAX_MS - MENU_LOOP_BREAK_MIN_MS + 1),
    );
  }

  function randomAmbientTrack(): string {
    if (AMBIENT_TRACKS.length === 1) {
      return AMBIENT_TRACKS[0] ?? MENU_TRACK;
    }

    const availableTracks = AMBIENT_TRACKS.filter((track) => track !== lastAmbientTrackRef.current);
    const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)] ?? AMBIENT_TRACKS[0] ?? MENU_TRACK;
    lastAmbientTrackRef.current = selectedTrack;
    return selectedTrack;
  }

  function trackForZone(currentZone: MusicZone): string | null {
    if (currentZone === 'menu') {
      return MENU_TRACK;
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

  function schedulePlayback(delayMs: number): void {
    clearRestartTimer();
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      const audio = audioRef.current;
      const currentZone = zoneRef.current;
      const track = trackForZone(currentZone);

      if (!audio || !track || !enabledRef.current || blockedUntilInactiveRef.current) {
        return;
      }

      if (currentTrackRef.current !== track) {
        audio.src = track;
        currentTrackRef.current = track;
      }

      audio.currentTime = 0;
      audio.volume = playbackVolume(volumeRef.current);
      void audio.play().catch(() => undefined);
    }, delayMs);
  }

  async function fadeTo(targetVolume: number, durationMs = MUSIC_FADE_MS): Promise<void> {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const run = fadeRunRef.current + 1;
    fadeRunRef.current = run;

    if (targetVolume > 0) {
      void audio.play().catch(() => undefined);
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

  function updateVolumeFromPointer(clientX: number, target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const nextVolume = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    const wasDisabled = !enabled;
    setVolume(nextVolume);
    if (wasDisabled) {
      setEnabled(true);
    }
    if (zoneRef.current !== 'silent' && audioRef.current) {
      if (wasDisabled) {
        clearRestartTimer();
        const track = trackForZone(zoneRef.current);
        if (track && currentTrackRef.current !== track) {
          audioRef.current.src = track;
          currentTrackRef.current = track;
        }
        audioRef.current.currentTime = 0;
      }
      audioRef.current.volume = playbackVolume(nextVolume);
      if (nextVolume > 0) {
        void audioRef.current.play().catch(() => undefined);
      }
    }
  }

  function toggleEnabled(): void {
    if (enabled) {
      clearRestartTimer();
      void fadeTo(0, MUSIC_TOGGLE_OFF_FADE_MS).then(() => {
        audioRef.current?.pause();
        setEnabled(false);
      });
      return;
    }

    setEnabled(true);
    enabledRef.current = true;
    blockedUntilInactiveRef.current = false;
    if (zoneRef.current !== 'silent') {
      clearRestartTimer();
      if (audioRef.current) {
        const track = trackForZone(zoneRef.current);
        if (track && currentTrackRef.current !== track) {
          audioRef.current.src = track;
          currentTrackRef.current = track;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.volume = playbackVolume(volume);
        void audioRef.current.play().catch(() => undefined);
      }
    }
  }

  function showControl(): void {
    if (hideControlTimerRef.current !== null) {
      window.clearTimeout(hideControlTimerRef.current);
      hideControlTimerRef.current = null;
    }
    setRevealControl(true);
  }

  return (
    <MusicContext.Provider
      value={{
        enabled,
        hideControl: () => {
          hideControlTimerRef.current = window.setTimeout(() => {
            setRevealControl(false);
          }, 1200);
        },
        revealControl,
        setVolumeFromPointer: updateVolumeFromPointer,
        showControl,
        toggleEnabled,
        volume,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

export function MusicControl({ style }: { style?: CSSProperties }) {
  const music = useContext(MusicContext);
  const draggedRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const volumeUnlockedRef = useRef(false);
  const [pressed, setPressed] = useState(false);

  if (!music) {
    return null;
  }

  const vibration = music.enabled && music.volume > 0 ? music.volume : 0;

  function clearHoldTimer(): void {
    if (holdTimerRef.current === null) {
      return;
    }

    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }

  function pulseControl(): void {
    setPressed(true);
    window.setTimeout(() => {
      setPressed(false);
    }, MUSIC_CONTROL_PRESS_MS);
  }

  return (
      <button
        aria-pressed={music.enabled}
        aria-label={music.enabled ? 'Turn music off' : 'Turn music on'}
        onPointerDown={(event) => {
          pulseControl();
          draggedRef.current = false;
          volumeUnlockedRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
          clearHoldTimer();
          holdTimerRef.current = window.setTimeout(() => {
            volumeUnlockedRef.current = true;
            music.showControl();
          }, MUSIC_CONTROL_HOLD_MS);
        }}
        onPointerMove={(event) => {
          if (event.buttons !== 1 || !volumeUnlockedRef.current) {
            return;
          }
          draggedRef.current = true;
          music.setVolumeFromPointer(event.clientX, event.currentTarget);
        }}
        onPointerUp={(event) => {
          clearHoldTimer();
          if (!volumeUnlockedRef.current) {
            music.toggleEnabled();
          } else if (draggedRef.current) {
            music.setVolumeFromPointer(event.clientX, event.currentTarget);
          }
          music.hideControl();
        }}
        onPointerCancel={() => {
          clearHoldTimer();
          music.hideControl();
        }}
        style={{
          ...controlButtonStyle,
          ...style,
          '--morkahja-music-pulse': String(1 + vibration * 0.025),
          '--morkahja-music-shake': `${0.12 + vibration * 0.9}px`,
        } as CSSProperties}
        type="button"
      >
        <span
          style={{
            display: 'block',
            animation:
              pressed
                ? `morkahja-nav-button-press ${MUSIC_CONTROL_PRESS_MS}ms ease-out`
                : undefined,
          }}
        >
          <img
            alt=""
            aria-hidden="true"
            draggable={false}
            src={MUSIC_CONTROL}
            style={{
              ...controlImageStyle,
              animation:
                vibration > 0
                  ? `morkahja-speaker-vibrate ${Math.max(180, 420 - vibration * 170)}ms ease-in-out infinite`
                  : undefined,
              opacity: music.enabled ? 1 : 0.42,
            }}
          />
        </span>
      <div
        aria-label="Music volume"
        role="slider"
        style={{ ...sliderTrackStyle, opacity: music.revealControl ? 1 : 0 }}
      >
        <div style={{ ...sliderFillStyle, width: `${Math.round(music.volume * 100)}%` }} />
      </div>
    </button>
  );
}

export default MusicEngine;
