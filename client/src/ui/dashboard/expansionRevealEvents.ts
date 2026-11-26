/** Asks the expansion unlock card to look for new unlocks now (D-068). */
export const EXPANSION_REVEAL_CHECK_EVENT = 'morkahja:expansion-reveal-check';

export function requestExpansionRevealCheck(): void {
  window.dispatchEvent(new CustomEvent(EXPANSION_REVEAL_CHECK_EVENT));
}
