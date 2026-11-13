/**
 * Hand-over between the Lore window and the avatar (Babuni, 2026-11-13): the
 * lore gem picked up in the Lore window flies to the top left of the avatar
 * and waits there until the round continues. The Lore window notes where the
 * gem was; the avatar's gem badge takes it when the server confirms the
 * pickup, and flies from there.
 */
const PICKUP_MAX_AGE_MS = 4000;

let pickup: { rect: DOMRect; at: number } | null = null;

export function noteLoreGemPickup(rect: DOMRect): void {
  pickup = { rect, at: performance.now() };
}

/** Where the gem was picked up, once, if it was picked up a moment ago. */
export function takeLoreGemPickup(): DOMRect | null {
  const current = pickup;
  pickup = null;
  if (!current || performance.now() - current.at > PICKUP_MAX_AGE_MS) {
    return null;
  }
  return current.rect;
}
