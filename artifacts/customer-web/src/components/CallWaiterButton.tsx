import { useEffect, useState } from "react";
import { useCallWaiter } from "@workspace/api-client-react";
import { customerHeaders, type StoredCustomerSession } from "../session/storage";
import { apiErrorCode } from "../api/errors";
import { callWaiterSecondsRemaining } from "../lib/call-waiter-cooldown";

type CallWaiterButtonProps = {
  session: StoredCustomerSession;
};

export function CallWaiterButton({ session }: CallWaiterButtonProps) {
  const callWaiter = useCallWaiter({ request: { headers: customerHeaders(session) } });
  const [sentAtMs, setSentAtMs] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Ticks the cosmetic cooldown display down to zero. Non-blocking for the
  // rest of the dashboard — this is a local setInterval scoped to this
  // component only.
  useEffect(() => {
    if (sentAtMs === null) return;
    const tick = () => setSecondsRemaining(callWaiterSecondsRemaining(sentAtMs, Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [sentAtMs]);

  const isCoolingDown = sentAtMs !== null && secondsRemaining > 0;
  const isRateLimited = apiErrorCode(callWaiter.error) === "RATE_LIMITED";

  const handleClick = () => {
    callWaiter.mutate(
      { sessionId: session.tableSessionId },
      { onSuccess: () => setSentAtMs(Date.now()) },
    );
  };

  const disabled = callWaiter.isPending || isCoolingDown;

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:bg-neutral-300"
      >
        {callWaiter.isPending
          ? "Calling…"
          : isCoolingDown
            ? `Waiter notified (${secondsRemaining}s)`
            : "Call waiter"}
      </button>
      <div aria-live="polite">
        {callWaiter.isError ? (
          <p className="text-xs text-red-600">
            {isRateLimited
              ? "A waiter has already been called recently. Please wait a moment."
              : "Couldn't reach a waiter. Please try again."}
          </p>
        ) : null}
        {callWaiter.isSuccess && !callWaiter.isError ? (
          <p className="text-xs text-neutral-500">A waiter has been notified.</p>
        ) : null}
      </div>
    </div>
  );
}
