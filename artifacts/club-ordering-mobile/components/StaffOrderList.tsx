import React, { useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { type StaffTableOperations } from '@workspace/api-client-react';
import { StyleSheet, Text, View } from 'react-native';
import { clubSettings } from '@/config/clubSettings';
import colors from '@/constants/colors';

// Phase 5 Checkpoint 5.1 — shell only. This component is intentionally
// read-only: it groups and displays each table's active/submitted orders
// using data StaffOperationsDashboard.tsx already fetches via
// useListStaffTables (no duplicate fetcher, no new hook), with no
// status-change actions yet. Status-advance controls (submitted ->
// accepted -> preparing -> ready -> delivered, using the existing
// useUpdateOrderStatus hook) are a later checkpoint's scope.

function money(minor: number) {
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
  orders: StaffTableOperations['orders'];
};

export function StaffOrderList({ tables }: { tables: StaffTableOperations[] }) {
  const tablesWithActiveOrders = useMemo<TableWithActiveOrders[]>(() => {
    return tables
      .map((item) => ({
        table: item.table,
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
      {tablesWithActiveOrders.map(({ table, orders }) => (
        <View style={styles.tableGroup} key={table.id}>
          <Text style={styles.tableLabel}>{table.label}</Text>
          {orders.map(({ order, items }) => (
            <View style={styles.orderCard} key={order.id}>
              <View style={styles.orderHeader}>
                <StatusBadge status={order.status} />
                <Text style={styles.orderTotal}>{money(order.totalMinor)}</Text>
              </View>
              <Text style={styles.orderItems}>
                {items.map((item) => `${item.quantity}× ${item.nameSnapshot}`).join(', ')}
              </Text>
            </View>
          ))}
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
