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