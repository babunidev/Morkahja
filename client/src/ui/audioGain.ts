/**
 * Volume that works on iPhone and iPad (Babuni, 2026-11-17).
 *
 * iOS ignores `HTMLMediaElement.volume`: setting it reads back 1, so every fade
 * and volume slider in the game did nothing there and pieces started and
 * stopped at full volume. Where that is the case, each audio element is sent
 * through a Web Audio gain node instead, and the element's own `volume`
 * property is replaced by one that reads and writes that gain. The music,
 * ambiance and sound-effect code keeps using `audio.volume` unchanged.
 *
 * Browsers whose element volume works keep plain elements. For testing on
 * a desktop, `localStorage['morkahja.audio.webAudioGain']` set to '1' forces
 * the gain route and '0' turns it off.
 */

const FORCE_KEY = 'morkahja.audio.webAudioGain';

type AudioContextConstructor = typeof AudioContext;

let useGain: boolean | undefined;
let audioContext: AudioContext | null | undefined;
const routes = new WeakMap<HTMLMediaElement, { source: MediaElementAudioSourceNode; gain: GainNode }>();

function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** True when this browser ignores an audio element's volume (iOS). */
export function elementVolumeIsFixed(): boolean {
  try {
    const probe = document.createElement('audio');
    probe.volume = 0.5;
    return Math.abs(probe.volume - 0.5) > 0.01;
  } catch {
    return false;
  }
}

function gainRouteWanted(): boolean {
  if (useGain !== undefined) {
    return useGain;
  }
  let forced: string | null = null;
  try {
    forced = window.localStorage.getItem(FORCE_KEY);
  } catch {
    forced = null;
  }
  useGain = forced === '1' ? true : forced === '0' ? false : elementVolumeIsFixed();
  return useGain;
}

function resumeAudio(): void {
  if (audioContext && audioContext.state !== 'running') {
    void audioContext.resume().catch(() => undefined);
  }
}

function sharedContext(): AudioContext | null {
  if (audioContext !== undefined) {
    return audioContext;
  }
  const Constructor = (window.AudioContext
    ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext) as
    AudioContextConstructor | undefined;
  if (!Constructor) {
    audioContext = null;
    return null;
  }
  try {
    audioContext = new Constructor();
  } catch {
    audioContext = null;
    return null;
  }
  // Keep playing with the ring/silent switch off, as the plain elements did.
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      session.type = 'playback';
    }
  } catch {
    // Older Safari has no audioSession.
  }
  // iOS only starts (and restarts, after a call or the app returning) audio inside a tap.
  for (const type of ['pointerdown', 'touchend', 'keydown'] as const) {
    window.addEventListener(type, resumeAudio, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', resumeAudio);
  return audioContext;
}

/**
 * Returns `audio`, routed through a gain node when this browser needs it.
 * Call once per element, right after creating it.
 */
export function withWorkingVolume<T extends HTMLMediaElement>(audio: T): T {
  if (!gainRouteWanted() || routes.has(audio)) {
    return audio;
  }
  const context = sharedContext();
  if (!context) {
    return audio;
  }
  try {
    const source = context.createMediaElementSource(audio);
    const gain = context.createGain();
    const native = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    const wanted = clampVolume(audio.volume);
    native?.set?.call(audio, 1);
    gain.gain.value = wanted;
    source.connect(gain);
    gain.connect(context.destination);
    routes.set(audio, { source, gain });
    Object.defineProperty(audio, 'volume', {
      configurable: true,
      get: () => gain.gain.value,
      set: (value: number) => {
        gain.gain.value = clampVolume(value);
      },
    });
    resumeAudio();
  } catch {
    // Without the route the element still plays, only without fades.
  }
  return audio;
}

/** Disconnects a short-lived element (a sound effect) once it is finished. */
export function releaseWorkingVolume(audio: HTMLMediaElement): void {
  const route = routes.get(audio);
  if (!route) {
    return;
  }
  routes.delete(audio);
  try {
    route.source.disconnect();
    route.gain.disconnect();
  } catch {
    // Already disconnected.
  }
}
