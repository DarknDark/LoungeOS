import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";

export default function SignInPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError("Sign-in failed. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex h-full items-center justify-center bg-neutral-950 p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-6"
      >
        <h1 className="text-lg font-semibold text-white">Kitchen Display</h1>
        <label htmlFor="kds-email" className="sr-only">
          Email
        </label>
        <input
          id="kds-email"
          type="email"
          placeholder="Staff email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500"
        />
        <label htmlFor="kds-password" className="sr-only">
          Password
        </label>
        <input
          id="kds-password"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder:text-neutral-500"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        {error ? (
          <p className="text-xs text-red-400" aria-live="polite">
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
