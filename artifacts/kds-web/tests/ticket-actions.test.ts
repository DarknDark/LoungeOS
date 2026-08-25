import assert from "node:assert/strict";
import { test } from "node:test";
import type { KitchenTicket, KitchenTicketListResponse } from "@workspace/api-client-react";
import { nextActionsFor, replaceTicketStatus } from "../src/tickets/ticket-actions";

test("nextActionsFor returns two actions for a 'new' ticket (preparing and ready)", () => {
  const actions = nextActionsFor("new");
  assert.deepEqual(
    actions.map((a) => a.targetStatus),
    ["preparing", "ready"],
  );
});

test("nextActionsFor returns one action for a 'preparing' ticket (ready)", () => {
  const actions = nextActionsFor("preparing");
  assert.deepEqual(
    actions.map((a) => a.targetStatus),
    ["ready"],
  );
});

test("nextActionsFor returns one action for a 'ready' ticket (collected)", () => {
  const actions = nextActionsFor("ready");
  assert.deepEqual(
    actions.map((a) => a.targetStatus),
    ["collected"],
  );
});

test("nextActionsFor returns no actions for a 'collected' ticket", () => {
  assert.deepEqual(nextActionsFor("collected"), []);
});

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

test("replaceTicketStatus updates only the targeted ticket", () => {
  const data: KitchenTicketListResponse = {
    kitchenTickets: [
      ticket({ id: "t1", status: "new" }),
      ticket({ id: "t2", status: "new" }),
    ],
  };
  const result = replaceTicketStatus(data, "t1", "preparing");
  assert.equal(result?.kitchenTickets[0].status, "preparing");
  assert.equal(result?.kitchenTickets[1].status, "new");
});

test("replaceTicketStatus leaves other ticket fields untouched", () => {
  const data: KitchenTicketListResponse = {
    kitchenTickets: [ticket({ id: "t1", status: "new", orderItemIds: ["a", "b"] })],
  };
  const result = replaceTicketStatus(data, "t1", "ready");
  assert.deepEqual(result?.kitchenTickets[0].orderItemIds, ["a", "b"]);
  assert.equal(result?.kitchenTickets[0].orderId, "order-1");
});

test("replaceTicketStatus returns the data unchanged when the ticket id is not found", () => {
  const data: KitchenTicketListResponse = {
    kitchenTickets: [ticket({ id: "t1", status: "new" })],
  };
  const result = replaceTicketStatus(data, "unknown-ticket", "ready");
  assert.deepEqual(result, data);
});

test("replaceTicketStatus returns undefined unchanged when there is no cached data yet", () => {
  assert.equal(replaceTicketStatus(undefined, "t1", "ready"), undefined);
});

test("replaceTicketStatus does not mutate the original array reference", () => {
  const data: KitchenTicketListResponse = {
    kitchenTickets: [ticket({ id: "t1", status: "new" })],
  };
  const result = replaceTicketStatus(data, "t1", "preparing");
  assert.notEqual(result, data);
  assert.notEqual(result?.kitchenTickets, data.kitchenTickets);
  assert.equal(data.kitchenTickets[0].status, "new");
});
