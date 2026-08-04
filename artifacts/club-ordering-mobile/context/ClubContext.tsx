import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AppState, Linking, Platform, type AppStateStatus } from 'react-native';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ClubSettings } from '@workspace/domain';
import {
  cancelOrder as cancelOrderRequest,
  createCustomerTableSession,
  createOrderDraft,
  getCustomerTableSessionStatus,
  heartbeatCustomerTableSession,
  joinCustomerTableSession,
  listOrderMenu,
  listOrders,
  recoverCustomerTableSession,
  submitOrder as submitOrderRequest,
  type Order as ApiOrder,
  type OrderMenuResponse,
  type OrderResponse,
  type TableSessionAccess,
} from '@workspace/api-client-react';
import { clubSettings } from '@/config/clubSettings';
import { featureFlagsFromSettings, type LoungeFeatureFlags } from '@/config/featureFlags';
import { loungeAnalytics } from '@/services/analytics';
import {
  getNotificationRegistration,
  requestNotificationRegistration,
  type NotificationRegistration,
} from '@/services/notifications';
import type {
  CartItem,
  ClubOrder,
  MenuCategory,
  MenuItem,
  OrderStatus,
  SongRequest,
  StaffMode,
  WaiterCall,
} from './types';

export type {
  CartItem,
  ClubOrder,
  MenuCategory,
  MenuItem,
  OrderStatus,
  SongRequest,
  StaffMode,
  WaiterCall,
} from './types';

const SESSION_KEY = 'loungeos-customer-session-v1';
const CART_KEY = 'loungeos-cart-v1';
const QUEUE_KEY = 'loungeos-order-queue-v1';
const DEVICE_KEY = 'loungeos-device-v1';

type StoredSession = {
  clubId: string;
  tableSessionId: string;
  customerSessionId: string;
  tableNumber?: number;
};

type SecureSession = StoredSession & { recoveryToken: string };

type PendingOrder = {
  idempotencyKey: string;
  payload: {
    clubId: string;
    tableSessionId: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifiers?: Array<{ modifierId: string; optionIds: string[] }>;
    }>;
  };
};

type ClubContextValue = {
  tableNumber?: number;
  clubSettings: ClubSettings;
  featureFlags: LoungeFeatureFlags;
  menu: MenuItem[];
  menuCategories: MenuCategory[];
  cart: CartItem[];
  orders: ClubOrder[];
  songRequests: SongRequest[];
  waiterCalls: WaiterCall[];
  selectedMode: StaffMode;
  billTotal: number;
  cartCount: number;
  sessionActive: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  isOnline: boolean;
  errorMessage: string;
  pendingOrderCount: number;
  notificationRegistration: NotificationRegistration | null;
  addToCart: (item: MenuItem) => void;
  changeQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  submitOrder: () => Promise<boolean>;
  requestSong: (song: string, artist: string) => void;
  callWaiter: () => void;
  payBill: (method: 'mpesa' | 'cash') => void;
  markOrderStatus: (orderId: string, status: OrderStatus) => void;
  markOrderPaid: (orderId: string) => void;
  cancelOrder: (orderId: string) => Promise<boolean>;
  updateSongStatus: (requestId: string, status: SongRequest['status']) => void;
  removeSongRequest: (requestId: string) => void;
  setSelectedMode: (mode: StaffMode) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  enableNotifications: () => Promise<NotificationRegistration>;
  resetSession: () => Promise<void>;
};

const ClubContext = createContext<ClubContextValue | null>(null);

function displayAmount(minor: number): number {
  const unit = clubSettings.currency.minorUnit;
  return unit > 0 ? minor / 10 ** unit : minor;
}

function imageForItem(category: string): MenuItem['image'] {
  return category.toLowerCase().includes('drink')
    ? require('@/assets/images/smoked-old-fashioned.jpg')
    : require('@/assets/images/truffle-fries.jpg');
}

function accentForItem(category: string): string {
  return category.toLowerCase().includes('drink') ? '#a85e38' : '#d49a4a';
}

function headersForSession(session: SecureSession): HeadersInit {
  return {
    'X-Club-Id': session.clubId,
    'X-Table-Session-Id': session.tableSessionId,
    'X-Customer-Session-Id': session.customerSessionId,
    'X-Customer-Session-Token': session.recoveryToken,
  };
}

function menuFromResponse(response: OrderMenuResponse): {
  menu: MenuItem[];
  categories: MenuCategory[];
} {
  const categoriesById = new Map(response.categories.map((category) => [category.id, category.name]));
  const categories = response.categories
    .filter((category) => category.active)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((category) => category.name);
  const menu = response.items
    .filter((item) => item.available)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((item) => {
      const category = categoriesById.get(item.categoryId ?? '') ?? 'Menu';
      return {
        id: item.id,
        name: item.name,
        description: item.description ?? '',
        category,
        price: displayAmount(item.priceMinor),
        image: item.imageUrl ? { uri: item.imageUrl } : imageForItem(category),
        accent: accentForItem(category),
        available: item.available,
      };
    });
  return { menu, categories };
}

function orderFromResponse(
  response: OrderResponse,
  menuById: Map<string, MenuItem>,
  round: number,
): ClubOrder {
  const items = response.items.map((item) => {
    const known = menuById.get(item.menuItemId);
    return {
      id: item.menuItemId,
      name: item.nameSnapshot,
      description: known?.description ?? '',
      category: known?.category ?? 'Menu',
      price: displayAmount(item.unitPriceMinor),
      image: known?.image ?? imageForItem(known?.category ?? 'Menu'),
      accent: known?.accent ?? '#a85e38',
      popular: known?.popular,
      quantity: item.quantity,
    };
  });
  return {
    id: response.order.id,
    round,
    createdAt: new Date(response.order.createdAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    }),
    status: response.order.status,
    items,
    total: displayAmount(response.order.totalMinor),
    paid: false,
  };
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/network|fetch|timeout|failed to connect/i.test(message)) {
    return 'You appear to be offline. Your order will retry when the connection returns.';
  }
  if (/SESSION|session/i.test(message)) {
    return 'Your table session is no longer active. Scan the table QR code again to continue.';
  }
  return message.replace(/^HTTP \d+ [^:]+:\s*/i, '') || 'Something went wrong. Please try again.';
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function deviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = newId('device');
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

async function readSecureSession(): Promise<SecureSession | null> {
  const value = Platform.OS === 'web'
    ? await AsyncStorage.getItem(SESSION_KEY)
    : await SecureStore.getItemAsync(SESSION_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as SecureSession;
  } catch {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    return null;
  }
}

async function saveSecureSession(access: TableSessionAccess, clubId: string): Promise<SecureSession> {
  const session: SecureSession = {
    clubId,
    tableSessionId: access.tableSession.id,
    customerSessionId: access.customerSession.id,
    recoveryToken: access.recoveryToken,
    tableNumber: undefined,
  };
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }
  return session;
}

async function readInitialSessionLink(): Promise<{
  clubId: string;
  tableId?: string;
  qrToken?: string;
  sessionId?: string;
} | null> {
  const url = await Linking.getInitialURL();
  if (!url) return null;
  const parsed = new URL(url);
  const params = parsed.searchParams;
  const clubId = params.get('clubId') ?? clubSettings.clubId;
  const tableId = params.get('tableId') ?? undefined;
  const qrToken = params.get('qrToken') ?? undefined;
  const sessionId = params.get('sessionId') ?? undefined;
  if (!tableId && !sessionId) return null;
  return { clubId, tableId, qrToken, sessionId };
}

export function ClubProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SecureSession | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<ClubOrder[]>([]);
  const [songRequests, setSongRequests] = useState<SongRequest[]>([]);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [selectedMode, setSelectedMode] = useState<StaffMode>('guest');
  const [runningBillMinor, setRunningBillMinor] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [notificationRegistration, setNotificationRegistration] =
    useState<NotificationRegistration | null>(null);

  const featureFlags = useMemo(() => featureFlagsFromSettings(clubSettings), []);

  const persistQueue = useCallback(async (queue: PendingOrder[]) => {
    setPendingOrders(queue);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    setIsLoading(true);
    try {
      const requestHeaders = headersForSession(session);
      const [menuResponse, orderResponse, statusResponse] = await Promise.all([
        listOrderMenu({
          headers: { 'X-Club-Id': session.clubId },
          responseType: 'json',
        }),
        listOrders({ headers: requestHeaders, responseType: 'json' }),
        getCustomerTableSessionStatus(session.tableSessionId, {
          headers: requestHeaders,
          responseType: 'json',
        }),
      ]);
      const adapted = menuFromResponse(menuResponse);
      const menuById = new Map(adapted.menu.map((item) => [item.id, item]));
      setMenu(adapted.menu);
      setMenuCategories(adapted.categories);
      setOrders(
        orderResponse.orders.map((order, index) => orderFromResponse(order, menuById, index + 1)),
      );
      setRunningBillMinor(statusResponse.tableSession.runningTotalMinor);
      setSession((current) => (current ? { ...current, tableNumber: undefined } : current));
      setIsOnline(true);
      setErrorMessage('');
    } catch (error) {
      setIsOnline(false);
      setErrorMessage(friendlyError(error));
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  const flushQueue = useCallback(async () => {
    if (!session || !pendingOrders.length) return;
    const remaining: PendingOrder[] = [];
    for (const pending of pendingOrders) {
      try {
        const draft = await createOrderDraft(pending.payload, {
          headers: {
            ...headersForSession(session),
            'Idempotency-Key': pending.idempotencyKey,
          },
          responseType: 'json',
        });
        await submitOrderRequest(draft.order.id, { version: draft.order.version ?? 0 }, {
          headers: headersForSession(session),
          responseType: 'json',
        });
      } catch {
        remaining.push(pending);
      }
    }
    await persistQueue(remaining);
    if (remaining.length !== pendingOrders.length) await refresh();
  }, [pendingOrders, persistQueue, refresh, session]);

  const applyAccess = useCallback(async (access: TableSessionAccess, clubId: string) => {
    const nextSession = await saveSecureSession(access, clubId);
    setSession(nextSession);
    setErrorMessage('');
    return nextSession;
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      readSecureSession(),
      AsyncStorage.getItem(CART_KEY),
      AsyncStorage.getItem(QUEUE_KEY),
      readInitialSessionLink(),
    ])
      .then(async ([stored, savedCart, savedQueue, link]) => {
        if (!active) return;
        if (savedCart) {
          try {
            setCart(JSON.parse(savedCart) as CartItem[]);
          } catch {
            await AsyncStorage.removeItem(CART_KEY);
          }
        }
        if (savedQueue) {
          try {
            setPendingOrders(JSON.parse(savedQueue) as PendingOrder[]);
          } catch {
            await AsyncStorage.removeItem(QUEUE_KEY);
          }
        }
        let accessSession = stored;
        if (link?.tableId && link.qrToken) {
          try {
            const access = await createCustomerTableSession({
              clubId: link.clubId,
              tableId: link.tableId,
              qrToken: link.qrToken,
              deviceId: await deviceId(),
            }, { responseType: 'json' });
            accessSession = await applyAccess(access, link.clubId);
          } catch (error) {
            setErrorMessage(friendlyError(error));
          }
        } else if (link?.sessionId && link.qrToken) {
          try {
            const access = await joinCustomerTableSession(link.sessionId, {
              clubId: link.clubId,
              qrToken: link.qrToken,
              deviceId: await deviceId(),
            }, { responseType: 'json' });
            accessSession = await applyAccess(access, link.clubId);
          } catch (error) {
            setErrorMessage(friendlyError(error));
          }
        } else if (stored) {
          try {
            const access = await recoverCustomerTableSession({
              clubId: stored.clubId,
              customerSessionId: stored.customerSessionId,
              recoveryToken: stored.recoveryToken,
              deviceId: await deviceId(),
            }, { responseType: 'json' });
            accessSession = await applyAccess(access, stored.clubId);
          } catch (error) {
            setErrorMessage(friendlyError(error));
            if (Platform.OS === 'web') {
              await AsyncStorage.removeItem(SESSION_KEY);
            } else {
              await SecureStore.deleteItemAsync(SESSION_KEY);
            }
            accessSession = null;
          }
        }
        if (active && accessSession) setSession(accessSession);
      })
      .catch((error) => {
        if (active) setErrorMessage(friendlyError(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyAccess]);

  useEffect(() => {
    if (!session) return;
    void refresh();
    void flushQueue();
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        setIsOnline(true);
        void refresh();
        void flushQueue();
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    const heartbeat = setInterval(async () => {
      try {
        const access = await heartbeatCustomerTableSession(session.tableSessionId, {
          clubId: session.clubId,
          customerSessionId: session.customerSessionId,
        }, { headers: headersForSession(session), responseType: 'json' });
        await applyAccess(access, session.clubId);
      } catch (error) {
        setErrorMessage(friendlyError(error));
      }
    }, 120_000);
    return () => {
      subscription.remove();
      clearInterval(heartbeat);
    };
  }, [applyAccess, flushQueue, refresh, session]);

  useEffect(() => {
    AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch(() => undefined);
  }, [cart]);

  const addToCart = useCallback((item: MenuItem) => {
    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      return existing
        ? current.map((entry) => entry.id === item.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry)
        : [...current, { ...item, quantity: 1 }];
    });
    loungeAnalytics.emit({
      event: 'item_added',
      clubId: session?.clubId,
      tableSessionId: session?.tableSessionId,
      menuItemId: item.id,
    });
  }, [session]);

  const submitOrder = useCallback(async () => {
    if (!cart.length) return false;
    if (!session) {
      setErrorMessage('Scan the table QR code before sending an order.');
      return false;
    }
    const pending: PendingOrder = {
      idempotencyKey: newId('order'),
      payload: {
        clubId: session.clubId,
        tableSessionId: session.tableSessionId,
        items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
      },
    };
    setIsSubmitting(true);
    try {
      const draft = await createOrderDraft(pending.payload, {
        headers: {
          ...headersForSession(session),
          'Idempotency-Key': pending.idempotencyKey,
        },
        responseType: 'json',
      });
      const submitted = await submitOrderRequest(
        draft.order.id,
        { version: draft.order.version ?? 0 },
        { headers: headersForSession(session), responseType: 'json' },
      );
      const menuById = new Map(menu.map((item) => [item.id, item]));
      setOrders((current) => [
        ...current,
        orderFromResponse(submitted, menuById, current.length + 1),
      ]);
      setCart([]);
      loungeAnalytics.emit({
        event: 'order_submitted',
        clubId: session.clubId,
        tableSessionId: session.tableSessionId,
        orderId: submitted.order.id,
      });
      await refresh();
      return true;
    } catch (error) {
      await persistQueue([...pendingOrders, pending]);
      setIsOnline(false);
      setErrorMessage(friendlyError(error));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [cart, menu, pendingOrders, persistQueue, refresh, session]);

  const cancelOrder = useCallback(async (orderId: string) => {
    if (!session) return false;
    try {
      await cancelOrderRequest(orderId, { reason: 'Cancelled by customer' }, {
        headers: headersForSession(session),
        responseType: 'json',
      });
      await refresh();
      return true;
    } catch (error) {
      setErrorMessage(friendlyError(error));
      return false;
    }
  }, [refresh, session]);

  const resetSession = useCallback(async () => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(SESSION_KEY);
    } else {
      await SecureStore.deleteItemAsync(SESSION_KEY);
    }
    await AsyncStorage.multiRemove([CART_KEY, QUEUE_KEY]);
    setSession(null);
    setCart([]);
    setOrders([]);
    setMenu([]);
    setMenuCategories([]);
    setPendingOrders([]);
    setRunningBillMinor(0);
    setSelectedMode('guest');
  }, []);

  const value = useMemo<ClubContextValue>(() => ({
    tableNumber: session?.tableNumber,
    clubSettings,
    featureFlags,
    menu,
    menuCategories,
    cart,
    orders,
    songRequests,
    waiterCalls,
    selectedMode,
    billTotal: displayAmount(runningBillMinor),
    cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
    sessionActive: Boolean(session),
    isLoading,
    isSubmitting,
    isOnline,
    errorMessage,
    pendingOrderCount: pendingOrders.length,
    notificationRegistration,
    addToCart,
    changeQuantity: (itemId, delta) => setCart((current) => current
      .map((item) => item.id === itemId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0)),
    removeFromCart: (itemId) => setCart((current) => current.filter((item) => item.id !== itemId)),
    submitOrder,
    requestSong: () => setErrorMessage('Song requests are not connected to the live service yet.'),
    callWaiter: () => setErrorMessage('Waiter calls are not connected to the live service yet.'),
    payBill: () => setErrorMessage('Payments are not connected to the live service yet.'),
    markOrderStatus: () => setErrorMessage('Staff authentication is required to update order status.'),
    markOrderPaid: () => setErrorMessage('Payments are not connected to the live service yet.'),
    cancelOrder,
    updateSongStatus: () => setErrorMessage('Song requests are not connected to the live service yet.'),
    removeSongRequest: () => setErrorMessage('Song requests are not connected to the live service yet.'),
    setSelectedMode,
    refresh,
    clearError: () => setErrorMessage(''),
    enableNotifications: async () => {
      const registration = await requestNotificationRegistration();
      setNotificationRegistration(registration);
      return registration;
    },
    resetSession,
  }), [
    addToCart,
    cancelOrder,
    cart,
    errorMessage,
    featureFlags,
    isLoading,
    isOnline,
    menu,
    menuCategories,
    notificationRegistration,
    orders,
    pendingOrders.length,
    refresh,
    resetSession,
    runningBillMinor,
    selectedMode,
    session,
    songRequests,
    submitOrder,
    waiterCalls,
  ]);

  useEffect(() => {
    if (!featureFlags.pushNotifications) return;
    getNotificationRegistration()
      .then(setNotificationRegistration)
      .catch(() => undefined);
  }, [featureFlags.pushNotifications]);

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) throw new Error('useClub must be used inside ClubProvider');
  return context;
}