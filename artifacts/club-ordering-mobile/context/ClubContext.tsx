import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type MenuCategory = 'Drinks' | 'Food';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed';
export type StaffMode = 'guest' | 'waiter' | 'bartender' | 'dj' | 'admin';

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  price: number;
  image: number;
  accent: string;
  popular?: boolean;
};

export type CartItem = MenuItem & { quantity: number };

export type ClubOrder = {
  id: string;
  round: number;
  createdAt: string;
  status: OrderStatus;
  items: CartItem[];
  total: number;
  paid: boolean;
};

export type SongRequest = {
  id: string;
  song: string;
  artist: string;
  status: 'queued' | 'playing' | 'played' | 'skipped';
};

export type WaiterCall = {
  id: string;
  createdAt: string;
  resolved: boolean;
};

const STORAGE_KEY = 'nightfall-club-session-v1';

export const menu: MenuItem[] = [
  {
    id: 'spritz',
    name: 'Nightfall Spritz',
    description: 'Passionfruit, citrus, prosecco',
    category: 'Drinks',
    price: 850,
    image: require('@/assets/images/smoked-old-fashioned.jpg'),
    accent: '#d39a3b',
    popular: true,
  },
  {
    id: 'old-fashioned',
    name: 'Smoked Old Fashioned',
    description: 'Bourbon, bitters, orange',
    category: 'Drinks',
    price: 1200,
    image: require('@/assets/images/smoked-old-fashioned.jpg'),
    accent: '#a85e38',
  },
  {
    id: 'gin-tonic',
    name: 'Juniper & Tonic',
    description: 'Gin, elderflower, tonic',
    category: 'Drinks',
    price: 900,
    image: require('@/assets/images/smoked-old-fashioned.jpg'),
    accent: '#799b77',
  },
  {
    id: 'truffle-fries',
    name: 'Truffle Fries',
    description: 'Parmesan, herbs, aioli',
    category: 'Food',
    price: 750,
    image: require('@/assets/images/truffle-fries.jpg'),
    accent: '#d49a4a',
    popular: true,
  },
  {
    id: 'slider-trio',
    name: 'Slider Trio',
    description: 'Beef, chicken, house pickles',
    category: 'Food',
    price: 1400,
    image: require('@/assets/images/truffle-fries.jpg'),
    accent: '#9a5a4b',
  },
  {
    id: 'chocolate',
    name: 'Midnight Chocolate',
    description: 'Dark chocolate, sea salt',
    category: 'Food',
    price: 650,
    image: require('@/assets/images/truffle-fries.jpg'),
    accent: '#765348',
  },
];

const seedOrders: ClubOrder[] = [
  {
    id: 'round-1',
    round: 1,
    createdAt: '9:18 PM',
    status: 'ready',
    items: [
      { ...menu[0], quantity: 2 },
      { ...menu[3], quantity: 1 },
    ],
    total: 2450,
    paid: false,
  },
];

const seedRequests: SongRequest[] = [
  { id: 'song-1', song: 'One Dance', artist: 'Drake', status: 'queued' },
  { id: 'song-2', song: 'Finally', artist: 'Kings of Tomorrow', status: 'playing' },
];

type ClubContextValue = {
  tableNumber: number;
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
  const [orders, setOrders] = useState<ClubOrder[]>(seedOrders);
  const [songRequests, setSongRequests] = useState<SongRequest[]>(seedRequests);
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [selectedMode, setSelectedMode] = useState<StaffMode>('guest');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
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
      STORAGE_KEY,
      JSON.stringify({ cart, orders, songRequests, waiterCalls, selectedMode }),
    ).catch(() => undefined);
  }, [cart, orders, songRequests, waiterCalls, selectedMode, hydrated]);

  const value = useMemo<ClubContextValue>(
    () => ({
      tableNumber: 12,
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
        setOrders(seedOrders);
        setSongRequests(seedRequests);
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