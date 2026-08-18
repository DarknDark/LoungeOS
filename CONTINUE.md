LoungeOS — CONTINUATION INSTRUCTIONS

PROJECT CHECKPOINT
3093068 — "Complete manual waiter tables"

CURRENT TASK
Implement ONLY Phase 3 Part 2 — Temporary Customer Dashboard.

IMPORTANT
Do NOT implement any other phase.
Do NOT modify unrelated completed functionality.

BEFORE CHANGING CODE
Read and understand:
1. HANDOFF.md
2. PROJECT_STATE.md
3. ROADMAP.md
4. ARCHITECTURE.md
5. Existing customer session APIs
6. Existing artifacts/customer-web directory

CUSTOMER DASHBOARD REQUIREMENTS

1. QR entry and validation.
2. Customer table-session handling.
3. If the table was manually opened by a waiter and approval is pending, show:

   "Please wait. Your waiter has been notified."

4. After approval, provide a limited customer dashboard with:
   - Running bill
   - Ordered items
   - Request song
   - Call waiter

STRICT CUSTOMER BOUNDARY

The customer dashboard MUST NOT allow:
- Ordering
- Payment
- Bill splitting
- Table closure

IMPLEMENTATION RULES

- Reuse existing backend APIs and domain logic wherever possible.
- Do not duplicate business logic in the frontend.
- Preserve the permanent QR architecture.
- Preserve staff authorization.
- Preserve realtime synchronization.
- Keep the customer surface isolated from the staff application.
- Do not remove or weaken existing tests.

WORK METHOD

1. Inspect first.
2. Create a clear implementation plan.
3. Implement in small steps.
4. Run relevant tests/typechecks after changes.
5. Do not make unrelated refactors.
6. At approximately every 5% of overall project progress, stop so we can create a Git backup checkpoint.
7. Report exactly what changed and what was verified before continuing.

FIRST ACTION

Do NOT immediately start coding.

First inspect the project and report:
- Current customer-web state
- Existing customer-session APIs available
- Existing types/interfaces that can be reused
- What needs to be created
- Your proposed implementation plan

Then wait for approval before making code changes.