import { createHash, randomBytes, randomUUID, verify } from 'node:crypto';

import {
  consumeSessionAuthChallenge,
  deleteAllSessionsForPlayer,
  deleteSession,
  findPlayerByIdentityPublicKey,
  findSessionByAccessToken,
  getDevice,
  getPlayer,
  getSession,
  setDevice,
  setPlayer,
  setSession,
  storeSessionAuthChallenge,
} from '../db/postgresDocumentStore.js';
import { assertPlayerCanPlay } from './adminPlayerService.js';
import type { PlayerDocument } from '../types/player.js';
import type { DeviceDocument, SessionDocument, SignedIdentityChallenge } from '../types/session.js';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 8;
const SESSION_CHALLENGE_DURATION_MS = 2 * 60 * 1000;
const SESSION_CHALLENGE_PREFIX = 'morkahja-session-v1:';

export type SessionChallengePurpose = 'register' | 'restore';

export interface IssueSessionChallengeInput {
  devicePublicKey: string;
  identityPublicKey: string;
  purpose: SessionChallengePurpose;
}

export interface IssuedSessionChallenge {
  challenge: string;
  expiresAt: number;
}

export class SessionError extends Error {
  constructor(
    message = 'SESSION_INVALID',
    readonly statusCode = 401,
  ) {
    super(message);
  }
}

export interface BootstrapSessionInput {
  devicePublicKey: string;
  playerName?: string;
  signedIdentityChallenge?: SignedIdentityChallenge;
  signedDeviceChallenge?: SignedIdentityChallenge;
  identityPublicKey?: string;
  purpose?: SessionChallengePurpose;
}

export interface BootstrapSessionResult {
  playerId: string;
  playerName: string;
  sessionId: string;
  accessToken: string;
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash('sha256').update(value).digest('base64url').slice(0, 32)}`;
}

function challengeHash(challenge: string): string {
  return createHash('sha256').update(challenge).digest('hex');
}

function parsePublicKey(encoded: string): JsonWebKey | null {
  if (typeof encoded !== 'string' || encoded.length > 1024) {
    return null;
  }

  try {
    const jwk = JSON.parse(encoded) as JsonWebKey;
    if (
      jwk.kty !== 'EC' ||
      jwk.crv !== 'P-256' ||
      typeof jwk.x !== 'string' ||
      typeof jwk.y !== 'string' ||
      jwk.d !== undefined
    ) {
      return null;
    }
    return jwk;
  } catch {
    return null;
  }
}

function verifyChallengeSignature(publicKey: string, signed: SignedIdentityChallenge): boolean {
  const jwk = parsePublicKey(publicKey);
  if (
    !jwk ||
    !signed ||
    typeof signed.challenge !== 'string' ||
    typeof signed.signature !== 'string' ||
    !/^morkahja-session-v1:[A-Za-z0-9_-]{43}$/u.test(signed.challenge) ||
    !/^[A-Za-z0-9_-]{86}$/u.test(signed.signature)
  ) {
    return false;
  }

  try {
    return verify(
      'sha256',
      Buffer.from(signed.challenge, 'utf8'),
      { key: jwk, format: 'jwk', dsaEncoding: 'ieee-p1363' },
      Buffer.from(signed.signature, 'base64url'),
    );
  } catch {
    return false;
  }
}

export async function issueSessionChallenge(
  input: IssueSessionChallengeInput,
): Promise<IssuedSessionChallenge> {
  if (
    (input.purpose !== 'register' && input.purpose !== 'restore') ||
    !parsePublicKey(input.devicePublicKey) ||
    !parsePublicKey(input.identityPublicKey)
  ) {
    throw new SessionError('Invalid session challenge request', 400);
  }

  const challenge = `${SESSION_CHALLENGE_PREFIX}${randomBytes(32).toString('base64url')}`;
  const expiresAt = Date.now() + SESSION_CHALLENGE_DURATION_MS;

  await storeSessionAuthChallenge({
    challengeHash: challengeHash(challenge),
    devicePublicKey: input.devicePublicKey,
    identityPublicKey: input.identityPublicKey,
    purpose: input.purpose,
    expiresAt,
  });

  return { challenge, expiresAt };
}

async function resolveDevice(devicePublicKey: string, now: number): Promise<DeviceDocument> {
  const deviceId = stableId('device', devicePublicKey);
  const existing = await getDevice<DeviceDocument>(deviceId);
  const device: DeviceDocument = existing
    ? { ...existing, lastSeenAt: now }
    : {
        deviceId,
        publicKey: devicePublicKey,
        createdAt: now,
        lastSeenAt: now,
      };

  await setDevice(deviceId, device);
  return device;
}

async function createPlayer(
  playerName: string,
  identityPublicKey: string,
  now: number,
): Promise<PlayerDocument> {
  const playerId = stableId('player', identityPublicKey);
  const player: PlayerDocument = {
    playerId,
    playerName,
    identityPublicKey,
    activeSessionId: null,
    activeSessionExpiresAt: null,
    createdAt: now,
    lastPlayedAt: now,
    unlockedExpansions: [0],
    currencies: {},
    loreGemClaims: {},
  };

  await setPlayer(playerId, player);
  return player;
}

async function resolvePlayer(input: BootstrapSessionInput, now: number): Promise<PlayerDocument> {
  if (!input.identityPublicKey) {
    throw new SessionError('identityPublicKey is required', 400);
  }

  const existing = await findPlayerByIdentityPublicKey<PlayerDocument>(input.identityPublicKey);

  if (input.purpose === 'restore') {
    if (!existing) {
      throw new SessionError('Player identity not found', 404);
    }

    return {
      ...existing.data,
      playerId: existing.data.playerId ?? existing.id,
    };
  }

  if (input.purpose !== 'register') {
    throw new SessionError('SESSION_INVALID', 401);
  }

  if (existing) {
    throw new SessionError('Player identity already exists', 409);
  }

  const playerName = input.playerName?.trim();
  if (!playerName) {
    throw new SessionError('playerName is required', 400);
  }

  return createPlayer(playerName, input.identityPublicKey, now);
}

async function loadPlayerForSession(playerId: string): Promise<PlayerDocument> {
  const player = await getPlayer<PlayerDocument>(playerId);

  if (!player) {
    throw new SessionError('Player not found', 404);
  }

  return {
    ...player,
    playerId: player.playerId ?? playerId,
  };
}

export async function bootstrapSession(
  input: BootstrapSessionInput,
): Promise<BootstrapSessionResult> {
  const now = Date.now();
  const identityProof = input.signedIdentityChallenge;
  const deviceProof = input.signedDeviceChallenge;

  if (
    !input.identityPublicKey ||
    !input.devicePublicKey ||
    (input.purpose !== 'register' && input.purpose !== 'restore') ||
    !identityProof ||
    !deviceProof ||
    identityProof.challenge !== deviceProof.challenge ||
    !verifyChallengeSignature(input.identityPublicKey, identityProof) ||
    !verifyChallengeSignature(input.devicePublicKey, deviceProof)
  ) {
    throw new SessionError('SESSION_INVALID', 401);
  }

  const consumed = await consumeSessionAuthChallenge({
    challengeHash: challengeHash(identityProof.challenge),
    identityPublicKey: input.identityPublicKey,
    devicePublicKey: input.devicePublicKey,
    purpose: input.purpose,
  }, now);

  if (!consumed) {
    throw new SessionError('SESSION_INVALID', 401);
  }

  const resolved = await resolvePlayer(input, now);
  const device = await resolveDevice(input.devicePublicKey, now);
  const player = await loadPlayerForSession(resolved.playerId);

  try {
    assertPlayerCanPlay(player);
  } catch (error) {
    await deleteAllSessionsForPlayer(player.playerId);
    await setPlayer(
      player.playerId,
      {
        activeSessionId: null,
        activeSessionExpiresAt: null,
      },
      { merge: true },
    );
    const message = error instanceof Error ? error.message : 'SESSION_INVALID';
    throw new SessionError(message, 403);
  }
  const sessionId = randomUUID();
  const accessToken = randomBytes(32).toString('base64url');
  const expiresAt = now + SESSION_DURATION_MS;
  const session: SessionDocument = {
    sessionId,
    playerId: player.playerId,
    deviceId: device.deviceId,
    accessToken,
    createdAt: now,
    expiresAt,
    lastHeartbeatAt: now,
  };

  if (player.activeSessionId) {
    await deleteSession(player.activeSessionId);
  }

  await setSession(sessionId, session);
  await setPlayer(
    player.playerId,
    {
      activeSessionId: sessionId,
      activeSessionExpiresAt: expiresAt,
      lastPlayedAt: now,
    },
    { merge: true },
  );

  return {
    playerId: player.playerId,
    playerName: player.playerName,
    sessionId,
    accessToken,
  };
}

export async function authenticateAccessToken(accessToken: string): Promise<{
  deviceId: string;
  player: PlayerDocument;
  playerId: string;
  session: SessionDocument;
}> {
  const session = await findSessionByAccessToken<SessionDocument>(accessToken);

  if (!session || session.expiresAt <= Date.now()) {
    throw new SessionError();
  }

  const player = await loadPlayerForSession(session.playerId);

  if (player.activeSessionId !== session.sessionId) {
    throw new SessionError();
  }

  try {
    assertPlayerCanPlay(player);
  } catch (error) {
    await deleteAllSessionsForPlayer(player.playerId);
    await setPlayer(
      player.playerId,
      {
        activeSessionId: null,
        activeSessionExpiresAt: null,
      },
      { merge: true },
    );
    const message = error instanceof Error ? error.message : 'SESSION_INVALID';
    throw new SessionError(message, 403);
  }

  return {
    deviceId: session.deviceId,
    player,
    playerId: player.playerId,
    session,
  };
}

export async function heartbeatSession(accessToken: string): Promise<SessionDocument> {
  const { player, session } = await authenticateAccessToken(accessToken);
  const now = Date.now();
  const expiresAt = now + SESSION_DURATION_MS;
  const nextSession = {
    ...session,
    expiresAt,
    lastHeartbeatAt: now,
  };

  await setSession(nextSession.sessionId, nextSession);
  await setPlayer(
    player.playerId,
    {
      activeSessionExpiresAt: expiresAt,
      lastPlayedAt: now,
      lastInteractionAt: now,
    },
    { merge: true },
  );

  const { touchPlayerPresence } = await import('./roomService.js');
  await touchPlayerPresence(player.playerId, 'online');

  return nextSession;
}

export async function logoutSession(accessToken: string): Promise<void> {
  const { player, session } = await authenticateAccessToken(accessToken);

  await deleteSession(session.sessionId);
  await setPlayer(
    player.playerId,
    {
      activeSessionId: null,
      activeSessionExpiresAt: null,
      lastPlayedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function loadSession(sessionId: string): Promise<SessionDocument | null> {
  return getSession<SessionDocument>(sessionId);
}
