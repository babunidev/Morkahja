export type RoomInvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface RoomInvitation {
  inviteId: string;
  roomId: string;
  fromPlayerId: string;
  toPlayerId: string;
  createdAt: number;
  expiresAt: number;
  status: RoomInvitationStatus;
}
