import { calculateBillTotals } from "../lib/money";
import { formatMinorAmount } from "../lib/money";
import type { OrderResponse } from "@workspace/api-client-react";

type RunningBillCardProps = {
  orders: OrderResponse[];
  /** TableSession.runningTotalMinor — the authoritative amount currently
   * owed (accounts for any payments already made), shown as the total. */
  runningTotalMinor: number;
};

export function RunningBillCard({ orders, runningTotalMinor }: RunningBillCardProps) {
  const totals = calculateBillTotals(orders.map((entry) => entry.order));

  return (
    <section className="rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-semibold text-neutral-700">Your bill</h2>
      <dl className="mt-3 space-y-1.5 text-sm">
        <Row label="Subtotal" value={formatMinorAmount(totals.subtotalMinor)} />
        <Row label="Taxes &amp; fees" value={formatMinorAmount(totals.taxAndFeesMinor)} />
        {totals.discountMinor > 0 ? (
          <Row label="Discount" value={`-${formatMinorAmount(totals.discountMinor)}`} />
        ) : null}
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-neutral-200 pt-3">
        <dt className="text-sm font-semibold">Total due</dt>
        <dd className="text-lg font-semibold">{formatMinorAmount(runningTotalMinor)}</dd>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-neutral-600">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
