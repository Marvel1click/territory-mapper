import CryptoJS from 'crypto-js';
import { logger } from '@/app/lib/utils/logger';

// Encryption key - must be set via environment variable
const ENCRYPTION_KEY = process.env.DNC_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('DNC_ENCRYPTION_KEY environment variable is required in production');
}

const resolvedKey = ENCRYPTION_KEY || 'dev-only-key-not-for-production';

// Encrypt a Do Not Call address
export function encryptDncAddress(address: string): string {
  if (!address) return '';
  
  try {
    // Use AES encryption with default CBC mode
    const encrypted = CryptoJS.AES.encrypt(address, resolvedKey);
    return encrypted.toString();
  } catch (error) {
    logger.error('[Encryption] Failed to encrypt DNC address:', error);
    throw new Error('Failed to encrypt sensitive data');
  }
}

// Decrypt a Do Not Call address
export function decryptDncAddress(encryptedAddress: string): string {
  if (!encryptedAddress) return '';
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedAddress, resolvedKey);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    logger.error('[Encryption] Failed to decrypt DNC address:', error);
    throw new Error('Failed to decrypt sensitive data');
  }
}

// Check if an address appears to be encrypted
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  // Encrypted values typically have a specific format with separators
  return value.includes('U2FsdGVk') || value.length > 50;
}

// Hash an address for comparison without exposing the actual address
export function hashAddress(address: string): string {
  return CryptoJS.SHA256(address.toLowerCase().trim()).toString();
}

// Generate a secure random key
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString();
}
