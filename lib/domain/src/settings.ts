export type ClubId = string;
export type ISODateString = string;

export type ThemePalette = {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  card: string;
  border: string;
};

export type ThemeSettings = ThemePalette & {
  mode: 'dark' | 'light' | 'custom';
  light?: ThemePalette;
  dark?: ThemePalette;
};

export type ClubSettings = {
  clubId: ClubId;
  general: {
    name: string;
    logoUrl?: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    currency: {
      code: string;
      locale: string;
      minorUnit: number;
    };
    timezone: string;
    language: string;
  };
  business: {
    openingTime: string;
    closingTime: string;
    taxPercentage: number;
    serviceChargePercentage: number;
    maximumTableTimeMinutes: number;
    sessionTimeoutMinutes: number;
    maximumContributors: number;
    splitBillEnabled: boolean;
    songRequestsEnabled: boolean;
  };
  payments: {
    mpesaTillNumber?: string;
    mpesaPaybillNumber?: string;
    merchantName?: string;
    paymentInstructions?: string;
    supportedMethods: Array<'mpesa' | 'cash'>;
  };
  themes: {
    mode: ThemeSettings['mode'];
    light?: ThemePalette;
    dark?: ThemePalette;
    custom?: ThemePalette;
  };
  branding: {
    displayName: string;
    shortName: string;
    logoUrl?: string;
    description?: string;
    address?: string;
    phoneNumber?: string;
    email?: string;
    website?: string;
  };
  theme: ThemeSettings;
  currency: {
    code: string;
    locale: string;
    minorUnit: number;
  };
  language: string;
  businessHours: {
    timezone: string;
    opensAt: string;
    closesAt: string;
    maximumTableTimeMinutes: number;
    sessionTimeoutMinutes: number;
    maximumContributors: number;
    splitBillEnabled: boolean;
    songRequestsEnabled: boolean;
  };
  payment: {
    tillNumber?: string;
    paybillNumber?: string;
    merchantName?: string;
    instructions?: string;
    acceptedMethods: Array<'mpesa' | 'cash'>;
  };
  operations: {
    activeDepartments: Array<{
      id: string;
      name: string;
      active: boolean;
    }>;
  };
  staff: {
    roles: Array<{
      id: string;
      name: string;
      permissions: string[];
      active: boolean;
    }>;
  };
  pricing: {
    taxRate: number;
    serviceChargeRate: number;
  };
  notifications: {
    push: boolean;
    sound: boolean;
    kitchenAlerts: boolean;
    djAlerts: boolean;
    paymentWaiting: boolean;
    lowStock: boolean;
    businessDayReminder: boolean;
  };
  customer: {
    songRequests: boolean;
    splitBills: boolean;
    callWaiter: boolean;
    serviceTimeline: boolean;
    estimatedWaitingTime: boolean;
    menuCategories: string[];
  };
  djDefaults: {
    queueEnabled: boolean;
    duplicateWindowMinutes: number;
  };
  kitchenDefaults: {
    defaultStationName: string;
    ticketPriority: 'normal' | 'high';
  };
  version?: number;
  updatedAt?: ISODateString;
};

export function validateClubSettings(settings: ClubSettings): void {
  const errors: string[] = [];
  if (!settings.clubId.trim()) errors.push('clubId is required');
  if (!settings.general.name.trim()) errors.push('general.name is required');
  if (!settings.general.currency.code.trim()) {
    errors.push('general.currency.code is required');
  }
  if (!settings.general.timezone.trim()) errors.push('general.timezone is required');
  if (!settings.business.openingTime.match(/^\d{2}:\d{2}$/)) {
    errors.push('business.openingTime must use HH:mm');
  }
  if (!settings.business.closingTime.match(/^\d{2}:\d{2}$/)) {
    errors.push('business.closingTime must use HH:mm');
  }
  if (settings.business.sessionTimeoutMinutes <= 0) {
    errors.push('business.sessionTimeoutMinutes must be positive');
  }
  if (settings.business.maximumTableTimeMinutes <= 0) {
    errors.push('business.maximumTableTimeMinutes must be positive');
  }
  if (settings.business.maximumContributors < 1) {
    errors.push('business.maximumContributors must be at least 1');
  }
  if (settings.payments.supportedMethods.length === 0) {
    errors.push('payments.supportedMethods must contain at least one method');
  }
  if (!settings.themes[settings.themes.mode === 'custom' ? 'custom' : settings.themes.mode]) {
    errors.push(`themes.${settings.themes.mode} palette is required`);
  }
  if (errors.length > 0) {
    throw new Error(`CONFIGURATION_INVALID: ${errors.join('; ')}`);
  }
}

/**
 * Editable seed configuration for the first deployment.
 * Runtime settings are loaded through SettingsRepository after the settings
 * module is connected; this value is not a source of truth.
 */
export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  clubId: 'mamus-lounge',
  general: {
    name: "Mamu's Lounge",
    description: '',
    currency: {
      code: 'KES',
      locale: 'en-KE',
      minorUnit: 0,
    },
    timezone: 'Africa/Nairobi',
    language: 'en',
  },
  business: {
    openingTime: '17:00',
    closingTime: '04:00',
    taxPercentage: 0,
    serviceChargePercentage: 0,
    maximumTableTimeMinutes: 240,
    sessionTimeoutMinutes: 30,
    maximumContributors: 8,
    splitBillEnabled: true,
    songRequestsEnabled: true,
  },
  payments: {
    supportedMethods: ['mpesa', 'cash'],
  },
  themes: {
    mode: 'dark',
    dark: {
      background: '#0c0b0d',
      foreground: '#f4efe6',
      primary: '#e2aa3f',
      primaryForeground: '#1b1409',
      card: '#171417',
      border: '#30282c',
    },
    custom: {
      background: '#0c0b0d',
      foreground: '#f4efe6',
      primary: '#e2aa3f',
      primaryForeground: '#1b1409',
      card: '#171417',
      border: '#30282c',
    },
  },
  branding: {
    displayName: "Mamu's Lounge",
    shortName: "MAMU'S",
  },
  theme: {
    mode: 'dark',
    background: '#0c0b0d',
    foreground: '#f4efe6',
    primary: '#e2aa3f',
    primaryForeground: '#1b1409',
    card: '#171417',
    border: '#30282c',
  },
  currency: {
    code: 'KES',
    locale: 'en-KE',
    minorUnit: 0,
  },
  language: 'en',
  businessHours: {
    timezone: 'Africa/Nairobi',
    opensAt: '17:00',
    closesAt: '04:00',
    maximumTableTimeMinutes: 240,
    sessionTimeoutMinutes: 30,
    maximumContributors: 8,
    splitBillEnabled: true,
    songRequestsEnabled: true,
  },
  payment: {
    acceptedMethods: ['mpesa', 'cash'],
  },
  operations: {
    activeDepartments: [
      { id: 'kitchen', name: 'Kitchen', active: true },
      { id: 'bar', name: 'Bar', active: true },
    ],
  },
  staff: {
    roles: [
      { id: 'administrator', name: 'Administrator', permissions: ['*'], active: true },
      { id: 'waiter', name: 'Waiter', permissions: ['tables.read'], active: true },
    ],
  },
  pricing: {
    taxRate: 0,
    serviceChargeRate: 0,
  },
  notifications: {
    push: true,
    sound: true,
    kitchenAlerts: true,
    djAlerts: true,
    paymentWaiting: true,
    lowStock: true,
    businessDayReminder: true,
  },
  customer: {
    songRequests: true,
    splitBills: true,
    callWaiter: true,
    serviceTimeline: true,
    estimatedWaitingTime: true,
    menuCategories: ['drinks', 'food'],
  },
  djDefaults: {
    queueEnabled: true,
    duplicateWindowMinutes: 30,
  },
  kitchenDefaults: {
    defaultStationName: 'Kitchen',
    ticketPriority: 'normal',
  },
};