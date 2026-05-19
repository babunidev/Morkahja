const DEVICE_KEY_STORAGE = 'morkahja.deviceKeypair';
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

export function downloadRecoveryKey(keypair: StoredKeypair): void {
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
  link.download = 'morkahja.key';
  link.click();
  URL.revokeObjectURL(url);
}

export async function readRecoveryKey(file: File): Promise<RecoveryKeyFile> {
  const parsed = JSON.parse(await file.text()) as RecoveryKeyFile;

  if (parsed.kind !== 'morkahja.identityKey' || !parsed.privateKey || !parsed.publicKey) {
    throw new Error('Invalid morkahja.key file.');
  }

  return parsed;
}
