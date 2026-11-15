/** Silence between dashboard pieces. */
export const MENU_LOOP_BREAK_MIN_MS = 6000;
export const MENU_LOOP_BREAK_MAX_MS = 14000;

/** Silence between encounter music pieces, and between calm ambiance pieces. */
export const ENCOUNTER_LOOP_BREAK_MIN_MS = 7000;
export const ENCOUNTER_LOOP_BREAK_MAX_MS = 21000;

export function loopBreakMs(
  zone: 'menu' | 'ambient',
  random: () => number = Math.random,
): number {
  const min = zone === 'ambient' ? ENCOUNTER_LOOP_BREAK_MIN_MS : MENU_LOOP_BREAK_MIN_MS;
  const max = zone === 'ambient' ? ENCOUNTER_LOOP_BREAK_MAX_MS : MENU_LOOP_BREAK_MAX_MS;
  return Math.floor(min + random() * (max - min + 1));
}
