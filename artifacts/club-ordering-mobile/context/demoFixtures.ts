import type {
  CartItem,
  ClubOrder,
  MenuItem,
  SongRequest,
} from './types';

/**
 * Temporary local fixtures used only while the repository adapters are being
 * introduced. They are intentionally isolated from application state and can
 * be removed when the menu/session repositories are connected.
 */
export const DEMO_TABLE_NUMBER = 12;
export const DEMO_STORAGE_KEY = 'loungeos-demo-session-v1';
export const DEMO_DJ_NAME = 'DJ Kito';
export const DEMO_SALES_TOTAL = 86400;
export const DEMO_ACTIVE_TABLES = 18;
export const DEMO_TOTAL_TABLES = 24;
export const DEMO_SALES_DELTA = '+18% vs last Fri';

export const demoMenu: MenuItem[] = [
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

const seedOrderItems: CartItem[] = [
  { ...demoMenu[0], quantity: 2 },
  { ...demoMenu[3], quantity: 1 },
];

export const demoOrders: ClubOrder[] = [
  {
    id: 'round-1',
    round: 1,
    createdAt: '9:18 PM',
    status: 'ready',
    items: seedOrderItems,
    total: 2450,
    paid: false,
  },
];

export const demoSongRequests: SongRequest[] = [
  { id: 'song-1', song: 'One Dance', artist: 'Drake', status: 'queued' },
  { id: 'song-2', song: 'Finally', artist: 'Kings of Tomorrow', status: 'playing' },
];