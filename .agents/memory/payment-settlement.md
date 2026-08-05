---
name: Payment settlement
description: LoungeOS payment submission, verification, and table-closure rules.
---

Customer Pay Now supports cash and till as submitted payment records that require waiter verification before closure. M-Pesa must return an explicit unavailable state until a real transport is connected.

**Why:** A payment request is not proof of settlement, and allowing a waiter to close a table before verification would create an unpaid or ambiguous bill.

**How to apply:** Keep payment records separate from table-session state; require verified totals to equal the current running balance, reject submitted/unverified branches during closure, and expire every customer session when the waiter closes the table.