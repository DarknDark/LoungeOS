/**
 * Firebase JS SDK client initialisation for staff authentication.
 *
 * Only the Firebase Auth service is used here.  All server-side operations
 * (token verification, Firestore access) continue to use the Admin SDK via
 * the API server.  These EXPO_PUBLIC_ values are public, non-secret client
 * configuration — safe to embed in the app bundle.
 *
 * Set the following environment variables in the Replit Secrets / Env panel:
 *   EXPO_PUBLIC_FIREBASE_API_KEY
 *   EXPO_PUBLIC_FIREBASE_PROJECT_ID
 *   EXPO_PUBLIC_FIREBASE_APP_ID
 *   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID  (optional, auth-only deployments)
 */

const _apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const _projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const _appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
const _senderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '';

/** True when all required client config env vars are present. */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(_apiKey && _projectId && _appId);
}

type FirebaseClientModule = typeof import('firebase/app') &
  typeof import('firebase/auth');

let _initialized = false;

/** Lazily initialise the Firebase app and return the auth instance. */
async function getAuth(): Promise<import('firebase/auth').Auth> {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getAuth: _getAuth } = await import('firebase/auth');

  if (!_initialized) {
    if (!_apiKey || !_projectId || !_appId) {
      throw new Error(
        'Firebase client config is missing. ' +
          'Set EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, ' +
          'and EXPO_PUBLIC_FIREBASE_APP_ID.',
      );
    }
    if (getApps().length === 0) {
      initializeApp({
        apiKey: _apiKey,
        authDomain: `${_projectId}.firebaseapp.com`,
        projectId: _projectId,
        storageBucket: `${_projectId}.appspot.com`,
        messagingSenderId: _senderId,
        appId: _appId,
      });
    }
    _initialized = true;
  }

  return _getAuth();
}

/** Sign in a staff member with email and password. */
export async function staffSignIn(
  email: string,
  password: string,
): Promise<import('firebase/auth').User> {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  const auth = await getAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/** Sign out the current staff member. */
export async function staffSignOut(): Promise<void> {
  const { signOut } = await import('firebase/auth');
  const auth = await getAuth();
  await signOut(auth);
}

/** Get a fresh Firebase ID token for the currently signed-in staff user. */
export async function getStaffIdToken(): Promise<string | null> {
  const auth = await getAuth();
  return auth.currentUser?.getIdToken() ?? null;
}

/** Subscribe to auth state changes.  Returns an unsubscribe function. */
export async function onStaffAuthStateChanged(
  callback: (user: import('firebase/auth').User | null) => void,
): Promise<() => void> {
  const { onAuthStateChanged } = await import('firebase/auth');
  const auth = await getAuth();
  return onAuthStateChanged(auth, callback);
}
