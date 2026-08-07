import { createHash, randomBytes } from 'node:crypto';

export function createSecureToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSecureToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}