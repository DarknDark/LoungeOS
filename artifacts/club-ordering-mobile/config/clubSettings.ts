import {
  DEFAULT_CLUB_SETTINGS,
  type ClubSettings,
} from '@workspace/domain';

/**
 * Local adapter for the architecture phase.
 *
 * The future SettingsRepository will replace this value when the mobile app
 * connects to the backend. Keeping the default in one place prevents screens
 * from owning business-specific values.
 */
export const clubSettings: ClubSettings = DEFAULT_CLUB_SETTINGS;