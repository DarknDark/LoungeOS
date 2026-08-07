import { setAuthTokenGetter, type AuthTokenGetter } from '@workspace/api-client-react';

let provider: AuthTokenGetter | null = null;

/**
 * Staff identity must come from a real Firebase client sign-in flow.
 * Customer table sessions are never promoted to staff credentials.
 */
export function configureStaffAuthTokenProvider(next: AuthTokenGetter | null): void {
  provider = next;
  setAuthTokenGetter(next);
}

export function isStaffAuthConfigured(): boolean {
  return provider !== null;
}