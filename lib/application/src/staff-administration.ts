import type {
  Permission,
  RepositoryRegistry,
  Role,
  Staff,
} from '@workspace/domain';
import type { RequestActor } from './services';

export type StaffAdministrationInput = {
  actor: RequestActor;
  clubId: string;
};

export type AdminStaffService = {
  createStaff(input: StaffAdministrationInput & {
    staff: Omit<Staff, 'id' | 'clubId'>;
  }): Promise<Staff>;
  updateStaff(input: StaffAdministrationInput & {
    staffId: string;
    changes: Partial<Omit<Staff, 'id' | 'clubId'>>;
  }): Promise<Staff>;
  listStaff(input: StaffAdministrationInput): Promise<Staff[]>;
  createRole(input: StaffAdministrationInput & {
    role: Omit<Role, 'id' | 'clubId'>;
  }): Promise<Role>;
  updateRole(input: StaffAdministrationInput & {
    roleId: string;
    changes: Partial<Omit<Role, 'id' | 'clubId'>>;
  }): Promise<Role>;
  listRoles(input: StaffAdministrationInput): Promise<Role[]>;
};

export class StaffAdministrationError extends Error {
  constructor(
    readonly code:
      | 'STAFF_ADMIN_AUTH_REQUIRED'
      | 'STAFF_ADMIN_PERMISSION_DENIED'
      | 'STAFF_NOT_FOUND'
      | 'ROLE_NOT_FOUND'
      | 'ROLE_INVALID'
      | 'STAFF_INVALID',
    message: string,
    readonly status: 400 | 401 | 403 | 404 = 400,
  ) {
    super(message);
    this.name = 'StaffAdministrationError';
  }
}

const KNOWN_PERMISSIONS = new Set<Permission>([
  'tables.read',
  'tables.release',
  'orders.read',
  'orders.manage',
  'tickets.manage',
  'payments.verify',
  'songs.manage',
  'inventory.read',
  'inventory.manage',
  'settings.manage',
  'staff.manage',
  'reports.read',
  'business-days.manage',
]);

function ensureNonEmpty(value: string, code: 'ROLE_INVALID' | 'STAFF_INVALID', field: string) {
  if (!value.trim()) {
    throw new StaffAdministrationError(code, `${field} is required.`);
  }
}

export function createAdminStaffService(
  repositories: Pick<RepositoryRegistry, 'staff' | 'roles'>,
  ids: { next: () => string },
): AdminStaffService {
  async function authorize(input: StaffAdministrationInput): Promise<void> {
    if (
      input.actor.kind !== 'staff' ||
      input.actor.clubId !== input.clubId ||
      !input.actor.staffId
    ) {
      throw new StaffAdministrationError(
        'STAFF_ADMIN_AUTH_REQUIRED',
        'An authenticated staff actor is required.',
        401,
      );
    }

    const caller = await repositories.staff.getById(input.clubId, input.actor.staffId);
    if (!caller || !caller.active) {
      throw new StaffAdministrationError(
        'STAFF_NOT_FOUND',
        'Staff membership was not found.',
        403,
      );
    }

    const roles = (
      await Promise.all(
        caller.roleIds.map((roleId) => repositories.roles.getById(input.clubId, roleId)),
      )
    ).filter((role): role is Role => Boolean(role && role.active));
    const permissions = new Set(roles.flatMap((role) => role.permissions));
    if (!permissions.has('staff.manage')) {
      throw new StaffAdministrationError(
        'STAFF_ADMIN_PERMISSION_DENIED',
        'Staff administration is not permitted.',
        403,
      );
    }
  }

  function validateRole(role: Omit<Role, 'id' | 'clubId'>): void {
    ensureNonEmpty(role.name, 'ROLE_INVALID', 'Role name');
    if (!Array.isArray(role.permissions) || role.permissions.some(
      (permission) => permission !== ('*' as Permission) && !KNOWN_PERMISSIONS.has(permission),
    )) {
      throw new StaffAdministrationError(
        'ROLE_INVALID',
        'Role permissions contain an unsupported permission.',
      );
    }
  }

  async function validateRoleIds(clubId: string, roleIds: string[]): Promise<void> {
    const roles = await Promise.all(roleIds.map((roleId) => repositories.roles.getById(clubId, roleId)));
    if (roles.some((role) => !role || !role.active)) {
      throw new StaffAdministrationError(
        'ROLE_NOT_FOUND',
        'Every assigned role must be an active role.',
        404,
      );
    }
  }

  return {
    async createStaff(input) {
      await authorize(input);
      ensureNonEmpty(input.staff.firebaseUid, 'STAFF_INVALID', 'Firebase UID');
      ensureNonEmpty(input.staff.displayName, 'STAFF_INVALID', 'Display name');
      await validateRoleIds(input.clubId, input.staff.roleIds);
      return repositories.staff.create({
        ...input.staff,
        id: ids.next(),
        clubId: input.clubId,
      });
    },

    async updateStaff(input) {
      await authorize(input);
      const existing = await repositories.staff.getById(input.clubId, input.staffId);
      if (!existing) {
        throw new StaffAdministrationError('STAFF_NOT_FOUND', 'Staff member was not found.', 404);
      }
      const updated = { ...existing, ...input.changes, id: existing.id, clubId: input.clubId };
      ensureNonEmpty(updated.firebaseUid, 'STAFF_INVALID', 'Firebase UID');
      ensureNonEmpty(updated.displayName, 'STAFF_INVALID', 'Display name');
      await validateRoleIds(input.clubId, updated.roleIds);
      return repositories.staff.update(updated);
    },

    async listStaff(input) {
      await authorize(input);
      return repositories.staff.list(input.clubId);
    },

    async createRole(input) {
      await authorize(input);
      validateRole(input.role);
      return repositories.roles.create({
        ...input.role,
        id: ids.next(),
        clubId: input.clubId,
      });
    },

    async updateRole(input) {
      await authorize(input);
      const existing = await repositories.roles.getById(input.clubId, input.roleId);
      if (!existing) {
        throw new StaffAdministrationError('ROLE_NOT_FOUND', 'Role was not found.', 404);
      }
      const updated = { ...existing, ...input.changes, id: existing.id, clubId: input.clubId };
      validateRole(updated);
      return repositories.roles.update(updated);
    },

    async listRoles(input) {
      await authorize(input);
      return repositories.roles.list(input.clubId);
    },
  };
}