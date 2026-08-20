// Formats "minor" currency amounts (the *Minor fields returned by the
// orders/table-session APIs) into a display string.
//
// The only club currently configured (DEFAULT_CLUB_SETTINGS in
// @workspace/domain) uses KES with minorUnit: 0 — i.e. amountMinor values
// are already whole-currency units, not cents. customer-web hardcodes that
// same currency/locale here rather than depending on @workspace/domain or
// fetching club settings (neither Order nor TableSession carry a currency
// field in the API). If LoungeOS ever supports multiple clubs/currencies,
// this should be sourced from club settings instead.
export type MoneyFormatOptions = {
  currency?: string;
  locale?: string;
  minorUnit?: number;
};

const DEFAULT_CURRENCY = "KES";
const DEFAULT_LOCALE = "en-KE";
const DEFAULT_MINOR_UNIT = 0;

export function formatMinorAmount(amountMinor: number, options?: MoneyFormatOptions): string {
  const currency = options?.currency ?? DEFAULT_CURRENCY;
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const minorUnit = options?.minorUnit ?? DEFAULT_MINOR_UNIT;
  const divisor = 10 ** minorUnit;
  const amount = amountMinor / divisor;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  }).format(amount);
}

export type BillTotals = {
  subtotalMinor: number;
  taxAndFeesMinor: number;
  discountMinor: number;
};

/**
 * Aggregates the subtotal/tax+fees/discount breakdown across a set of
 * orders. Cancelled orders are excluded, since they were never fulfilled
 * and shouldn't count toward what's currently owed.
 *
 * This is a breakdown of the *items ordered* — the authoritative amount
 * currently owed is TableSession.runningTotalMinor (it also accounts for
 * any payments already made), which is displayed separately rather than
 * re-derived here.
 */
export function calculateBillTotals(
  orders: ReadonlyArray<{
    status: string;
    subtotalMinor: number;
    taxMinor: number;
    serviceChargeMinor: number;
    discountMinor: number;
  }>,
): BillTotals {
  let subtotalMinor = 0;
  let taxAndFeesMinor = 0;
  let discountMinor = 0;
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    subtotalMinor += order.subtotalMinor;
    taxAndFeesMinor += order.taxMinor + order.serviceChargeMinor;
    discountMinor += order.discountMinor;
  }
  return { subtotalMinor, taxAndFeesMinor, discountMinor };
}
