export type PlayerPresenceState =
  | 'online'
  | 'in_room'
  | 'idle'
  | 'offline';

export interface PlayerPresence {
  playerId: string;
  lastSeenAt: number;
  activeRoomId?: string;
  state: PlayerPresenceState;
}
