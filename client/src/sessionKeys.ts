const DEVICE_KEY_STORAGE = 'morkahja.deviceKeypair';
const IDENTITY_KEY_STORAGE = 'morkahja.identityKeypair';
export const RESTORE_CHALLENGE_PREFIX = 'morkahja-restore:';

export interface StoredKeypair {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

export interface RecoveryKeyFile {
  kind: 'morkahja.identityKey';
  version: 1;
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

interface StoredIdentityKeypair {
  playerId: string;
  keypair: StoredKeypair;
}

function keyAlgorithm(): EcKeyGenParams {
  return { name: 'ECDSA', namedCurve: 'P-256' };
}

function encodeBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function publicKeyString(publicKey: JsonWebKey): string {
  return JSON.stringify(publicKey);
}

export async function generateKeypair(): Promise<StoredKeypair> {
  const keypair = await window.crypto.subtle.generateKey(
    keyAlgorithm(),
    true,
    ['sign', 'verify'],
  );

  return {
    privateKey: await window.crypto.subtle.exportKey('jwk', keypair.privateKey),
    publicKey: await window.crypto.subtle.exportKey('jwk', keypair.publicKey),
  };
}

export async function deviceKeypair(): Promise<StoredKeypair> {
  const stored = window.localStorage.getItem(DEVICE_KEY_STORAGE);

  if (stored) {
    return JSON.parse(stored) as StoredKeypair;
  }

  const keypair = await generateKeypair();
  window.localStorage.setItem(DEVICE_KEY_STORAGE, JSON.stringify(keypair));
  return keypair;
}

export async function signChallenge(
  privateKey: JsonWebKey,
  challenge: string,
): Promise<string> {
  const cryptoKey = await window.crypto.subtle.importKey(
    'jwk',
    privateKey,
    keyAlgorithm(),
    false,
    ['sign'],
  );
  const signature = await window.crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(challenge),
  );

  return encodeBase64Url(signature);
}

export function saveIdentityKeypair(playerId: string, keypair: StoredKeypair): void {
  const payload: StoredIdentityKeypair = { playerId, keypair };
  window.localStorage.setItem(IDENTITY_KEY_STORAGE, JSON.stringify(payload));
}

export function loadIdentityKeypair(playerId: string): StoredKeypair | null {
  try {
    const stored = window.localStorage.getItem(IDENTITY_KEY_STORAGE);

    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as StoredIdentityKeypair;

    if (
      parsed.playerId !== playerId
      || !parsed.keypair?.privateKey
      || !parsed.keypair?.publicKey
    ) {
      return null;
    }

    return parsed.keypair;
  } catch {
    return null;
  }
}

export function recoveryKeyFilename(playerName: string): string {
  const sanitized = playerName
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 64);

  const username = sanitized.length > 0 ? sanitized : 'Adventurer';
  return `Morkahja_${username}.key`;
}

export function downloadRecoveryKey(keypair: StoredKeypair, playerName: string): void {
  const file: RecoveryKeyFile = {
    kind: 'morkahja.identityKey',
    version: 1,
    privateKey: keypair.privateKey,
    publicKey: keypair.publicKey,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = recoveryKeyFilename(playerName);
  link.click();
  URL.revokeObjectURL(url);
}

export async function readRecoveryKey(file: File): Promise<RecoveryKeyFile> {
  const parsed = JSON.parse(await file.text()) as RecoveryKeyFile;

  if (parsed.kind !== 'morkahja.identityKey' || !parsed.privateKey || !parsed.publicKey) {
    throw new Error('Invalid Morkahja recovery key file.');
  }

  return parsed;
}
