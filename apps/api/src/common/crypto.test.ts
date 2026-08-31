import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generateSessionId } from './crypto.js';

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a GitHub access token', () => {
    const token = 'gho_' + 'x'.repeat(36);
    const encrypted = encryptSecret(token);
    expect(decryptSecret(encrypted)).toBe(token);
  });

  it('produces a different ciphertext each time (random IV) for the same plaintext', () => {
    const a = encryptSecret('same-value');
    const b = encryptSecret('same-value');
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
  });

  it('fails to decrypt if the auth tag has been tampered with', () => {
    const encrypted = encryptSecret('secret-token');
    const tampered = { ...encrypted, authTag: Buffer.from('0'.repeat(32), 'hex').toString('base64') };
    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe('generateSessionId', () => {
  it('generates unique, sufficiently long ids', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(30);
  });
});
