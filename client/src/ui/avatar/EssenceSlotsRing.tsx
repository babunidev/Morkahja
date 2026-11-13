import { useEffect, useMemo, useRef, useSyncExternalStore, type CSSProperties } from 'react';
import type { InventoryItemDto } from '@shared/contracts';
import { gameSolutions } from '../../data/gameContent.js';
import { assetUrl } from '../../assetUrl.js';
import { protectedImageProps } from '../protectedImage.js';
import {
  ESSENCE_FILL_ORDER,
  ESSENCE_SLOT_COUNT,
  chargesNotInSlots,
  essenceCharges,
  essenceSlotElement,
  getEssenceSlots,
  landEssenceInSlot,
  reserveEssenceSlot,
  subscribeEssenceSlots,
  syncEssenceSlots,
} from '../game/essenceSlots.js';
import { ejectFooterButton, getFooterButtonRect, playIconFlightToElement } from '../game/rewardFlyAnimation.js';

/**
 * The avatar's lives (Babuni's direction, 2026-11-13): five essence slots on
 * the bottom edge of the round portrait, one at the bottom centre and two on
 * each side. The local avatar's slots follow essenceSlots.ts (consumed on a
 * loss, refilled from the inventory when the next encounter begins); a party
 * member's simply show what it carries.
 */

const SOLUTION_IMAGE_ROOT = assetUrl('/game/solutionimages');
const ESSENCE_SOLUTION_TYPE = 15;
/** Degrees from the bottom of the circle, for positions 0–4 from left to right. */
const SLOT_ANGLES = [-46, -23, 0, 23, 46];
/** Distance of the slots from the portrait's centre, in % of its size. */
const SLOT_RADIUS_PERCENT = 44;
const SLOT_SIZE_PERCENT = 17;
/** Wait after a new encounter appears before refilling, so the flights are seen. */
const REFILL_DELAY_MS = 700;
const REFILL_STAGGER_MS = 160;

export function essenceItems(essences: InventoryItemDto[] | undefined): InventoryItemDto[] {
  return Array.isArray(essences)
    ? essences.filter((item) => item.solutionType === ESSENCE_SOLUTION_TYPE && item.uses > 0)
    : [];
}

function essenceImage(solutionId: number | null | undefined): string | null {
  if (solutionId === null || solutionId === undefined) {
    return null;
  }
  const solution = (gameSolutions() as Record<string, { mSolutionIconName: string } | undefined>)[String(solutionId)];
  return solution ? `${SOLUTION_IMAGE_ROOT}/${solution.mSolutionIconName}.webp` : null;
}

const ringStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 3,
};

function slotStyle(position: number): CSSProperties {
  const angle = (SLOT_ANGLES[position]! * Math.PI) / 180;
  return {
    position: 'absolute',
    left: `${50 + SLOT_RADIUS_PERCENT * Math.sin(angle)}%`,
    top: `${50 + SLOT_RADIUS_PERCENT * Math.cos(angle)}%`,
    width: `${SLOT_SIZE_PERCENT}%`,
    aspectRatio: '1',
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(10, 5, 3, 0.9) 55%, rgba(10, 5, 3, 0.6) 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(216, 176, 106, 0.55), 0 1px 4px rgba(0, 0, 0, 0.8)',
  };
}

const essenceStyle: CSSProperties = {
  position: 'absolute',
  inset: '-8%',
  width: '116%',
  height: '116%',
  objectFit: 'contain',
  filter: 'drop-shadow(0 0 4px rgba(255, 204, 102, 0.55))',
  transition: 'opacity 260ms ease, transform 260ms ease',
};

export function EssenceSlotsRing({
  avatarId,
  essences,
  encounterKey,
  local = false,
}: {
  avatarId: string;
  essences: InventoryItemDto[] | undefined;
  /** Changes when a new encounter begins: the local avatar's empty slots are refilled then. */
  encounterKey?: string;
  local?: boolean;
}) {
  const items = useMemo(() => essenceItems(essences), [essences]);
  const charges = useMemo(() => essenceCharges(items), [items]);
  const total = charges.length;
  const chargesKey = charges.join(',');
  const slots = useSyncExternalStore(subscribeEssenceSlots, getEssenceSlots);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (local) {
      syncEssenceSlots(avatarId, itemsRef.current);
    }
  }, [avatarId, local, chargesKey]);

  // When a new encounter begins, essences from the inventory fill the empty slots.
  const lastEncounterRef = useRef(encounterKey);
  useEffect(() => {
    if (!local || !encounterKey || lastEncounterRef.current === encounterKey) {
      lastEncounterRef.current = encounterKey;
      return undefined;
    }
    lastEncounterRef.current = encounterKey;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      syncEssenceSlots(avatarId, itemsRef.current);
      // Essences in the inventory but not yet in a slot, in inventory order.
      const waiting = chargesNotInSlots(getEssenceSlots(), essenceCharges(itemsRef.current));
      for (let index = 0; index < waiting.length; index += 1) {
        const solutionId = waiting[index]!;
        const position = reserveEssenceSlot(solutionId);
        if (position === null) {
          break;
        }
        timers.push(window.setTimeout(() => {
          const sourceRect = getFooterButtonRect('inventory');
          const target = essenceSlotElement(position);
          const image = essenceImage(solutionId);
          if (!sourceRect || !target || !image) {
            landEssenceInSlot(position);
            return;
          }
          ejectFooterButton('inventory');
          const size = Math.round(target.getBoundingClientRect().width * 1.16);
          void playIconFlightToElement(sourceRect, target, image, size).then(() => landEssenceInSlot(position));
        }, index * REFILL_STAGGER_MS));
      }
    }, REFILL_DELAY_MS));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [avatarId, encounterKey, local]);

  // The local avatar's slots keep their own essences; a party member's show what it carries.
  const shownSlots = local && slots.avatarId === avatarId
    ? slots.slots
    : ESSENCE_FILL_ORDER.reduce<(number | null)[]>((result, position, index) => {
      result[position] = charges[index] ?? null;
      return result;
    }, Array.from({ length: ESSENCE_SLOT_COUNT }, () => null));

  return (
    <div aria-label={`${total} ${total === 1 ? 'essence' : 'essences'}`} role="img" style={ringStyle}>
      {SLOT_ANGLES.map((_, position) => {
        const image = essenceImage(shownSlots[position]);
        return (
          <span data-essence-slot={local ? position : undefined} key={position} style={slotStyle(position)}>
            {image ? (
              <img alt="" aria-hidden="true" {...protectedImageProps} src={image} style={essenceStyle} />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export default EssenceSlotsRing;
