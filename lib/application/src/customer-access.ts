import type { CustomerSession } from '@workspace/domain';

/**
 * Reasons a customer session may be denied a mutating or restricted action.
 *
 * - `ACCESS_TEMPORARY_READ_ONLY`: the customer joined a staff-controlled
 *   (waiter-opened) table and has not been upgraded past temporary access.
 * - `ACCESS_PENDING_APPROVAL`: the customer's join request has not yet been
 *   approved by staff.
 */
export type CustomerAccessViolation =
  | 'ACCESS_TEMPORARY_READ_ONLY'
  | 'ACCESS_PENDING_APPROVAL';

/**
 * Shared, side-effect-free rule for whether a customer session may perform a
 * restricted (non-read-only) action on its table session.
 *
 * This mirrors the access-level gate already enforced by
 * `TableSessionService`'s internal `activeSession` helper
 * (see `table-sessions.ts`), so that every customer-facing engine applies the
 * same "temporary/pending access is read-only" rule instead of each
 * reimplementing it independently.
 *
 * Callers remain responsible for constructing and throwing their own
 * engine-specific error type from the returned violation, so this helper
 * does not alter any existing error contracts.
 */
export function checkCustomerAccessLevel(
  customer: Pick<CustomerSession, 'accessLevel' | 'approvalStatus'>,
  allowTemporaryReadOnly = false,
): CustomerAccessViolation | null {
  if (allowTemporaryReadOnly) return null;
  if (customer.accessLevel === 'temporary') return 'ACCESS_TEMPORARY_READ_ONLY';
  if (customer.approvalStatus !== 'approved') return 'ACCESS_PENDING_APPROVAL';
  return null;
}
