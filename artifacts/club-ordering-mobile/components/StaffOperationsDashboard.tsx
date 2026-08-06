import React, { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  type StaffTableOperations,
  useApproveStaffTableSessionJoin,
  useCloseStaffTableSession,
  createStaffOrder,
  useListOrderMenu,
  useListStaffTables,
  useOpenManualStaffTableSession,
  useReopenStaffTableSession,
  useVerifyPayment,
} from '@workspace/api-client-react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { clubSettings } from '@/config/clubSettings';
import colors from '@/constants/colors';
import { configureStaffAuthTokenProvider, isStaffAuthConfigured } from '@/services/staff-auth';
import {
  isFirebaseClientConfigured,
  staffSignIn,
  staffSignOut,
  getStaffIdToken,
  onStaffAuthStateChanged,
} from '@/services/firebase-client';

const headers = { 'X-Club-Id': clubSettings.clubId };

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

function Icon({
  name,
  size = 17,
  color = colors.light.foreground,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function Action({
  label,
  icon,
  onPress,
  disabled,
  primary = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, primary && styles.actionPrimary, disabled && styles.disabled]}
    >
      <Icon name={icon} size={14} color={primary ? colors.light.background : colors.light.primary} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function TableCard({
  item,
  busy,
  onOrder,
  onVerify,
  onApprove,
  onReopen,
  onClose,
}: {
  item: StaffTableOperations;
  busy: boolean;
  onOrder: () => void;
  onVerify: (paymentId: string) => void;
  onApprove: (customerSessionId: string) => void;
  onReopen: () => void;
  onClose: () => void;
}) {
  const session = item.session;
  const finishing = item.table.status === 'finishing';
  const submitted = item.payments.filter((payment) => payment.status === 'submitted');

  return (
    <View style={styles.tableCard}>
      <View style={styles.tableHeader}>
        <View>
          <Text style={styles.tableName}>{item.table.label}</Text>
          <Text style={styles.tableMeta}>
            {session
              ? `${session.controllerType === 'staff' ? 'Waiter-controlled' : 'Customer-owned'} · ${item.customerSessions.length} guest${item.customerSessions.length === 1 ? '' : 's'}`
              : 'No active session'}
          </Text>
        </View>
        <View style={[styles.status, finishing ? styles.statusGold : styles.statusGreen]}>
          <Text style={styles.statusText}>{finishing ? 'FINISHING UP' : item.table.status.toUpperCase()}</Text>
        </View>
      </View>

      {session ? (
        <>
          <View style={styles.summary}>
            <View><Text style={styles.label}>RUNNING BILL</Text><Text style={styles.value}>{money(session.runningTotalMinor)}</Text></View>
            <View><Text style={styles.label}>ORDERS</Text><Text style={styles.value}>{item.orders.length}</Text></View>
            <View><Text style={styles.label}>GUESTS</Text><Text style={styles.value}>{item.customerSessions.length}</Text></View>
          </View>

          {submitted.map((payment) => (
            <View style={styles.request} key={payment.id}>
              <View style={styles.requestCopy}>
                <Text style={styles.requestTitle}>Payment waiting · {money(payment.amountMinor)}</Text>
                <Text style={styles.requestMeta}>{payment.method.toUpperCase()} · waiter verification required</Text>
              </View>
              <Action label="Confirm" icon="checkmark" primary disabled={busy} onPress={() => onVerify(payment.id)} />
            </View>
          ))}

          {item.joinRequests.map((customer) => (
            <View style={styles.request} key={customer.id}>
              <View style={styles.requestCopy}>
                <Text style={styles.requestTitle}>Guest wants to join</Text>
                <Text style={styles.requestMeta}>Temporary, read-only access pending approval</Text>
              </View>
              <Action label="Approve" icon="person-add-outline" primary disabled={busy} onPress={() => onApprove(customer.id)} />
            </View>
          ))}

          <View style={styles.actionRow}>
            {!finishing ? (
              <Action label="Add order" icon="add-circle-outline" disabled={busy} onPress={onOrder} />
            ) : null}
            {finishing ? (
              <>
                <Action label="Reopen Tab" icon="refresh-outline" disabled={busy} onPress={onReopen} />
                <Action label="Close Table" icon="lock-closed-outline" disabled={busy || submitted.length > 0} onPress={onClose} />
              </>
            ) : null}
          </View>
        </>
      ) : (
        <Text style={styles.emptyCopy}>Available for a new QR session or manual waiter opening.</Text>
      )}
    </View>
  );
}

export default function StaffOperationsDashboard() {
  const queryClient = useQueryClient();
  const [authReady, setAuthReady] = useState(isStaffAuthConfigured());
  const enabled = authReady;
  const [message, setMessage] = useState('');
  const [orderTableId, setOrderTableId] = useState<string | null>(null);

  // Sign-in form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');
  const firebaseConfigured = isFirebaseClientConfigured();

  // Wire up Firebase auth state so the dashboard unlocks automatically after
  // sign-in and locks again when the user signs out.
  useEffect(() => {
    if (!firebaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    onStaffAuthStateChanged((user) => {
      if (user) {
        configureStaffAuthTokenProvider(() => user.getIdToken());
        setAuthReady(true);
      } else {
        configureStaffAuthTokenProvider(null);
        setAuthReady(false);
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    });
    return () => unsubscribe?.();
  }, [firebaseConfigured]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) return;
    setSigningIn(true);
    setSignInError('');
    try {
      await staffSignIn(email.trim(), password);
      // onStaffAuthStateChanged will call configureStaffAuthTokenProvider + setAuthReady
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed.';
      setSignInError(msg.replace(/\(auth\/[^)]+\)\s*\.?/, '').trim());
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await staffSignOut();
    } catch {
      // auth state listener will handle cleanup
      configureStaffAuthTokenProvider(null);
      setAuthReady(false);
    }
  };
  const staffTables = useListStaffTables({
    query: {
      queryKey: ['/api/v1/staff/tables'],
      enabled,
      refetchInterval: enabled ? 5000 : false,
    },
    request: { headers },
  });
  const menu = useListOrderMenu({
    query: {
      queryKey: ['/api/v1/orders/menu'],
      enabled: enabled && orderTableId !== null,
    },
    request: { headers },
  });
  const verify = useVerifyPayment();
  const approve = useApproveStaffTableSessionJoin();
  const reopen = useReopenStaffTableSession();
  const close = useCloseStaffTableSession();
  const manual = useOpenManualStaffTableSession();
  const busy = verify.isPending || approve.isPending || reopen.isPending || close.isPending || manual.isPending;
  const tables = staffTables.data?.tables ?? [];
  const finishing = useMemo(() => tables.filter((item) => item.table.status === 'finishing'), [tables]);
  const available = useMemo(() => tables.filter((item) => item.table.status === 'available'), [tables]);
  const orderTable = tables.find((item) => item.table.id === orderTableId) ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: staffTables.queryKey });
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The operation failed.');
    }
  };

  if (!enabled) {
    if (!firebaseConfigured) {
      return (
        <View style={styles.locked}>
          <View style={styles.lockIcon}><Icon name="lock-closed-outline" size={24} color={colors.light.primary} /></View>
          <Text style={styles.lockedTitle}>Staff sign-in not configured</Text>
          <Text style={styles.lockedCopy}>
            Add your Firebase web app credentials to enable staff authentication.
          </Text>
          <Text style={styles.lockedHint}>
            Set EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, and
            EXPO_PUBLIC_FIREBASE_APP_ID in your environment variables.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.locked}>
        <View style={styles.lockIcon}><Icon name="person-circle-outline" size={24} color={colors.light.primary} /></View>
        <Text style={styles.lockedTitle}>Waiter sign-in</Text>
        <Text style={styles.lockedCopy}>Sign in with your Firebase staff account to manage tables and payments.</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.light.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!signingIn}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.light.mutedForeground}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!signingIn}
          onSubmitEditing={handleSignIn}
        />
        {signInError ? <Text style={styles.signInError}>{signInError}</Text> : null}
        <Action
          label={signingIn ? 'Signing in…' : 'Sign in'}
          icon="log-in-outline"
          primary
          disabled={signingIn || !email.trim() || !password}
          onPress={handleSignIn}
        />
      </View>
    );
  }

  if (staffTables.isLoading) {
    return <View style={styles.loading}><ActivityIndicator color={colors.light.primary} /><Text style={styles.emptyCopy}>Loading live tables…</Text></View>;
  }

  if (staffTables.isError) {
    return (
      <View style={styles.locked}>
        <Icon name="alert-circle-outline" size={24} color={colors.light.destructive} />
        <Text style={styles.lockedTitle}>Staff operations unavailable</Text>
        <Text style={styles.lockedCopy}>The protected live table feed could not be loaded. Check Firebase staff membership and retry.</Text>
        <Action label="Retry" icon="refresh-outline" primary onPress={() => void staffTables.refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.dashboard}>
      <View style={styles.dashboardHeader}>
        <View><Text style={styles.kicker}>LIVE WAITER DESK</Text><Text style={styles.title}>Keep the room moving.</Text></View>
        <View style={styles.headerActions}>
          <Pressable style={styles.refresh} onPress={() => void staffTables.refetch()}><Icon name="refresh-outline" color={colors.light.primary} /></Pressable>
          <Pressable style={styles.refresh} onPress={() => void handleSignOut()}><Icon name="log-out-outline" color={colors.light.mutedForeground} /></Pressable>
        </View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.label}>FINISHING</Text><Text style={styles.value}>{finishing.length}</Text></View>
        <View style={styles.metric}><Text style={styles.label}>AVAILABLE</Text><Text style={styles.value}>{available.length}</Text></View>
        <View style={styles.metric}><Text style={styles.label}>TABLES</Text><Text style={styles.value}>{tables.length}</Text></View>
      </View>

      <Text style={styles.section}>Finishing Up</Text>
      {finishing.length ? finishing.map((item) => (
        <TableCard
          key={item.table.id}
          item={item}
          busy={busy}
          onOrder={() => setOrderTableId(item.table.id)}
          onVerify={(paymentId) => void run(() => verify.mutateAsync({ paymentId }), 'Payment confirmed.')}
          onApprove={(customerSessionId) => void run(() => approve.mutateAsync({ sessionId: item.session?.id ?? '', data: { customerSessionId } }), 'Guest approved.')}
          onReopen={() => void run(() => reopen.mutateAsync({ sessionId: item.session?.id ?? '' }), 'Tab reopened.')}
          onClose={() => void run(() => close.mutateAsync({ sessionId: item.session?.id ?? '' }), 'Table closed and released.')}
        />
      )) : <View style={styles.empty}><Text style={styles.emptyTitle}>No tables waiting for settlement</Text><Text style={styles.emptyCopy}>Payment and close requests will appear here in real time.</Text></View>}

      <Text style={styles.section}>Room Tables</Text>
      {tables.filter((item) => item.table.status !== 'finishing').map((item) => (
        <TableCard
          key={item.table.id}
          item={item}
          busy={busy}
          onOrder={() => setOrderTableId(item.table.id)}
          onVerify={(paymentId) => void run(() => verify.mutateAsync({ paymentId }), 'Payment confirmed.')}
          onApprove={(customerSessionId) => void run(() => approve.mutateAsync({ sessionId: item.session?.id ?? '', data: { customerSessionId } }), 'Guest approved.')}
          onReopen={() => void run(() => reopen.mutateAsync({ sessionId: item.session?.id ?? '' }), 'Tab reopened.')}
          onClose={() => void run(() => close.mutateAsync({ sessionId: item.session?.id ?? '' }), 'Table closed and released.')}
        />
      ))}

      {available.length ? (
        <View style={styles.manual}>
          <Text style={styles.section}>Open Manual Table</Text>
          <Text style={styles.emptyCopy}>Use this for a waiter-controlled tab before a guest scans.</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.manualRow}>
            {available.map((item) => (
              <Action
                key={item.table.id}
                label={`Open ${item.table.label}`}
                icon="hand-left-outline"
                disabled={busy}
                onPress={() => void run(() => manual.mutateAsync({ data: { tableId: item.table.id } }), `${item.table.label} opened.`)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      {orderTable?.session ? (
        <View style={styles.manual}>
          <Text style={styles.section}>Add order to {orderTable.table.label}</Text>
          {menu.isLoading ? <ActivityIndicator color={colors.light.primary} /> : null}
          {(menu.data?.items ?? []).map((item) => (
            <Action
              key={item.id}
              label={`${item.name} · ${money(item.priceMinor)}`}
              icon="add-outline"
              disabled={busy}
              onPress={() => {
                void run(
                  () =>
                    createStaffOrder(
                      {
                        clubId: clubSettings.clubId,
                        tableSessionId: orderTable.session!.id,
                        items: [{ menuItemId: item.id, quantity: 1 }],
                      },
                      {
                        headers: {
                          ...headers,
                          'Idempotency-Key': `waiter-${Date.now()}-${item.id}`,
                        },
                      },
                    ),
                  `${item.name} added to ${orderTable.table.label}.`,
                );
              }}
            />
          ))}
          {!menu.isLoading && !menu.data?.items.length ? (
            <Text style={styles.emptyCopy}>No available menu items.</Text>
          ) : null}
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dashboard: { gap: 14 },
  dashboardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: colors.light.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: colors.light.foreground, fontSize: 26, lineHeight: 32, fontWeight: '700', marginTop: 5 },
  refresh: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.accent, borderWidth: 1, borderColor: colors.light.border },
  metrics: { flexDirection: 'row', gap: 9 },
  metric: { flex: 1, padding: 13, borderRadius: 15, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  label: { color: colors.light.mutedForeground, fontSize: 8, fontWeight: '800', letterSpacing: 1.1 },
  value: { color: colors.light.foreground, fontSize: 21, fontWeight: '700', marginTop: 7 },
  section: { color: colors.light.foreground, fontSize: 16, fontWeight: '700', marginTop: 3 },
  tableCard: { padding: 15, borderRadius: 19, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, gap: 13 },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  tableName: { color: colors.light.foreground, fontSize: 16, fontWeight: '700' },
  tableMeta: { color: colors.light.mutedForeground, fontSize: 11, marginTop: 4 },
  status: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 9 },
  statusGreen: { backgroundColor: '#183321' },
  statusGold: { backgroundColor: '#3d2d19' },
  statusText: { color: '#8bd6a1', fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  summary: { flexDirection: 'row', gap: 20 },
  request: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderRadius: 13, backgroundColor: colors.light.secondary, borderWidth: 1, borderColor: colors.light.border },
  requestCopy: { flex: 1 },
  requestTitle: { color: colors.light.foreground, fontSize: 11, fontWeight: '700' },
  requestMeta: { color: colors.light.mutedForeground, fontSize: 10, marginTop: 3 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.light.border, backgroundColor: colors.light.secondary },
  actionPrimary: { backgroundColor: colors.light.primary, borderColor: colors.light.primary },
  actionText: { color: colors.light.primary, fontSize: 10, fontWeight: '700' },
  actionTextPrimary: { color: colors.light.background },
  disabled: { opacity: 0.45 },
  empty: { padding: 18, borderRadius: 17, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border },
  emptyTitle: { color: colors.light.foreground, fontSize: 14, fontWeight: '700' },
  emptyCopy: { color: colors.light.mutedForeground, fontSize: 11, lineHeight: 16, marginTop: 4 },
  manual: { padding: 15, borderRadius: 17, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, gap: 9 },
  manualRow: { gap: 8 },
  message: { color: '#9fe0b0', fontSize: 11, fontWeight: '600', padding: 11, borderRadius: 12, backgroundColor: '#1b3225' },
  locked: { padding: 22, borderRadius: 21, backgroundColor: colors.light.card, borderWidth: 1, borderColor: colors.light.border, alignItems: 'center', gap: 10 },
  lockIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.accent },
  lockedTitle: { color: colors.light.foreground, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  lockedCopy: { color: colors.light.mutedForeground, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  lockedHint: { color: colors.light.primary, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: colors.light.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.light.foreground, backgroundColor: colors.light.secondary, fontSize: 14 },
  signInError: { color: colors.light.destructive, fontSize: 11, textAlign: 'center' },
  loading: { minHeight: 150, alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerActions: { flexDirection: 'row', gap: 8 },
});