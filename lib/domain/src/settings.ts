export type ClubId = string;
export type ISODateString = string;

export type ThemeSettings = {
  background: string;
  foreground: string;
  primary: string;
  primaryForeground: string;
  card: string;
  border: string;
};

export type ClubSettings = {
  clubId: ClubId;
  branding: {
    displayName: string;
    shortName: string;
    logoUrl?: string;
  };
  theme: ThemeSettings;
  currency: {
    code: string;
    locale: string;
    minorUnit: number;
  };
  businessHours: {
    timezone: string;
    opensAt: string;
    closesAt: string;
  };
  payment: {
    tillNumber?: string;
    acceptedMethods: Array<'mpesa' | 'cash'>;
  };
  pricing: {
    taxRate: number;
    serviceChargeRate: number;
  };
  notifications: {
    paymentWaiting: boolean;
    lowStock: boolean;
    businessDayReminder: boolean;
  };
  djDefaults: {
    queueEnabled: boolean;
    duplicateWindowMinutes: number;
  };
  kitchenDefaults: {
    defaultStationName: string;
    ticketPriority: 'normal' | 'high';
  };
  updatedAt?: ISODateString;
};

/**
 * Editable seed configuration for the first deployment.
 * Runtime settings are loaded through SettingsRepository after the settings
 * module is connected; this value is not a source of truth.
 */
export const DEFAULT_CLUB_SETTINGS: ClubSettings = {
  clubId: 'mamus-lounge',
  branding: {
    displayName: "Mamu's Lounge",
    shortName: "MAMU'S",
  },
  theme: {
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
  businessHours: {
    timezone: 'Africa/Nairobi',
    opensAt: '17:00',
    closesAt: '04:00',
  },
  payment: {
    acceptedMethods: ['mpesa', 'cash'],
  },
  pricing: {
    taxRate: 0,
    serviceChargeRate: 0,
  },
  notifications: {
    paymentWaiting: true,
    lowStock: true,
    businessDayReminder: true,
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