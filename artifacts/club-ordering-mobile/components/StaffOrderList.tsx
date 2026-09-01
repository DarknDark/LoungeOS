import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { type StaffTableOperations } from '@workspace/api-client-react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { clubSettings } from '@/config/clubSettings';
import colors from '@/constants/colors';
import { StaffOrderDetailCard } from './StaffOrderDetailCard';

// Phase 5 Checkpoint 5.1 (shell) + 5.2 (detail inspection) + 5.3 (status
// actions, in StaffOrderDetailCard.tsx) + 5.4 (polish). Groups and
// displays each table's active/submitted orders using data
// StaffOperationsDashboard.tsx already fetches via useListStaffTables (no
// duplicate fetcher, no new hook). Tapping an order's header expands it
// into a full StaffOrderDetailCard (metadata, itemized line items, and
// status-transition actions).
//
// The expand/collapse toggle (a Pressable) and the expanded detail card
// are siblings, not nested — StaffOrderDetailCard has its own interactive
// Pressable buttons, and nesting one Pressable inside another is a known
// source of ambiguous tap handling in React Native.

export function money(minor: number) {
  try {
    return new Intl.NumberFormat(clubSettings.currency.locale, {
      style: 'currency',
      currency: clubSettings.currency.code,
      maximumFractionDigits: clubSettings.currency.minorUnit,
    }).format(minor / 10 ** clubSettings.currency.minorUnit);
  } catch {
    return `${clubSettings.currency.code} ${(minor / 100).toLocaleString()}`;
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

// Matches the same "active order" filter already used in the
// customer-facing tab (app/(tabs)/index.tsx): anything not yet delivered
// or cancelled.
function isActiveOrder(status: string): boolean {
  return status !== 'delivered' && status !== 'cancelled';
}

type TableWithActiveOrders = {
  table: StaffTableOperations['table'];
  session: StaffTableOperations['session'];
  orders: StaffTableOperations['orders'];
};

export function StaffOrderList({ tables }: { tables: StaffTableOperations[] }) {
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (orderId: string) => {
    setExpandedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const tablesWithActiveOrders = useMemo<TableWithActiveOrders[]>(() => {
    return tables
      .map((item) => ({
        table: item.table,
        session: item.session,
        orders: item.orders.filter((entry) => isActiveOrder(entry.order.status)),
      }))
      .filter((entry) => entry.orders.length > 0);
  }, [tables]);

  if (tablesWithActiveOrders.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No active orders</Text>
        <Text style={styles.emptyCopy}>Orders waiting on the kitchen or bar will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {tablesWithActiveOrders.map(({ table, session, orders }) => (
        <View style={styles.tableGroup} key={table.id}>
          <Text style={styles.tableLabel}>{table.label}</Text>
          {orders.map(({ order, items }) => {
            const expanded = expandedOrderIds.has(order.id);
            return (
              <View key={order.id} style={styles.orderCard}>
                <Pressable
                  onPress={() => toggleExpanded(order.id)}
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? 'Collapse order details' : 'Expand order details'}
                >
                  <View style={styles.orderHeader}>
                    <StatusBadge status={order.status} />
                    <View style={styles.orderHeaderRight}>
                      <Text style={styles.orderTotal}>{money(order.totalMinor)}</Text>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.light.mutedForeground}
                      />
                    </View>
                  </View>
                  <Text style={styles.orderItems}>
                    {items.length > 0
                      ? items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(', ')
                      : 'No items recorded'}
                  </Text>
                </Pressable>
                {expanded ? (
                  <StaffOrderDetailCard order={order} items={items} table={table} session={session} />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const STATUS_COLORS: Record<string, { background: string; foreground: string }> = {
  submitted: { background: '#3d2d19', foreground: '#e0b877' },
  accepted: { background: '#3d2d19', foreground: '#e0b877' },
  preparing: { background: '#1c2c3d', foreground: '#7fb2e0' },
  ready: { background: '#183321', foreground: '#8bd6a1' },
};

function StatusBadge({ status }: { status: string }) {
  const palette = STATUS_COLORS[status] ?? { background: colors.light.secondary, foreground: colors.light.mutedForeground };
  return (
    <View style={[styles.status, { backgroundColor: palette.background }]}>
      <Ionicons name="ellipse" size={7} color={palette.foreground} />
      <Text style={[styles.statusText, { color: palette.foreground }]}>
        {(STATUS_LABELS[status] ?? status).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  tableGroup: { gap: 6 },
  tableLabel: { color: colors.light.mutedForeground, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  orderCard: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
    gap: 6,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderTotal: { color: colors.light.foreground, fontSize: 13, fontWeight: '700' },
  orderItems: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  empty: {
    padding: 18,
    borderRadius: 17,
    backgroundColor: colors.light.card,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  emptyTitle: { color: colors.light.foreground, fontSize: 14, fontWeight: '700' },
  emptyCopy: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16, marginTop: 4 },
});
