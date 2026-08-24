import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getStaffIdToken,
  isFirebaseClientConfigured,
  onStaffAuthStateChanged,
  staffSignIn,
  staffSignOut,
} from "./firebase-client";

type AuthState = {
  status: "loading" | "signed-out" | "signed-in";
  email: string | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Fetches a fresh ID token for the current request — Firebase's SDK
   * handles refresh-token rotation internally, so callers should call this
   * per-request rather than caching a token long-term. */
  getIdToken(): Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setStatus("signed-out");
      return;
    }
    let unsubscribe: (() => void) | undefined;
    onStaffAuthStateChanged((user) => {
      setStatus(user ? "signed-in" : "signed-out");
      setEmail(user?.email ?? null);
    }).then((unsub) => {
      unsubscribe = unsub;
    });
    return () => unsubscribe?.();
  }, []);

  const value: AuthState = {
    status,
    email,
    async signIn(signInEmail, password) {
      await staffSignIn(signInEmail, password);
    },
    async signOut() {
      await staffSignOut();
    },
    async getIdToken() {
      return getStaffIdToken();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
