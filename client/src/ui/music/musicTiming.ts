/**
 * Silence between pieces. The minimum is 0 (Babuni, 2026-11-17): a piece can
 * follow straight on, because every piece fades in and out.
 */
/** Every piece fades in over one second and out over two (Babuni, 2026-11-17). */
export const PIECE_FADE_IN_MS = 1000;
export const PIECE_FADE_OUT_MS = 2000;

/** Silence between dashboard pieces. */
export const MENU_LOOP_BREAK_MIN_MS = 0;
export const MENU_LOOP_BREAK_MAX_MS = 14000;

/** Silence between encounter music pieces, and between calm ambiance pieces. */
export const ENCOUNTER_LOOP_BREAK_MIN_MS = 0;
export const ENCOUNTER_LOOP_BREAK_MAX_MS = 21000;

export function loopBreakMs(
  zone: 'menu' | 'ambient',
  random: () => number = Math.random,
): number {
  const min = zone === 'ambient' ? ENCOUNTER_LOOP_BREAK_MIN_MS : MENU_LOOP_BREAK_MIN_MS;
  const max = zone === 'ambient' ? ENCOUNTER_LOOP_BREAK_MAX_MS : MENU_LOOP_BREAK_MAX_MS;
  return Math.floor(min + random() * (max - min + 1));
}
