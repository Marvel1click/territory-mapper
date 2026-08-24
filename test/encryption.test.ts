import { describe, expect, it } from 'vitest';
import { decryptDncValue, encryptDncValue, hashOpaqueToken, hashSensitiveLookup } from '@/app/lib/encryption/dnc';

describe('DNC encryption', () => {
  const key = Buffer.alloc(32, 7);

  it('round-trips AES-256-GCM values with a versioned envelope', () => {
    const encrypted = encryptDncValue('10 Example Street', 3, key);
    expect(encrypted.ciphertext).toMatch(/^v3\./);
    expect(encrypted.ciphertext).not.toContain('Example');
    expect(decryptDncValue(encrypted.ciphertext, key)).toBe('10 Example Street');
  });

  it('rejects tampering through the GCM authentication tag', () => {
    const encrypted = encryptDncValue('private note', 1, key).ciphertext;
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('a') ? 'b' : 'a'}`;
    expect(() => decryptDncValue(tampered, key)).toThrow();
  });

  it('normalizes sensitive lookup hashes and hashes tokens separately', () => {
    expect(hashSensitiveLookup(' 10 EXAMPLE Street ')).toBe(hashSensitiveLookup('10 example street'));
    expect(hashOpaqueToken('token-a')).not.toBe(hashOpaqueToken('token-b'));
  });
});
