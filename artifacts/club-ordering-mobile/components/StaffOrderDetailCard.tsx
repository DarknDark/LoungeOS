import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListStaffTablesQueryKey,
  useUpdateOrderStatus,
  type Order,
  type OrderItem,
  type OrderStatus,
  type StaffTableOperations,
  type UpdateOrderStatusRequestStatus,
} from '@workspace/api-client-react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { clubSettings } from '@/config/clubSettings';
import colors from '@/constants/colors';
import { money } from './StaffOrderList';

// Phase 5 Checkpoint 5.2 (read-only detail) + 5.3 (status-transition
// actions). Actions call the existing useUpdateOrderStatus hook directly
// — no new fetcher, no custom endpoint, no change to OrderService or the
// backend state machine. Advancing accepted -> preparing relies entirely
// on the already-built order-lifecycle hook (Phase 4) that creates kitchen
// tickets as a side effect of that exact transition; nothing here
// duplicates or re-implements that.
//
// This component owns its own mutation instance and refreshes the same
// staff-tables query StaffOperationsDashboard.tsx already polls
// (getListStaffTablesQueryKey()), so no props/callbacks need to be
// threaded through StaffOperationsDashboard.tsx at all — it remains
// completely untouched by this checkpoint.

const clubHeaders = { 'X-Club-Id': clubSettings.clubId };

function shortOrderId(orderId: string): string {
  return orderId.slice(0, 8);
}

function formatElapsedSince(createdAt: string): string {
  const elapsedMs = Math.max(0, Date.now() - new Date(createdAt).getTime());
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  if (totalMinutes < 1) return 'just now';
  if (totalMinutes < 60) return `${totalMinutes} min ago`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} hr ${minutes} min ago` : `${hours} hr ago`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type OrderAction = { label: string; targetStatus: UpdateOrderStatusRequestStatus };

// Only the transitions this checkpoint was asked to expose: accept,
// start preparing, and cancel/reject from any non-terminal, staff-visible
// status. 'draft' (an unsubmitted customer cart) intentionally gets no
// actions — staff shouldn't act on an order the customer hasn't submitted
// yet. 'ready' can still be cancelled (matches ORDER_TRANSITIONS allowing
// cancellation from any non-terminal status) but has no forward action
// here, since advancing to 'delivered' wasn't part of this checkpoint's
// scope.
function nextOrderActions(status: OrderStatus): OrderAction[] {
  switch (status) {
    case 'submitted':
      return [
        { label: 'Accept Order', targetStatus: 'accepted' },
        { label: 'Reject', targetStatus: 'cancelled' },
      ];
    case 'accepted':
      return [
        { label: 'Start Preparing', targetStatus: 'preparing' },
        { label: 'Cancel Order', targetStatus: 'cancelled' },
      ];
    case 'preparing':
    case 'ready':
      return [{ label: 'Cancel Order', targetStatus: 'cancelled' }];
    default:
      return [];
  }
}

function isConflictError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'ApiError' &&
    'status' in error &&
    (error as { status?: unknown }).status === 409
  );
}

type StaffOrderDetailCardProps = {
  order: Order;
  items: OrderItem[];
  table: StaffTableOperations['table'];
  session: StaffTableOperations['session'];
};

export function StaffOrderDetailCard({ order, items, table, session }: StaffOrderDetailCardProps) {
  const queryClient = useQueryClient();
  const updateStatus = useUpdateOrderStatus({ request: { headers: clubHeaders } });
  const [actionError, setActionError] = useState<string | null>(null);
  const actions = nextOrderActions(order.status);

  const advance = async (targetStatus: UpdateOrderStatusRequestStatus) => {
    setActionError(null);
    try {
      await updateStatus.mutateAsync({
        orderId: order.id,
        data: { status: targetStatus, version: order.version ?? 0 },
      });
      await queryClient.invalidateQueries({ queryKey: getListStaffTablesQueryKey() });
    } catch (error) {
      if (isConflictError(error)) {
        setActionError('This order changed elsewhere. Refreshing…');
        await queryClient.invalidateQueries({ queryKey: getListStaffTablesQueryKey() });
      } else {
        setActionError(error instanceof Error ? error.message : 'Could not update this order.');
      }
    }
  };

  return (
    <View style={styles.detail}>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>ORDER</Text>
        <Text style={styles.metaValue}>#{shortOrderId(order.id)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>TABLE</Text>
        <Text style={styles.metaValue}>
          {table.label} · #{table.id.slice(0, 8)}
        </Text>
      </View>
      {session ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>SESSION</Text>
          <Text style={styles.metaValue}>
            #{session.id.slice(0, 8)} · {session.controllerType === 'staff' ? 'Waiter-controlled' : 'Customer-owned'}
          </Text>
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>SUBMITTED</Text>
        <Text style={styles.metaValue}>
          {formatTimestamp(order.createdAt)} · {formatElapsedSince(order.createdAt)}
        </Text>
      </View>

      <View style={styles.divider} />

      {items.map((item) => (
        <View style={styles.lineItem} key={item.id}>
          <View style={styles.lineItemHeader}>
            <Text style={styles.lineItemName}>
              {item.quantity}× {item.nameSnapshot}
            </Text>
            <Text style={styles.lineItemPrice}>{money(item.lineSubtotalMinor)}</Text>
          </View>
          <Text style={styles.lineItemUnit}>{money(item.unitPriceMinor)} each</Text>
          {item.notes ? <Text style={styles.lineItemNotes}>Note: {item.notes}</Text> : null}
        </View>
      ))}

      <View style={styles.divider} />

      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabel}>Subtotal</Text>
        <Text style={styles.totalsValue}>{money(order.subtotalMinor)}</Text>
      </View>
      {order.taxMinor > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>{money(order.taxMinor)}</Text>
        </View>
      ) : null}
      {order.serviceChargeMinor > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Service charge</Text>
          <Text style={styles.totalsValue}>{money(order.serviceChargeMinor)}</Text>
        </View>
      ) : null}
      {order.discountMinor > 0 ? (
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Discount</Text>
          <Text style={styles.totalsValue}>-{money(order.discountMinor)}</Text>
        </View>
      ) : null}
      <View style={styles.totalsRow}>
        <Text style={styles.totalsLabelStrong}>Total</Text>
        <Text style={styles.totalsValueStrong}>{money(order.totalMinor)}</Text>
      </View>
      {order.notes ? (
        <View style={styles.orderNotes}>
          <Text style={styles.metaLabel}>ORDER NOTE</Text>
          <Text style={styles.lineItemNotes}>{order.notes}</Text>
        </View>
      ) : null}

      {actions.length > 0 ? (
        <>
          <View style={styles.divider} />
          <View style={styles.actionsRow}>
            {actions.map((action) => (
              <Pressable
                key={action.targetStatus}
                disabled={updateStatus.isPending}
                onPress={() => void advance(action.targetStatus)}
                style={[
                  styles.actionButton,
                  action.targetStatus === 'cancelled' ? styles.actionButtonDanger : styles.actionButtonPrimary,
                  updateStatus.isPending ? styles.actionButtonDisabled : null,
                ]}
              >
                {updateStatus.isPending ? (
                  <ActivityIndicator size="small" color={colors.light.background} />
                ) : (
                  <Text
                    style={
                      action.targetStatus === 'cancelled'
                        ? styles.actionTextDanger
                        : styles.actionTextPrimary
                    }
                  >
                    {action.label}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
          {actionError ? (
            <Text style={styles.actionErrorText}>{actionError}</Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  detail: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.light.secondary,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 6,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { color: colors.light.mutedForeground, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  metaValue: { color: colors.light.foreground, fontSize: 11, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.light.border, marginVertical: 4 },
  lineItem: { gap: 2 },
  lineItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  lineItemName: { color: colors.light.foreground, fontSize: 12, fontWeight: '600', flex: 1, paddingRight: 8 },
  lineItemPrice: { color: colors.light.foreground, fontSize: 12, fontWeight: '600' },
  lineItemUnit: { color: colors.light.mutedForeground, fontSize: 10 },
  lineItemNotes: { color: colors.light.mutedForeground, fontSize: 10, fontStyle: 'italic', marginTop: 2 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalsLabel: { color: colors.light.mutedForeground, fontSize: 11 },
  totalsValue: { color: colors.light.mutedForeground, fontSize: 11 },
  totalsLabelStrong: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  totalsValueStrong: { color: colors.light.foreground, fontSize: 12, fontWeight: '700' },
  orderNotes: { marginTop: 4, gap: 2 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  actionButtonPrimary: { backgroundColor: colors.light.primary },
  actionButtonDanger: { backgroundColor: '#3d1c1c', borderWidth: 1, borderColor: '#7a3b3b' },
  actionButtonDisabled: { opacity: 0.6 },
  actionTextPrimary: { color: colors.light.background, fontSize: 12, fontWeight: '700' },
  actionTextDanger: { color: '#e08b8b', fontSize: 12, fontWeight: '700' },
  actionErrorText: { color: '#e08b8b', fontSize: 10, marginTop: 4 },
});
