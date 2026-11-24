import { useEffect, useRef } from 'react';
import { assetUrl } from '../../assetUrl.js';
import { playbackVolume } from '../audioVolume.js';
import { withWorkingVolume } from '../audioGain.js';
import { AMBIANCE_CLIPS } from './ambianceCatalog.js';
import {
  AMBIANCE_FADE_IN_MS,
  AMBIANCE_FADE_OUT_MS,
  AMBIANCE_START_DELAY_MS,
  handoffRunFor,
  landCrossfade,
  openingRun,
  pickPiece,
  stepAfterPiece,
  testStepAfterPiece,
  type AmbianceRun,
  type AmbianceStage,
  type AmbianceStep,
} from './ambianceCycle.js';
import { ambiancePackForExpansion, expansionHasClips, stagePool } from './ambianceLibrary.js';
import type { MusicZone } from './MusicEngine.js';

/**
 * Test cycle for listening locally (Babuni, 2026-11-17): on the dev server,
 * with localStorage['morkahja.ambiance.cycleTest'] = '1', the weather steps
 * A → B → C → D → A, one piece each. Off unless switched on (Babuni heard all
 * stages and asked for the normal weather back). Never in a production build.
 * On the dev server every piece's land and stage is logged to the console.
 */
function cycleTestOn(): boolean {
  if (!import.meta.env.DEV) {
    return false;
  }
  try {
    return window.localStorage.getItem('morkahja.ambiance.cycleTest') === '1';
  } catch {
    return false;
  }
}

function nextStep(run: AmbianceRun): AmbianceStep {
  return cycleTestOn() ? testStepAfterPiece(run) : stepAfterPiece(run);
}

function logPiece(land: number, stage: AmbianceStage, file: string): void {
  if (import.meta.env.DEV) {
    console.info(`[ambiance] land ${land} · stage ${stage}${cycleTestOn() ? ' (test cycle)' : ''} · ${file.split('/').pop()}`);
  }
}

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
  if (!alive()) {
    return false;
  }
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
 * The encounter bed. It keeps running while the expansion stays the same.
 * A different land crossfades: the new land's piece fades in while the old
 * piece fades out. A land that starts from silence still fades in.
 *
 * The stage cycle belongs to the player, not to the land (Babuni, 2026-11-17):
 * changing land does not send it back to stage A. The piece a new land cuts
 * off counts as played, and the new land plays the stage that comes next.
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
  /** Where the stage cycle stands; kept across lands and across leaving the encounter. */
  const runRef = useRef<AmbianceRun | null>(null);
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
        const audio = withWorkingVolume(new Audio());
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

    function spareVoice(): Voice {
      const audio = withWorkingVolume(new Audio());
      audio.preload = 'auto';
      audio.volume = 0;
      return { audio, fade: 0 };
    }

    async function fadeVoiceOut(voice: Voice, durationMs: number): Promise<void> {
      if (!alive()) {
        return;
      }
      if (voice.audio.paused || voice.audio.volume <= 0.001) {
        voice.audio.pause();
        voice.audio.volume = 0;
        return;
      }
      await ramp(voice, 'silent', durationMs, gain, alive, scriptedRef);
      if (alive() && voice.audio.volume <= 0.001) {
        voice.audio.pause();
        voice.audio.volume = 0;
      }
    }

    async function runBed(
      nextLand: number,
      pair: Voice[],
      start?: { voice: Voice; file: string; stage: AmbianceStage },
    ): Promise<void> {
      let voiceIndex = 0;
      let current = pair[0]!;
      if (start) {
        const index = pair.indexOf(start.voice);
        voiceIndex = index >= 0 ? index : 0;
        current = pair[voiceIndex]!;
      }
      let run: AmbianceRun = runRef.current ?? (cycleTestOn() ? { stage: 'A', piecesLeft: 1 } : openingRun());
      if (stagePool(AMBIANCE_CLIPS, nextLand, run.stage).length === 0) {
        run = openingRun();
      }
      runRef.current = run;
      const lastByStage: Record<AmbianceStage, string | null> = { A: null, B: null, C: null, D: null };
      if (start) {
        lastByStage[start.stage] = start.file;
      }
      let queued: string | null = start?.file ?? null;

      while (alive()) {
        const pool = stagePool(AMBIANCE_CLIPS, nextLand, run.stage);
        if (pool.length === 0) {
          await fadeVoiceOut(current, AMBIANCE_FADE_OUT_MS);
          return;
        }

        const alreadyPlaying = queued != null;
        const file = queued ?? pickPiece(pool, lastByStage[run.stage]);
        queued = null;
        if (!alreadyPlaying) {
          lastByStage[run.stage] = file;
          logPiece(nextLand, run.stage, file);
          const started = await startVoice(current, file, 0, alive);
          if (!started || !alive()) {
            return;
          }
          await ramp(current, 'full', edgeMs(current.audio).fadeInMs, gain, alive, scriptedRef);
        }
        if (!alive()) {
          return;
        }

        const step = nextStep(run);
        if (step.gap === 'crossfade') {
          const nextPool = stagePool(AMBIANCE_CLIPS, nextLand, step.next.stage);
          if (nextPool.length === 0) {
            await fadeVoiceOut(current, AMBIANCE_FADE_OUT_MS);
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
          const fadingOut = fadeVoiceOut(current, fadeOutMs);
          await waitMs(Math.max(0, fadeOutMs - fadeInMs), alive);
          if (!alive()) {
            await fadingOut;
            return;
          }
          const nextVoice = pair[1 - voiceIndex]!;
          logPiece(nextLand, step.next.stage, nextFile);
          const started = await startVoice(nextVoice, nextFile, 0, alive);
          if (!started || !alive()) {
            await fadingOut;
            return;
          }
          await ramp(nextVoice, 'full', fadeInMs, gain, alive, scriptedRef);
          await fadingOut;
          voiceIndex = 1 - voiceIndex;
          current = nextVoice;
          queued = nextFile;
          run = step.next;
          runRef.current = run;
          continue;
        }

        await waitUntil(() => current.audio.ended || current.audio.error != null || reachedFadeOut(current.audio), alive);
        if (!alive()) {
          return;
        }
        await fadeVoiceOut(current, edgeMs(current.audio).fadeOutMs);
        run = step.next;
        runRef.current = run;
        await waitMs(step.restMs, alive);
      }
    }

    void (async () => {
      if (!alive()) {
        return;
      }
      if (!shouldPlay || land == null) {
        await Promise.all(bedVoices.map((voice) => fadeVoiceOut(voice, AMBIANCE_FADE_OUT_MS)));
        return;
      }

      const audible = bedVoices.filter((voice) => !voice.audio.paused && voice.audio.volume > 0.001);
      if (audible.length === 0) {
        for (const voice of bedVoices) {
          if (!voice.audio.paused) {
            voice.audio.pause();
            voice.audio.volume = 0;
          }
        }
        await waitMs(AMBIANCE_START_DELAY_MS, alive);
        if (!alive()) {
          return;
        }
        await runBed(land, bedVoices);
        return;
      }

      const handoff = landCrossfade();
      await waitMs(handoff.startDelayMs, alive);
      if (!alive()) {
        return;
      }
      let incoming = bedVoices.find((voice) => voice.audio.paused);
      if (!incoming) {
        incoming = spareVoice();
        bedVoices.push(incoming);
      }
      const handoffRun = handoffRunFor(
        runRef.current,
        (stage) => stagePool(AMBIANCE_CLIPS, land, stage).length > 0,
        Math.random,
        (run) => nextStep(run),
      );
      if (!handoffRun) {
        await Promise.all(bedVoices.map((voice) => fadeVoiceOut(voice, handoff.fadeOutMs)));
        return;
      }
      runRef.current = handoffRun;
      const file = pickPiece(stagePool(AMBIANCE_CLIPS, land, handoffRun.stage), null);
      const fadingOut = Promise.all(
        bedVoices
          .filter((voice) => voice !== incoming && !voice.audio.paused)
          .map((voice) => fadeVoiceOut(voice, handoff.fadeOutMs)),
      );
      if (handoff.fadeInDelayMs > 0) {
        await waitMs(handoff.fadeInDelayMs, alive);
      }
      if (!alive()) {
        await fadingOut;
        return;
      }
      logPiece(land, handoffRun.stage, file);
      const started = await startVoice(incoming, file, 0, alive);
      if (!started || !alive()) {
        await fadingOut;
        return;
      }
      const fadeInMs = Math.min(handoff.fadeInMs, edgeMs(incoming.audio).fadeInMs);
      await Promise.all([
        ramp(incoming, 'full', fadeInMs, gain, alive, scriptedRef),
        fadingOut,
      ]);
      if (!alive()) {
        return;
      }
      const spare = bedVoices.find((voice) => voice !== incoming && voice.audio.paused) ?? spareVoice();
      for (const voice of bedVoices) {
        if (voice !== incoming && voice !== spare) {
          voice.audio.pause();
        }
      }
      const pair = [incoming, spare];
      voicesRef.current = pair;
      await runBed(land, pair, { voice: incoming, file, stage: handoffRun.stage });
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
