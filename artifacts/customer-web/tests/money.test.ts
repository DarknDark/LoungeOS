import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateBillTotals, formatMinorAmount } from "../src/lib/money";

test("formatMinorAmount formats a whole-unit KES amount with no decimals by default", () => {
  assert.equal(formatMinorAmount(1500), "Ksh 1,500");
});

test("formatMinorAmount formats zero", () => {
  assert.equal(formatMinorAmount(0), "Ksh 0");
});

test("formatMinorAmount respects a custom minorUnit (e.g. cents-based currency)", () => {
  assert.equal(
    formatMinorAmount(1550, { currency: "USD", locale: "en-US", minorUnit: 2 }),
    "$15.50",
  );
});

test("formatMinorAmount respects a custom currency/locale", () => {
  const result = formatMinorAmount(2000, { currency: "KES", locale: "en-KE", minorUnit: 0 });
  assert.equal(result, "Ksh 2,000");
});

function order(overrides: {
  status?: string;
  subtotalMinor?: number;
  taxMinor?: number;
  serviceChargeMinor?: number;
  discountMinor?: number;
}) {
  return {
    status: "submitted",
    subtotalMinor: 0,
    taxMinor: 0,
    serviceChargeMinor: 0,
    discountMinor: 0,
    ...overrides,
  };
}

test("calculateBillTotals sums subtotal, tax+serviceCharge, and discount across orders", () => {
  const totals = calculateBillTotals([
    order({ subtotalMinor: 1000, taxMinor: 160, serviceChargeMinor: 100, discountMinor: 0 }),
    order({ subtotalMinor: 500, taxMinor: 80, serviceChargeMinor: 50, discountMinor: 50 }),
  ]);
  assert.deepEqual(totals, {
    subtotalMinor: 1500,
    taxAndFeesMinor: 390,
    discountMinor: 50,
  });
});

test("calculateBillTotals excludes cancelled orders", () => {
  const totals = calculateBillTotals([
    order({ status: "submitted", subtotalMinor: 1000, taxMinor: 100 }),
    order({ status: "cancelled", subtotalMinor: 5000, taxMinor: 500 }),
  ]);
  assert.deepEqual(totals, {
    subtotalMinor: 1000,
    taxAndFeesMinor: 100,
    discountMinor: 0,
  });
});

test("calculateBillTotals returns zeros for an empty order list", () => {
  assert.deepEqual(calculateBillTotals([]), {
    subtotalMinor: 0,
    taxAndFeesMinor: 0,
    discountMinor: 0,
  });
});

test("calculateBillTotals treats every non-cancelled status the same way", () => {
  const statuses = ["draft", "submitted", "accepted", "preparing", "ready", "delivered"];
  for (const status of statuses) {
    const totals = calculateBillTotals([order({ status, subtotalMinor: 100 })]);
    assert.equal(totals.subtotalMinor, 100, `status ${status} should count toward the bill`);
  }
});
