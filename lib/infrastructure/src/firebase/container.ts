import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import { getFirebaseAdmin } from './admin';

export type FirebaseInfrastructureContainer = {
  provider: 'firebase';
  firestore: Firestore;
  auth: Auth;
};

/**
 * Composition root for Firebase-backed infrastructure.
 *
 * It is intentionally lazy: importing the API does not read credentials. The
 * first operation that needs persistence or authentication gets a clear
 * FirebaseConfigurationError instead of silently selecting another provider.
 */
export function createFirebaseInfrastructure(): FirebaseInfrastructureContainer {
  const clients = getFirebaseAdmin();
  return {
    provider: 'firebase',
    firestore: clients.firestore,
    auth: clients.auth,
  };
}