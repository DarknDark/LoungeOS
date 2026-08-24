import assert from "node:assert/strict";
import { test } from "node:test";
import type { KitchenTicket } from "@workspace/api-client-react";
import { groupTicketsByColumn } from "../src/tickets/board-columns";

function ticket(overrides: Partial<KitchenTicket> & { id: string; status: KitchenTicket["status"] }): KitchenTicket {
  return {
    clubId: "club-1",
    orderId: "order-1",
    stationId: "kitchen",
    orderItemIds: ["item-1"],
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

test("groupTicketsByColumn buckets tickets by status", () => {
  const tickets = [
    ticket({ id: "t1", status: "new" }),
    ticket({ id: "t2", status: "preparing" }),
    ticket({ id: "t3", status: "ready" }),
  ];
  const grouped = groupTicketsByColumn(tickets);
  assert.equal(grouped.new.length, 1);
  assert.equal(grouped.preparing.length, 1);
  assert.equal(grouped.ready.length, 1);
});

test("groupTicketsByColumn drops collected tickets from the board", () => {
  const tickets = [ticket({ id: "t1", status: "collected" })];
  const grouped = groupTicketsByColumn(tickets);
  assert.equal(grouped.new.length, 0);
  assert.equal(grouped.preparing.length, 0);
  assert.equal(grouped.ready.length, 0);
});

test("groupTicketsByColumn sorts each column oldest-first", () => {
  const tickets = [
    ticket({ id: "t1", status: "new", createdAt: "2026-08-04T12:05:00.000Z" }),
    ticket({ id: "t2", status: "new", createdAt: "2026-08-04T12:00:00.000Z" }),
    ticket({ id: "t3", status: "new", createdAt: "2026-08-04T12:02:00.000Z" }),
  ];
  const grouped = groupTicketsByColumn(tickets);
  assert.deepEqual(
    grouped.new.map((t) => t.id),
    ["t2", "t3", "t1"],
  );
});

test("groupTicketsByColumn handles an empty ticket list", () => {
  const grouped = groupTicketsByColumn([]);
  assert.deepEqual(grouped, { new: [], preparing: [], ready: [] });
});
