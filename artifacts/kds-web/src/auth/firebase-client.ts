/**
 * Firebase JS SDK client initialisation for staff authentication.
 *
 * Only the Firebase Auth service is used here. All server-side operations
 * (token verification, Firestore access) continue to use the Admin SDK via
 * the API server. These VITE_ values are public, non-secret client
 * configuration — safe to embed in the app bundle.
 *
 * This mirrors the pattern used by
 * artifacts/club-ordering-mobile/services/firebase-client.ts (read there
 * only as a reference for the lazy-init/dynamic-import technique — never
 * imported), adapted from Expo's `process.env.EXPO_PUBLIC_*` convention to
 * Vite's `import.meta.env.VITE_*` convention.
 *
 * Set the following environment variables (e.g. in a .env.local file):
 *   VITE_FIREBASE_API_KEY
 *   VITE_FIREBASE_PROJECT_ID
 *   VITE_FIREBASE_APP_ID
 *   VITE_FIREBASE_MESSAGING_SENDER_ID  (optional, auth-only deployments)
 */

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const appId = import.meta.env.VITE_FIREBASE_APP_ID as string | undefined;
const senderId = (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined) ?? "";

/** True when all required client config env vars are present. */
export function isFirebaseClientConfigured(): boolean {
  return Boolean(apiKey && projectId && appId);
}

let initialized = false;

/** Lazily initialise the Firebase app and return the auth instance. */
async function getAuth(): Promise<import("firebase/auth").Auth> {
  const { initializeApp, getApps } = await import("firebase/app");
  const { getAuth: getFirebaseAuth } = await import("firebase/auth");

  if (!initialized) {
    if (!apiKey || !projectId || !appId) {
      throw new Error(
        "Firebase client config is missing. " +
          "Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, and VITE_FIREBASE_APP_ID.",
      );
    }
    if (getApps().length === 0) {
      initializeApp({
        apiKey,
        authDomain: `${projectId}.firebaseapp.com`,
        projectId,
        storageBucket: `${projectId}.appspot.com`,
        messagingSenderId: senderId,
        appId,
      });
    }
    initialized = true;
  }

  return getFirebaseAuth();
}

/** Sign in a staff member with email and password. */
export async function staffSignIn(
  email: string,
  password: string,
): Promise<import("firebase/auth").User> {
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const auth = await getAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/** Sign out the current staff member. */
export async function staffSignOut(): Promise<void> {
  const { signOut } = await import("firebase/auth");
  const auth = await getAuth();
  await signOut(auth);
}

/** Get a fresh Firebase ID token for the currently signed-in staff user. */
export async function getStaffIdToken(): Promise<string | null> {
  const auth = await getAuth();
  return (await auth.currentUser?.getIdToken()) ?? null;
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export async function onStaffAuthStateChanged(
  callback: (user: import("firebase/auth").User | null) => void,
): Promise<() => void> {
  const { onAuthStateChanged } = await import("firebase/auth");
  const auth = await getAuth();
  return onAuthStateChanged(auth, callback);
}
