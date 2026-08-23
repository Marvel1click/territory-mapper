import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedValue {
  ciphertext: string;
  keyVersion: number;
}

function decodeKey(value: string): Buffer {
  const key = Buffer.from(value, 'base64');
  if (key.byteLength !== 32) {
    throw new Error('A DNC encryption key must be exactly 32 bytes in base64 form.');
  }
  return key;
}

function getConfiguredKey(version: number): Buffer {
  const value = process.env[`DNC_ENCRYPTION_KEY_V${version}`];
  if (!value) throw new Error(`DNC encryption key version ${version} is not configured.`);
  return decodeKey(value);
}

export function activeDncKeyVersion(): number {
  const version = Number(process.env.DNC_ENCRYPTION_KEY_VERSION ?? '1');
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('DNC_ENCRYPTION_KEY_VERSION must be a positive integer.');
  }
  return version;
}

export function encryptDncValue(
  plaintext: string,
  keyVersion = activeDncKeyVersion(),
  suppliedKey?: Buffer,
): EncryptedValue {
  const key = suppliedKey ?? getConfiguredKey(keyVersion);
  if (key.byteLength !== 32) throw new Error('Invalid DNC encryption key length.');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: [
      `v${keyVersion}`,
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.'),
    keyVersion,
  };
}

export function decryptDncValue(ciphertext: string, suppliedKey?: Buffer): string {
  const [versionPart, ivPart, tagPart, encryptedPart] = ciphertext.split('.');
  const keyVersion = Number(versionPart?.replace(/^v/, ''));
  if (!keyVersion || !ivPart || !tagPart || !encryptedPart) {
    throw new Error('Invalid encrypted DNC value.');
  }
  const key = suppliedKey ?? getConfiguredKey(keyVersion);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function hashSensitiveLookup(value: string): string {
  return createHash('sha256').update(value.trim().toLocaleLowerCase('en')).digest('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}
