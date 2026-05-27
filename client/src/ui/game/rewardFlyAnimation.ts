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

function runAnimatedFlyer(
  flyer: HTMLImageElement,
  keyframes: Keyframe[],
  durationMs: number,
  timeoutMs: number,
  onStart: () => void,
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
          easing: 'cubic-bezier(0.18, 0.04, 0.12, 1)',
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

async function playLossBubbles(
  flights: LossFlightSpec[],
  resolveSourceRect: (flight: LossFlightSpec, index: number) => DOMRect | null,
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

  cleanupRewardFlyers();

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

  cleanupRewardFlyers();
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
): Promise<void> {
  await playLossBubbles(flights, (_, index) => flights[index]?.sourceRect ?? null);
}

export async function playRewardFlights(
  flights: RewardFlightSpec[],
): Promise<void> {
  cleanupRewardFlyers();

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

  cleanupRewardFlyers();
}
