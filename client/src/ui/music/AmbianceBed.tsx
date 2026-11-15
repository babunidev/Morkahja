import { useEffect, useRef } from 'react';
import { assetUrl } from '../../assetUrl.js';
import { playbackVolume } from '../audioVolume.js';
import { AMBIANCE_CLIPS } from './ambianceCatalog.js';
import {
  AMBIANCE_FADE_IN_MS,
  AMBIANCE_FADE_OUT_MS,
  openingRun,
  pickPiece,
  stepAfterPiece,
  type AmbianceRun,
  type AmbianceStage,
} from './ambianceCycle.js';
import { ambiancePackForExpansion, expansionHasClips, stagePool } from './ambianceLibrary.js';
import type { MusicZone } from './MusicEngine.js';

interface Voice {
  audio: HTMLAudioElement;
  fade: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitMs(ms: number, alive: () => boolean): Promise<void> {
  const started = performance.now();
  while (alive() && performance.now() - started < ms) {
    await wait(Math.min(50, ms - (performance.now() - started)));
  }
}

function waitForGesture(alive: () => boolean): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (unlocked: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
      resolve(unlocked);
    };
    const onGesture = () => finish(alive());
    const timer = window.setInterval(() => {
      if (!alive()) {
        finish(false);
      }
    }, 50);
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
  });
}

async function startVoice(
  voice: Voice,
  url: string,
  initialVolume: number,
  alive: () => boolean,
): Promise<boolean> {
  const audio = voice.audio;
  audio.src = assetUrl(url);
  audio.currentTime = 0;
  audio.volume = initialVolume;
  while (alive()) {
    try {
      await audio.play();
      return true;
    } catch {
      const unlocked = await waitForGesture(alive);
      if (!unlocked) {
        return false;
      }
    }
  }
  return false;
}

async function ramp(
  voice: Voice,
  toward: 'full' | 'silent',
  durationMs: number,
  gain: () => number,
  alive: () => boolean,
  scripted: { current: number },
): Promise<void> {
  const token = voice.fade + 1;
  voice.fade = token;
  scripted.current += 1;
  const audio = voice.audio;
  const from = audio.volume;
  const started = performance.now();
  try {
    if (durationMs <= 0) {
      audio.volume = toward === 'silent' ? 0 : gain();
      return;
    }
    while (alive() && voice.fade === token) {
      const progress = Math.min((performance.now() - started) / durationMs, 1);
      const destination = toward === 'silent' ? 0 : gain();
      audio.volume = from + (destination - from) * progress;
      if (progress >= 1) {
        break;
      }
      await wait(16);
    }
  } finally {
    scripted.current = Math.max(0, scripted.current - 1);
  }
}

async function waitUntil(done: () => boolean, alive: () => boolean): Promise<void> {
  while (alive() && !done()) {
    await wait(30);
  }
}

function edgeMs(audio: HTMLAudioElement): { fadeInMs: number; fadeOutMs: number } {
  const durationMs = Number.isFinite(audio.duration) && audio.duration > 0
    ? audio.duration * 1000
    : AMBIANCE_FADE_IN_MS + AMBIANCE_FADE_OUT_MS;
  const full = AMBIANCE_FADE_IN_MS + AMBIANCE_FADE_OUT_MS;
  if (durationMs >= full) {
    return { fadeInMs: AMBIANCE_FADE_IN_MS, fadeOutMs: AMBIANCE_FADE_OUT_MS };
  }
  return {
    fadeInMs: (durationMs * AMBIANCE_FADE_IN_MS) / full,
    fadeOutMs: (durationMs * AMBIANCE_FADE_OUT_MS) / full,
  };
}

function reachedFadeOut(audio: HTMLAudioElement): boolean {
  return Number.isFinite(audio.duration)
    && (audio.duration - audio.currentTime) * 1000 <= edgeMs(audio).fadeOutMs + 40;
}

/**
 * The encounter bed. It keeps running while the expansion stays the same,
 * and fades to the new land's stage A only when a loaded encounter belongs
 * to a different expansion.
 */
export function AmbianceBed({
  enabled,
  expansion,
  volume,
  zone,
}: {
  enabled: boolean;
  expansion: number | null;
  volume: number;
  zone: MusicZone;
}) {
  const voicesRef = useRef<Voice[] | null>(null);
  const runIdRef = useRef(0);
  const scriptedRef = useRef(0);
  const volumeRef = useRef(volume);
  const enabledRef = useRef(enabled);
  volumeRef.current = volume;
  enabledRef.current = enabled;

  function gain(): number {
    return enabledRef.current ? playbackVolume(volumeRef.current) : 0;
  }

  function voices(): Voice[] {
    if (!voicesRef.current) {
      voicesRef.current = [0, 1].map(() => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = 0;
        return { audio, fade: 0 };
      });
    }
    return voicesRef.current;
  }

  useEffect(() => {
    const playing = voicesRef.current;
    if (!playing || scriptedRef.current > 0) {
      return;
    }
    const next = enabled ? playbackVolume(volume) : 0;
    for (const voice of playing) {
      if (!voice.audio.paused) {
        voice.audio.volume = next;
      }
    }
  }, [enabled, volume]);

  useEffect(() => {
    const id = runIdRef.current + 1;
    runIdRef.current = id;
    const alive = () => runIdRef.current === id;
    const bedVoices = voices();
    const land = expansion == null ? null : ambiancePackForExpansion(expansion);
    const shouldPlay = zone === 'ambient'
      && enabled
      && land != null
      && expansionHasClips(AMBIANCE_CLIPS, land);

    async function fadeOutBed(): Promise<void> {
      await Promise.all(bedVoices.map(async (voice) => {
        if (voice.audio.paused) {
          voice.audio.volume = 0;
          return;
        }
        await ramp(voice, 'silent', AMBIANCE_FADE_OUT_MS, gain, alive, scriptedRef);
        voice.audio.pause();
      }));
    }

    async function runBed(land: number): Promise<void> {
      let voiceIndex = 0;
      let current = bedVoices[0]!;
      let run: AmbianceRun = openingRun();
      const lastByStage: Record<AmbianceStage, string | null> = {
        A: null,
        B: null,
        C: null,
        D: null,
      };
      let queued: string | null = null;

      while (alive()) {
        const pool = stagePool(AMBIANCE_CLIPS, land, run.stage);
        if (pool.length === 0) {
          await ramp(current, 'silent', AMBIANCE_FADE_OUT_MS, gain, alive, scriptedRef);
          current.audio.pause();
          return;
        }

        const alreadyPlaying = queued != null;
        const file = queued ?? pickPiece(pool, lastByStage[run.stage]);
        queued = null;
        if (!alreadyPlaying) {
          lastByStage[run.stage] = file;
          const started = await startVoice(current, file, 0, alive);
          if (!started || !alive()) {
            return;
          }
          await ramp(current, 'full', edgeMs(current.audio).fadeInMs, gain, alive, scriptedRef);
        }
        if (!alive()) {
          return;
        }

        const step = stepAfterPiece(run);
        if (step.gap === 'crossfade') {
          const nextPool = stagePool(AMBIANCE_CLIPS, land, step.next.stage);
          if (nextPool.length === 0) {
            await ramp(current, 'silent', AMBIANCE_FADE_OUT_MS, gain, alive, scriptedRef);
            current.audio.pause();
            return;
          }
          const nextFile = pickPiece(nextPool, lastByStage[step.next.stage]);
          lastByStage[step.next.stage] = nextFile;
          await waitUntil(() => current.audio.ended || current.audio.error != null || reachedFadeOut(current.audio), alive);
          if (!alive()) {
            return;
          }
          const fadeOutMs = edgeMs(current.audio).fadeOutMs;
          const fadeInMs = Math.min(AMBIANCE_FADE_IN_MS, fadeOutMs);
          const fadingOut = ramp(current, 'silent', fadeOutMs, gain, alive, scriptedRef);
          await waitMs(Math.max(0, fadeOutMs - fadeInMs), alive);
          if (!alive()) {
            await fadingOut;
            return;
          }
          const nextVoice = bedVoices[1 - voiceIndex]!;
          const started = await startVoice(nextVoice, nextFile, 0, alive);
          if (!started || !alive()) {
            await fadingOut;
            return;
          }
          await ramp(nextVoice, 'full', fadeInMs, gain, alive, scriptedRef);
          await fadingOut;
          current.audio.pause();
          voiceIndex = 1 - voiceIndex;
          current = nextVoice;
          queued = nextFile;
          run = step.next;
          continue;
        }

        await waitUntil(() => current.audio.ended || current.audio.error != null || reachedFadeOut(current.audio), alive);
        await ramp(current, 'silent', edgeMs(current.audio).fadeOutMs, gain, alive, scriptedRef);
        current.audio.pause();
        await waitMs(step.restMs, alive);
        run = step.next;
      }
    }

    void (async () => {
      await fadeOutBed();
      if (!alive() || !shouldPlay || land == null) {
        for (const voice of bedVoices) {
          voice.audio.pause();
        }
        return;
      }
      await runBed(land);
    })();

    return () => {
      runIdRef.current += 1;
    };
  }, [enabled, expansion, zone]);

  useEffect(() => {
    return () => {
      for (const voice of voicesRef.current ?? []) {
        voice.audio.pause();
      }
    };
  }, []);

  return null;
}
