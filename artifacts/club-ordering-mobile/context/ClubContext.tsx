import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ClubSettings } from '@workspace/domain';
import { clubSettings } from '@/config/clubSettings';
import {
  DEMO_STORAGE_KEY,
  DEMO_TABLE_NUMBER,
  demoMenu,
  demoOrders,
  demoSongRequests,
} from './demoFixtures';
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

type ClubContextValue = {
  tableNumber: number;
  clubSettings: ClubSettings;
  menu: MenuItem[];
  cart: CartItem[];
  orders: ClubOrder[];
  songRequests: SongRequest[];
  waiterCalls: WaiterCall[];
  selectedMode: StaffMode;
  billTotal: number;
  cartCount: number;
  addToCart: (item: MenuItem) => void;
  changeQuantity: (itemId: string, delta: number) => void;
  removeFromCart: (itemId: string) => void;
  submitOrder: () => void;
  requestSong: (song: string, artist: string) => void;
  callWaiter: () => void;
  payBill: (method: 'mpesa' | 'cash') => void;
  markOrderStatus: (orderId: string, status: OrderStatus) => void;
  markOrderPaid: (orderId: string) => void;
  updateSongStatus: (requestId: string, status: SongRequest['status']) => void;
  removeSongRequest: (requestId: string) => void;
  setSelectedMode: (mode: StaffMode) => void;
  resetSession: () => void;
};

const ClubContext = createContext<ClubContextValue | null>(null);

const totalForItems = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export function ClubProvider({ children }: PropsWithChildren) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<ClubOrder[]>(demoOrders);
  const [songRequests, setSongRequests] = useState<SongRequest[]>(demoSongRequests);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [selectedMode, setSelectedMode] = useState<StaffMode>('guest');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEMO_STORAGE_KEY)
      .then((value) => {
        if (!value) return;
        const saved = JSON.parse(value) as Partial<{
          cart: CartItem[];
          orders: ClubOrder[];
          songRequests: SongRequest[];
          waiterCalls: WaiterCall[];
          selectedMode: StaffMode;
        }>;
        if (saved.cart) setCart(saved.cart);
        if (saved.orders) setOrders(saved.orders);
        if (saved.songRequests) setSongRequests(saved.songRequests);
        if (saved.waiterCalls) setWaiterCalls(saved.waiterCalls);
        if (saved.selectedMode) setSelectedMode(saved.selectedMode);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({ cart, orders, songRequests, waiterCalls, selectedMode }),
    ).catch(() => undefined);
  }, [cart, orders, songRequests, waiterCalls, selectedMode, hydrated]);

  const value = useMemo<ClubContextValue>(
    () => ({
      tableNumber: DEMO_TABLE_NUMBER,
      clubSettings,
      menu: demoMenu,
      cart,
      orders,
      songRequests,
      waiterCalls,
      selectedMode,
      billTotal: orders.reduce((sum, order) => sum + order.total, 0),
      cartCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      addToCart: (item) =>
        setCart((current) => {
          const existing = current.find((entry) => entry.id === item.id);
          if (existing) {
            return current.map((entry) =>
              entry.id === item.id
                ? { ...entry, quantity: entry.quantity + 1 }
                : entry,
            );
          }
          return [...current, { ...item, quantity: 1 }];
        }),
      changeQuantity: (itemId, delta) =>
        setCart((current) =>
          current
            .map((item) =>
              item.id === itemId
                ? { ...item, quantity: item.quantity + delta }
                : item,
            )
            .filter((item) => item.quantity > 0),
        ),
      removeFromCart: (itemId) =>
        setCart((current) => current.filter((item) => item.id !== itemId)),
      submitOrder: () => {
        if (!cart.length) return;
        setOrders((current) => [
          ...current,
          {
            id: `round-${current.length + 1}`,
            round: current.length + 1,
            createdAt: 'Just now',
            status: 'new',
            items: cart,
            total: totalForItems(cart),
            paid: false,
          },
        ]);
        setCart([]);
      },
      requestSong: (song, artist) => {
        if (!song.trim() || !artist.trim()) return;
        setSongRequests((current) => [
          ...current,
          {
            id: `song-${Date.now()}`,
            song: song.trim(),
            artist: artist.trim(),
            status: 'queued',
          },
        ]);
      },
      callWaiter: () =>
        setWaiterCalls((current) => [
          ...current,
          { id: `call-${Date.now()}`, createdAt: 'Just now', resolved: false },
        ]),
      payBill: (method) => {
        if (method === 'cash') return;
        setOrders((current) => current.map((order) => ({ ...order, paid: true })));
      },
      markOrderStatus: (orderId, status) =>
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, status } : order)),
        ),
      markOrderPaid: (orderId) =>
        setOrders((current) =>
          current.map((order) => (order.id === orderId ? { ...order, paid: true } : order)),
        ),
      updateSongStatus: (requestId, status) =>
        setSongRequests((current) =>
          current.map((request) =>
            request.id === requestId ? { ...request, status } : request,
          ),
        ),
      removeSongRequest: (requestId) =>
        setSongRequests((current) => current.filter((request) => request.id !== requestId)),
      setSelectedMode,
      resetSession: () => {
        setCart([]);
        setOrders(demoOrders);
        setSongRequests(demoSongRequests);
        setWaiterCalls([]);
        setSelectedMode('guest');
      },
    }),
    [cart, orders, songRequests, waiterCalls, selectedMode, hydrated],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  const context = useContext(ClubContext);
  if (!context) throw new Error('useClub must be used inside ClubProvider');
  return context;
}