export type SlotState = 'open' | 'friends_only' | 'locked';

export const DEFAULT_SLOT_STATES: [SlotState, SlotState, SlotState] = [
  'locked',
  'open',
  'open',
];
