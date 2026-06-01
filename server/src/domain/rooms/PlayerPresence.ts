export type PlayerPresenceState =
  | 'online'
  | 'in_room'
  | 'idle'
  | 'offline';

export type PartyEjectionReason = 'kicked';

export interface PartyEjectionStamp {
  reason: PartyEjectionReason;
  at: number;
  roomId?: string;
}

export interface PlayerPresence {
  playerId: string;
  lastSeenAt: number;
  activeRoomId?: string;
  state: PlayerPresenceState;
  /** One-shot flag read by GET /room/active after kick. */
  lastPartyEjection?: PartyEjectionStamp;
}
