export type RewardFlyTargetKind = 'skillbook' | 'inventory';

const FOOTER_TARGET_SELECTOR = '[data-morkahja-footer-target';
const ICON_FLYER_SELECTOR = '[data-morkahja-icon-flyer]';
const AVATAR_PORTRAIT_SELECTOR = '[data-morkahja-avatar-portrait]';

export interface LossFlightSpec {
  id: string;
  imageSrc: string;
  size: number;
}

export interface LossBubbleTargetSpec extends LossFlightSpec {
  sourceRect: DOMRect;
}

export function rewardFlyTargetKind(inventoryType: number): RewardFlyTargetKind {
  return inventoryType === 1 ? 'skillbook' : 'inventory';
}

export function getFooterButtonRect(kind: RewardFlyTargetKind): DOMRect | null {
  const element = document.querySelector(
    `${FOOTER_TARGET_SELECTOR}="${kind}"]`,
  );

  return element?.getBoundingClientRect() ?? null;
}

export function vibrateFooterButton(kind: RewardFlyTargetKind): void {
  const element = document.querySelector(
    `${FOOTER_TARGET_SELECTOR}="${kind}"]`,
  );

  if (!element) {
    return;
  }

  element.classList.remove('morkahja-footer-button-vibrate');
  void element.getBoundingClientRect();
  element.classList.add('morkahja-footer-button-vibrate');
  window.setTimeout(() => {
    element.classList.remove('morkahja-footer-button-vibrate');
  }, 320);
}

export function ejectFooterButton(kind: RewardFlyTargetKind): void {
  const element = document.querySelector(
    `${FOOTER_TARGET_SELECTOR}="${kind}"]`,
  );

  if (!element) {
    return;
  }

  element.classList.remove('morkahja-footer-button-eject');
  void element.getBoundingClientRect();
  element.classList.add('morkahja-footer-button-eject');
  window.setTimeout(() => {
    element.classList.remove('morkahja-footer-button-eject');
  }, 400);
}

export function cleanupRewardFlyers(): void {
  document.querySelectorAll(ICON_FLYER_SELECTOR).forEach((node) => {
    node.remove();
  });
}

export function getAvatarPortraitRect(): DOMRect | null {
  const element = document.querySelector(AVATAR_PORTRAIT_SELECTOR);

  return element?.getBoundingClientRect() ?? null;
}

export const LOSS_BUBBLE_MS = 2800;
export const LOSS_BUBBLE_STAGGER_MS = 200;
const LOSS_BUBBLE_TIMEOUT_MS = LOSS_BUBBLE_MS + 900;
export const LOSS_ROW_FADE_IN_MS = 720;

/** Wall-clock time for loss bubbles + row fade-in. */
export function resultLossSequenceDurationMs(lossCount: number): number {
  const bubbleMs = lossCount > 0
    ? LOSS_BUBBLE_MS + Math.max(0, lossCount - 1) * LOSS_BUBBLE_STAGGER_MS
    : LOSS_BUBBLE_MS;

  return bubbleMs + LOSS_ROW_FADE_IN_MS;
}

export interface RewardFlightSpec {
  id: string;
  imageSrc: string;
  size: number;
  sourceRect: DOMRect;
  target: RewardFlyTargetKind;
}

export const REWARD_FLIGHT_MS = 820;
const REWARD_FLIGHT_FADE_START_OFFSET = 0.78;
const REWARD_FLIGHT_VIBRATE_BEFORE_END_MS = 210;
const REWARD_FLIGHT_TIMEOUT_MS = REWARD_FLIGHT_MS + 500;

function rectCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

interface IconFlightMotion {
  durationMs: number;
  fadeStartOffset: number;
  timeoutMs: number;
  boxShadow: string;
  onNearEnd?: () => void;
  nearEndLeadMs?: number;
}

function createIconFlyer(imageSrc: string, size: number, boxShadow: string): HTMLImageElement {
  const flyer = document.createElement('img');
  flyer.dataset.morkahjaIconFlyer = 'true';
  flyer.alt = '';
  flyer.draggable = false;
  flyer.setAttribute('aria-hidden', 'true');
  flyer.style.position = 'fixed';
  flyer.style.left = '0';
  flyer.style.top = '0';
  flyer.style.width = `${size}px`;
  flyer.style.height = `${size}px`;
  flyer.style.margin = '0';
  flyer.style.padding = '0';
  flyer.style.border = '0';
  flyer.style.borderRadius = '50%';
  flyer.style.objectFit = 'cover';
  flyer.style.pointerEvents = 'none';
  flyer.style.zIndex = '220';
  flyer.style.boxShadow = boxShadow;
  flyer.src = imageSrc;
  document.body.append(flyer);
  return flyer;
}

const DEFAULT_FLIGHT_EASING = 'cubic-bezier(0.18, 0.04, 0.12, 1)';

function runAnimatedFlyer(
  flyer: HTMLImageElement,
  keyframes: Keyframe[],
  durationMs: number,
  timeoutMs: number,
  onStart: () => void,
  easing: string = DEFAULT_FLIGHT_EASING,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;

    function finish(): void {
      if (settled) {
        return;
      }

      settled = true;
      flyer.remove();
      resolve();
    }

    const startFlight = (): void => {
      void waitForNextFrame().then(() => {
        if (settled) {
          return;
        }

        onStart();

        if (typeof flyer.animate !== 'function') {
          finish();
          return;
        }

        const animation = flyer.animate(keyframes, {
          duration: durationMs,
          easing,
          fill: 'forwards',
        });

        animation.finished.then(finish).catch(finish);
      });
    };

    const loadTimeout = window.setTimeout(finish, timeoutMs);

    if (flyer.complete && flyer.naturalWidth > 0) {
      window.clearTimeout(loadTimeout);
      startFlight();
      return;
    }

    flyer.addEventListener('load', () => {
      window.clearTimeout(loadTimeout);
      startFlight();
    }, { once: true });
    flyer.addEventListener('error', () => {
      window.clearTimeout(loadTimeout);
      finish();
    }, { once: true });
  });
}

function runIconFlight(
  sourceRect: DOMRect,
  targetRect: DOMRect,
  imageSrc: string,
  size: number,
  motion: IconFlightMotion,
): Promise<void> {
  const source = rectCenter(sourceRect);
  const target = rectCenter(targetRect);
  const half = size / 2;
  const flyer = createIconFlyer(
    imageSrc,
    size,
    motion.boxShadow,
  );

  const nearEndTimer = motion.onNearEnd && motion.nearEndLeadMs
    ? window.setTimeout(motion.onNearEnd, motion.durationMs - motion.nearEndLeadMs)
    : null;

  return runAnimatedFlyer(
    flyer,
    [
      {
        offset: 0,
        transform: `translate(${source.x - half}px, ${source.y - half}px) scale(1)`,
        opacity: 1,
      },
      {
        offset: motion.fadeStartOffset,
        transform: `translate(${
          source.x + (target.x - source.x) * motion.fadeStartOffset - half
        }px, ${
          source.y + (target.y - source.y) * motion.fadeStartOffset - half
        }px) scale(0.82)`,
        opacity: 1,
      },
      {
        offset: 1,
        transform: `translate(${target.x - half}px, ${target.y - half}px) scale(0.32)`,
        opacity: 0,
      },
    ],
    motion.durationMs,
    motion.timeoutMs,
    () => {
      flyer.style.transform = `translate(${source.x - half}px, ${source.y - half}px) scale(1)`;
      flyer.style.opacity = '1';
    },
  ).finally(() => {
    if (nearEndTimer !== null) {
      window.clearTimeout(nearEndTimer);
    }
  });
}

function bubbleTransform(
  x: number,
  y: number,
  scale: number,
): string {
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

function runLossBubbleFlight(
  sourceRect: DOMRect,
  imageSrc: string,
  size: number,
  bubbleIndex: number,
): Promise<void> {
  const source = rectCenter(sourceRect);
  const half = size / 2;
  const riseDistance = 156 + bubbleIndex * 24;
  const wobble = 16 + (bubbleIndex % 3) * 7;
  const flyer = createIconFlyer(
    imageSrc,
    size,
    '0 0 18px rgba(255, 120, 96, 0.55), 0 0 28px rgba(255, 72, 48, 0.28), 0 8px 14px rgba(0, 0, 0, 0.35)',
  );

  const startX = source.x - half;
  const startY = source.y - half;

  return runAnimatedFlyer(
    flyer,
    [
      {
        offset: 0,
        transform: bubbleTransform(startX, startY, 0.52),
        opacity: 0,
        filter: 'blur(0px)',
      },
      {
        offset: 0.12,
        transform: bubbleTransform(startX, startY - riseDistance * 0.06, 0.86),
        opacity: 0.72,
        filter: 'blur(0px)',
      },
      {
        offset: 0.28,
        transform: bubbleTransform(startX + wobble * 0.35, startY - riseDistance * 0.22, 1.05),
        opacity: 1,
        filter: 'blur(0px)',
      },
      {
        offset: 0.48,
        transform: bubbleTransform(startX - wobble * 0.55, startY - riseDistance * 0.44, 1.02),
        opacity: 0.96,
        filter: 'blur(0px)',
      },
      {
        offset: 0.66,
        transform: bubbleTransform(startX + wobble * 0.42, startY - riseDistance * 0.64, 0.98),
        opacity: 0.82,
        filter: 'blur(0.2px)',
      },
      {
        offset: 0.82,
        transform: bubbleTransform(startX - wobble * 0.28, startY - riseDistance * 0.82, 0.9),
        opacity: 0.48,
        filter: 'blur(0.6px)',
      },
      {
        offset: 0.94,
        transform: bubbleTransform(startX + wobble * 0.12, startY - riseDistance * 0.94, 0.82),
        opacity: 0.16,
        filter: 'blur(1.2px)',
      },
      {
        offset: 1,
        transform: bubbleTransform(startX, startY - riseDistance, 0.74),
        opacity: 0,
        filter: 'blur(2px)',
      },
    ],
    LOSS_BUBBLE_MS,
    LOSS_BUBBLE_TIMEOUT_MS,
    () => {
      flyer.style.transform = bubbleTransform(startX, startY, 0.52);
      flyer.style.opacity = '0';
      flyer.style.filter = 'blur(0px)';
    },
  );
}
function runRewardFlight(
  flight: RewardFlightSpec,
  vibratedTargets: Set<RewardFlyTargetKind>,
): Promise<void> {
  const targetRect = getFooterButtonRect(flight.target);

  if (!targetRect) {
    return Promise.resolve();
  }

  return runIconFlight(flight.sourceRect, targetRect, flight.imageSrc, flight.size, {
    durationMs: REWARD_FLIGHT_MS,
    fadeStartOffset: REWARD_FLIGHT_FADE_START_OFFSET,
    timeoutMs: REWARD_FLIGHT_TIMEOUT_MS,
    boxShadow: '0 0 14px rgba(255, 204, 102, 0.45), 0 6px 12px rgba(0, 0, 0, 0.5)',
    nearEndLeadMs: REWARD_FLIGHT_VIBRATE_BEFORE_END_MS,
    onNearEnd: () => {
      if (!vibratedTargets.has(flight.target)) {
        vibrateFooterButton(flight.target);
        vibratedTargets.add(flight.target);
      }
    },
  });
}

/** `keepOtherFlyers`: collecting one item must not cut off another item's flight. */
interface FlightOptions {
  keepOtherFlyers?: boolean;
}

async function playLossBubbles(
  flights: LossFlightSpec[],
  resolveSourceRect: (flight: LossFlightSpec, index: number) => DOMRect | null,
  options: FlightOptions = {},
): Promise<void> {
  if (flights.length === 0) {
    return;
  }

  const runnable = flights.flatMap((flight, index) => {
    const sourceRect = resolveSourceRect(flight, index);

    if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
      return [];
    }

    return [{ flight, index, sourceRect }];
  });

  if (runnable.length === 0) {
    return;
  }

  if (!options.keepOtherFlyers) {
    cleanupRewardFlyers();
  }

  await Promise.race([
    waitForNextFrame().then(() => (
      Promise.all(runnable.map(({ flight, index, sourceRect }, runnableIndex) => (
        wait(runnableIndex * LOSS_BUBBLE_STAGGER_MS).then(() => (
          runLossBubbleFlight(sourceRect, flight.imageSrc, flight.size, index)
        ))
      )))
    )),
    wait(LOSS_BUBBLE_TIMEOUT_MS + runnable.length * LOSS_BUBBLE_STAGGER_MS),
  ]);

  if (!options.keepOtherFlyers) {
    cleanupRewardFlyers();
  }
}

export async function playLossFlightsFromAvatar(
  flights: LossFlightSpec[],
): Promise<void> {
  const sourceRect = getAvatarPortraitRect();

  if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
    return;
  }

  await playLossBubbles(flights, () => sourceRect);
}

export async function playLossBubblesFromTargets(
  flights: LossBubbleTargetSpec[],
  options: FlightOptions = {},
): Promise<void> {
  await playLossBubbles(flights, (_, index) => flights[index]?.sourceRect ?? null, options);
}

export async function playRewardFlights(
  flights: RewardFlightSpec[],
  options: FlightOptions = {},
): Promise<void> {
  if (!options.keepOtherFlyers) {
    cleanupRewardFlyers();
  }

  if (flights.length === 0) {
    return;
  }

  const vibratedTargets = new Set<RewardFlyTargetKind>();

  await Promise.race([
    waitForNextFrame().then(() => (
      Promise.all(flights.map((flight) => runRewardFlight(flight, vibratedTargets)))
    )),
    wait(REWARD_FLIGHT_TIMEOUT_MS + flights.length * 80),
  ]);

  if (!options.keepOtherFlyers) {
    cleanupRewardFlyers();
  }
}

export interface SolutionSlotInboundFlightSpec {
  id: string;
  imageSrc: string;
  size: number;
  source: RewardFlyTargetKind;
  sourceRect: DOMRect;
  targetRect: DOMRect;
}

export const SOLUTION_SLOT_INBOUND_FLIGHT_MS = 780;
export const SOLUTION_SLOT_INBOUND_STAGGER_MS = 110;
const SOLUTION_SLOT_INBOUND_TIMEOUT_MS = SOLUTION_SLOT_INBOUND_FLIGHT_MS + 600;

function runSolutionSlotInboundFlight(
  sourceRect: DOMRect,
  targetRect: DOMRect,
  imageSrc: string,
  size: number,
  sourceKind: RewardFlyTargetKind,
  onNearTarget?: () => void,
): Promise<void> {
  const source = rectCenter(sourceRect);
  const target = rectCenter(targetRect);
  const half = size / 2;
  const flyer = createIconFlyer(
    imageSrc,
    size,
    '0 0 16px rgba(255, 204, 102, 0.55), 0 6px 14px rgba(0, 0, 0, 0.45)',
  );
  // The flyer arrives at 85% and stays fully visible while the slot icon fades
  // in underneath it (see SolutionBlock), so the hand-over cannot be seen.
  const nearTargetLeadMs = Math.round(SOLUTION_SLOT_INBOUND_FLIGHT_MS * 0.15);
  const nearTargetTimer = onNearTarget
    ? window.setTimeout(onNearTarget, SOLUTION_SLOT_INBOUND_FLIGHT_MS - nearTargetLeadMs)
    : null;

  return runAnimatedFlyer(
    flyer,
    [
      {
        offset: 0,
        transform: `translate(${source.x - half}px, ${source.y - half}px) scale(0.38)`,
        opacity: 0.92,
      },
      {
        offset: 0.58,
        transform: `translate(${
          source.x + (target.x - source.x) * 0.58 - half
        }px, ${
          source.y + (target.y - source.y) * 0.58 - half
        }px) scale(0.82)`,
        opacity: 1,
      },
      {
        offset: 0.85,
        transform: `translate(${target.x - half}px, ${target.y - half}px) scale(1)`,
        opacity: 1,
      },
      {
        offset: 1,
        transform: `translate(${target.x - half}px, ${target.y - half}px) scale(1)`,
        opacity: 1,
      },
    ],
    SOLUTION_SLOT_INBOUND_FLIGHT_MS,
    SOLUTION_SLOT_INBOUND_TIMEOUT_MS,
    () => {
      ejectFooterButton(sourceKind);
      flyer.style.transform = `translate(${source.x - half}px, ${source.y - half}px) scale(0.38)`;
      flyer.style.opacity = '0.92';
    },
  ).finally(() => {
    if (nearTargetTimer !== null) {
      window.clearTimeout(nearTargetTimer);
    }
  });
}

export async function playSolutionSlotInboundFlights(
  flights: SolutionSlotInboundFlightSpec[],
  onFlightComplete?: (id: string) => void,
): Promise<void> {
  cleanupRewardFlyers();

  if (flights.length === 0) {
    return;
  }

  await waitForNextFrame();

  await Promise.race([
    Promise.all(flights.map((flight, index) => (
      wait(index * SOLUTION_SLOT_INBOUND_STAGGER_MS).then(() => (
        runSolutionSlotInboundFlight(
          flight.sourceRect,
          flight.targetRect,
          flight.imageSrc,
          flight.size,
          flight.source,
          onFlightComplete ? () => onFlightComplete(flight.id) : undefined,
        )
      ))
    ))),
    wait(SOLUTION_SLOT_INBOUND_TIMEOUT_MS + flights.length * SOLUTION_SLOT_INBOUND_STAGGER_MS),
  ]);

  cleanupRewardFlyers();
}

const ENCOUNTER_ART_SELECTOR = '[data-morkahja-encounter-art]';

export function getEncounterArtRect(): DOMRect | null {
  const element = document.querySelector(ENCOUNTER_ART_SELECTOR);
  return element instanceof HTMLElement ? element.getBoundingClientRect() : null;
}

/** A used solution travels into the middle of the encounter picture and shrinks to nothing. */
export const USED_SOLUTION_FLIGHT_MS = 900;
const USED_SOLUTION_FLIGHT_TIMEOUT_MS = USED_SOLUTION_FLIGHT_MS + 600;
export const USED_SOLUTION_STAGGER_MS = 120;

export interface UsedSolutionFlightSpec {
  imageSrc: string;
  size: number;
  sourceRect: DOMRect;
  /** Called the moment the flyer covers the slot, to hide the original icon. */
  onTakeOff?: () => void;
}

function runUsedSolutionFlight(spec: UsedSolutionFlightSpec, targetRect: DOMRect): Promise<void> {
  const source = rectCenter(spec.sourceRect);
  const target = rectCenter(targetRect);
  const half = spec.size / 2;
  const flyer = createIconFlyer(
    spec.imageSrc,
    spec.size,
    '0 0 18px rgba(255, 204, 102, 0.6), 0 6px 14px rgba(0, 0, 0, 0.45)',
  );
  const at = (progress: number): { x: number; y: number } => ({
    x: source.x + (target.x - source.x) * progress - half,
    y: source.y + (target.y - source.y) * progress - half,
  });
  const start = at(0);
  const lift = at(0.04);
  const middle = at(0.72);
  const end = at(1);

  return runAnimatedFlyer(
    flyer,
    [
      { offset: 0, transform: `translate(${start.x}px, ${start.y}px) scale(1)`, opacity: 1 },
      { offset: 0.18, transform: `translate(${lift.x}px, ${lift.y}px) scale(1.1)`, opacity: 1 },
      { offset: 0.72, transform: `translate(${middle.x}px, ${middle.y}px) scale(0.62)`, opacity: 1 },
      { offset: 1, transform: `translate(${end.x}px, ${end.y}px) scale(0)`, opacity: 0 },
    ],
    USED_SOLUTION_FLIGHT_MS,
    USED_SOLUTION_FLIGHT_TIMEOUT_MS,
    () => {
      flyer.style.transform = `translate(${start.x}px, ${start.y}px) scale(1)`;
      flyer.style.opacity = '1';
      spec.onTakeOff?.();
    },
    // Slow start, then into the picture.
    'cubic-bezier(0.45, 0, 0.3, 1)',
  );
}

export async function playUsedSolutionsIntoEncounter(flights: UsedSolutionFlightSpec[]): Promise<void> {
  const targetRect = getEncounterArtRect();
  if (!targetRect || flights.length === 0) {
    return;
  }

  await Promise.race([
    waitForNextFrame().then(() => Promise.all(flights.map((flight, index) => (
      wait(index * USED_SOLUTION_STAGGER_MS).then(() => runUsedSolutionFlight(flight, targetRect))
    )))),
    wait(USED_SOLUTION_FLIGHT_TIMEOUT_MS + flights.length * USED_SOLUTION_STAGGER_MS),
  ]);
}

/**
 * A loss appears where it was kept (an essence in the middle of the avatar, an
 * item or skill at its Inventory or Skillbook button) and travels to its place
 * in the result's loss row.
 */
export const LOSS_ARRIVAL_MS = 950;
const LOSS_ARRIVAL_TIMEOUT_MS = LOSS_ARRIVAL_MS + 600;
export const LOSS_ARRIVAL_STAGGER_MS = 140;

export interface LossArrivalSpec {
  imageSrc: string;
  size: number;
  sourceRect: DOMRect;
  targetRect: DOMRect;
}

function runLossArrival(spec: LossArrivalSpec): Promise<void> {
  const source = rectCenter(spec.sourceRect);
  const target = rectCenter(spec.targetRect);
  const half = spec.size / 2;
  const flyer = createIconFlyer(
    spec.imageSrc,
    spec.size,
    '0 0 16px rgba(255, 120, 96, 0.5), 0 6px 12px rgba(0, 0, 0, 0.45)',
  );
  const startX = source.x - half;
  const startY = source.y - half;
  const endX = target.x - half;
  const endY = target.y - half;

  return runAnimatedFlyer(
    flyer,
    [
      { offset: 0, transform: `translate(${startX}px, ${startY}px) scale(0.3)`, opacity: 0 },
      { offset: 0.22, transform: `translate(${startX}px, ${startY}px) scale(1.08)`, opacity: 1 },
      { offset: 0.34, transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1 },
      { offset: 1, transform: `translate(${endX}px, ${endY}px) scale(1)`, opacity: 1 },
    ],
    LOSS_ARRIVAL_MS,
    LOSS_ARRIVAL_TIMEOUT_MS,
    () => {
      flyer.style.transform = `translate(${startX}px, ${startY}px) scale(0.3)`;
      flyer.style.opacity = '0';
    },
  );
}

/** Resolves once every loss has arrived; `onLastArrival` fires just before the final flyer is removed. */
export async function playLossArrivals(
  flights: LossArrivalSpec[],
  onLastArrival?: () => void,
): Promise<void> {
  if (flights.length === 0) {
    onLastArrival?.();
    return;
  }

  const lastLandsAt = (flights.length - 1) * LOSS_ARRIVAL_STAGGER_MS + LOSS_ARRIVAL_MS;
  const revealTimer = window.setTimeout(() => onLastArrival?.(), Math.max(0, lastLandsAt - 60));

  await Promise.race([
    waitForNextFrame().then(() => Promise.all(flights.map((flight, index) => (
      wait(index * LOSS_ARRIVAL_STAGGER_MS).then(() => runLossArrival(flight))
    )))),
    wait(LOSS_ARRIVAL_TIMEOUT_MS + flights.length * LOSS_ARRIVAL_STAGGER_MS),
  ]);

  window.clearTimeout(revealTimer);
  onLastArrival?.();
}

/**
 * Rewards grow out of the middle of the encounter picture and travel to their
 * slots: the reverse of a used solution shrinking into it.
 */
export const REWARD_EMERGE_MS = 950;
const REWARD_EMERGE_TIMEOUT_MS = REWARD_EMERGE_MS + 600;
export const REWARD_EMERGE_STAGGER_MS = 130;

export interface RewardEmergenceSpec {
  imageSrc: string;
  size: number;
  targetRect: DOMRect;
}

function runRewardEmergence(spec: RewardEmergenceSpec, sourceRect: DOMRect): Promise<void> {
  const source = rectCenter(sourceRect);
  const target = rectCenter(spec.targetRect);
  const half = spec.size / 2;
  const flyer = createIconFlyer(
    spec.imageSrc,
    spec.size,
    '0 0 14px rgba(255, 204, 102, 0.45), 0 6px 12px rgba(0, 0, 0, 0.5)',
  );
  const at = (progress: number): { x: number; y: number } => ({
    x: source.x + (target.x - source.x) * progress - half,
    y: source.y + (target.y - source.y) * progress - half,
  });
  const start = at(0);
  const early = at(0.3);
  const end = at(1);

  return runAnimatedFlyer(
    flyer,
    [
      { offset: 0, transform: `translate(${start.x}px, ${start.y}px) scale(0)`, opacity: 0 },
      { offset: 0.3, transform: `translate(${early.x}px, ${early.y}px) scale(0.72)`, opacity: 1 },
      { offset: 1, transform: `translate(${end.x}px, ${end.y}px) scale(1)`, opacity: 1 },
    ],
    REWARD_EMERGE_MS,
    REWARD_EMERGE_TIMEOUT_MS,
    () => {
      flyer.style.transform = `translate(${start.x}px, ${start.y}px) scale(0)`;
      flyer.style.opacity = '0';
    },
  );
}

/** Resolves once every reward has landed; `onLanded` fires just before the last flyer is removed. */
export async function playRewardEmergence(
  flights: RewardEmergenceSpec[],
  onLanded?: () => void,
): Promise<void> {
  const sourceRect = getEncounterArtRect();
  if (!sourceRect || flights.length === 0) {
    onLanded?.();
    return;
  }

  const lastLandsAt = (flights.length - 1) * REWARD_EMERGE_STAGGER_MS + REWARD_EMERGE_MS;
  const landedTimer = window.setTimeout(() => onLanded?.(), Math.max(0, lastLandsAt - 60));

  await Promise.race([
    waitForNextFrame().then(() => Promise.all(flights.map((flight, index) => (
      wait(index * REWARD_EMERGE_STAGGER_MS).then(() => runRewardEmergence(flight, sourceRect))
    )))),
    wait(REWARD_EMERGE_TIMEOUT_MS + flights.length * REWARD_EMERGE_STAGGER_MS),
  ]);

  window.clearTimeout(landedTimer);
  onLanded?.();
}
