import React from 'react';
import { type Order, type OrderItem, type StaffTableOperations } from '@workspace/api-client-react';
import { StyleSheet, Text, View } from 'react-native';
import colors from '@/constants/colors';
import { money } from './StaffOrderList';

// Phase 5 Checkpoint 5.2 — read-only order detail/line-item inspection.
// No status-mutation controls here (Checkpoint 5.3's scope) — this view
// exists purely so staff can inspect what's actually in an order before
// acting on it. All data comes from the OrderResponse StaffOrderList
// already has (order + items), plus the owning table/session for context
// — no new fetching.

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

type StaffOrderDetailCardProps = {
  order: Order;
  items: OrderItem[];
  table: StaffTableOperations['table'];
  session: StaffTableOperations['session'];
};

export function StaffOrderDetailCard({ order, items, table, session }: StaffOrderDetailCardProps) {
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
});
