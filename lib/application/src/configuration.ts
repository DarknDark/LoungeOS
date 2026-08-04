import {
  DEFAULT_CLUB_SETTINGS,
  validateClubSettings,
} from '@workspace/domain';

export function validateDefaultClubConfiguration(): void {
  validateClubSettings(DEFAULT_CLUB_SETTINGS);
}