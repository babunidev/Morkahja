export type RewardFlyTargetKind = 'skillbook' | 'inventory';

const FOOTER_TARGET_SELECTOR = '[data-morkahja-footer-target';
const ICON_FLYER_SELECTOR = '[data-morkahja-icon-flyer]';
const AVATAR_PORTRAIT_SELECTOR = '[data-morkahja-avatar-portrait]';

export interface LossFlightSpec {
  id: string;
  imageSrc: string;
  size: number;
  targetRect: DOMRect;
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

export const LOSS_FLIGHT_MS = 820;
const LOSS_FLIGHT_FADE_START_OFFSET = 0.78;
const LOSS_FLIGHT_TIMEOUT_MS = LOSS_FLIGHT_MS + 500;

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
  flyer.style.transform = `translate(${source.x - half}px, ${source.y - half}px) scale(1)`;
  flyer.style.opacity = '1';
  flyer.style.boxShadow = motion.boxShadow;
  document.body.append(flyer);

  const nearEndTimer = motion.onNearEnd && motion.nearEndLeadMs
    ? window.setTimeout(motion.onNearEnd, motion.durationMs - motion.nearEndLeadMs)
    : null;

  return new Promise((resolve) => {
    let settled = false;

    function finish(): void {
      if (settled) {
        return;
      }

      settled = true;
      if (nearEndTimer !== null) {
        window.clearTimeout(nearEndTimer);
      }
      flyer.remove();
      resolve();
    }

    const startFlight = (): void => {
      void waitForNextFrame().then(() => {
        if (settled) {
          return;
        }

        if (typeof flyer.animate !== 'function') {
          finish();
          return;
        }

        const fadeStartX = source.x + (target.x - source.x) * motion.fadeStartOffset;
        const fadeStartY = source.y + (target.y - source.y) * motion.fadeStartOffset;

        const animation = flyer.animate(
          [
            {
              offset: 0,
              transform: `translate(${source.x - half}px, ${source.y - half}px) scale(1)`,
              opacity: 1,
            },
            {
              offset: motion.fadeStartOffset,
              transform: `translate(${fadeStartX - half}px, ${fadeStartY - half}px) scale(0.82)`,
              opacity: 1,
            },
            {
              offset: 1,
              transform: `translate(${target.x - half}px, ${target.y - half}px) scale(0.32)`,
              opacity: 0,
            },
          ],
          {
            duration: motion.durationMs,
            easing: 'cubic-bezier(0.12, 0.82, 0.18, 1)',
            fill: 'forwards',
          },
        );

        animation.finished.then(finish).catch(finish);
      });
    };

    const loadTimeout = window.setTimeout(finish, motion.timeoutMs);

    const beginLoad = (): void => {
      flyer.src = imageSrc;

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
    };

    beginLoad();
  });
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

function runLossFlight(
  flight: LossFlightSpec,
  sourceRect: DOMRect,
): Promise<void> {
  return runIconFlight(sourceRect, flight.targetRect, flight.imageSrc, flight.size, {
    durationMs: LOSS_FLIGHT_MS,
    fadeStartOffset: LOSS_FLIGHT_FADE_START_OFFSET,
    timeoutMs: LOSS_FLIGHT_TIMEOUT_MS,
    boxShadow: '0 0 16px rgba(255, 72, 48, 0.62), 0 6px 12px rgba(0, 0, 0, 0.5)',
  });
}

export async function playLossFlightsFromAvatar(
  flights: LossFlightSpec[],
): Promise<void> {
  if (flights.length === 0) {
    return;
  }

  const sourceRect = getAvatarPortraitRect();

  if (!sourceRect || sourceRect.width <= 0 || sourceRect.height <= 0) {
    return;
  }

  cleanupRewardFlyers();

  await Promise.race([
    waitForNextFrame().then(() => (
      Promise.all(flights.map((flight, index) => (
        wait(index * 70).then(() => runLossFlight(flight, sourceRect))
      )))
    )),
    wait(LOSS_FLIGHT_TIMEOUT_MS + flights.length * 80),
  ]);

  cleanupRewardFlyers();
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
