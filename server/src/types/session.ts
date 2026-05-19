export interface DeviceDocument {
  deviceId: string;
  publicKey: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface SessionDocument {
  sessionId: string;
  playerId: string;
  deviceId: string;
  accessToken: string;
  createdAt: number;
  expiresAt: number;
  lastHeartbeatAt: number;
}

export interface SignedIdentityChallenge {
  challenge: string;
  signature: string;
}
