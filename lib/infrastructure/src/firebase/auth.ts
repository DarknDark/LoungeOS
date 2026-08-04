import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAdmin } from './admin';

export type FirebaseStaffIdentity = {
  firebaseUid: string;
  token: DecodedIdToken;
};

export async function verifyFirebaseStaffToken(
  bearerToken: string,
): Promise<FirebaseStaffIdentity> {
  const token = bearerToken.trim();
  if (!token) {
    throw new Error('A Firebase staff bearer token is required.');
  }

  const decoded = await getFirebaseAdmin().auth.verifyIdToken(token);
  return {
    firebaseUid: decoded.uid,
    token: decoded,
  };
}

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}