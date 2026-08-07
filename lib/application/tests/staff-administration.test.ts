import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Role, Staff } from '@workspace/domain';
import {
  StaffAdministrationError,
  createAdminStaffService,
} from '../src/staff-administration';

const clubId = 'club-admin-test';
const admin: Staff = {
  id: 'admin-1',
  clubId,
  firebaseUid: 'firebase-admin',
  displayName: 'Admin',
  roleIds: ['role-admin'],
  active: true,
};
const managerRole: Role = {
  id: 'role-admin',
  clubId,
  name: 'Administrator',
  permissions: ['staff.manage'],
  active: true,
};

function harness() {
  const staff = new Map([[admin.id, admin]]);
  const roles = new Map([[managerRole.id, managerRole]]);
  let sequence = 0;
  const repositories = {
    staff: {
      getById: async (_clubId: string, id: string) => staff.get(id) ?? null,
      getByFirebaseUid: async (_clubId: string, uid: string) =>
        [...staff.values()].find((item) => item.firebaseUid === uid && item.active) ?? null,
      create: async (item: Staff) => {
        staff.set(item.id, item);
        return item;
      },
      update: async (item: Staff) => {
        staff.set(item.id, item);
        return item;
      },
      list: async () => [...staff.values()],
    },
    roles: {
      getById: async (_clubId: string, id: string) => roles.get(id) ?? null,
      list: async () => [...roles.values()],
      create: async (item: Role) => {
        roles.set(item.id, item);
        return item;
      },
      update: async (item: Role) => {
        roles.set(item.id, item);
        return item;
      },
    },
  };
  return {
    repositories,
    service: createAdminStaffService(repositories, {
      next: () => `generated-${++sequence}`,
    }),
  };
}

function actor(staffId = admin.id) {
  return { kind: 'staff' as const, id: staffId, staffId, clubId };
}

test('staff administration creates, updates, and lists staff', async () => {
  const { service } = harness();
  const created = await service.createStaff({
    actor: actor(),
    clubId,
    staff: {
      firebaseUid: 'firebase-waiter',
      displayName: 'Waiter',
      roleIds: ['role-admin'],
      active: true,
    },
  });
  assert.equal(created.id, 'generated-1');

  const updated = await service.updateStaff({
    actor: actor(),
    clubId,
    staffId: created.id,
    changes: { displayName: 'Senior Waiter', active: false },
  });
  assert.equal(updated.displayName, 'Senior Waiter');
  assert.equal((await service.listStaff({ actor: actor(), clubId })).length, 2);
});

test('staff administration creates, updates, and lists roles', async () => {
  const { service } = harness();
  const created = await service.createRole({
    actor: actor(),
    clubId,
    role: { name: 'Floor Manager', permissions: ['tables.read'], active: true },
  });
  assert.equal(created.id, 'generated-1');
  const updated = await service.updateRole({
    actor: actor(),
    clubId,
    roleId: created.id,
    changes: { permissions: ['staff.manage'] },
  });
  assert.deepEqual(updated.permissions, ['staff.manage']);
  assert.equal((await service.listRoles({ actor: actor(), clubId })).length, 2);
});

test('staff administration enforces staff.manage', async () => {
  const { service, repositories } = harness();
  const waiter = {
    ...admin,
    id: 'waiter-1',
    firebaseUid: 'firebase-waiter',
    roleIds: [],
  };
  await repositories.staff.create(waiter);
  await assert.rejects(
    service.listStaff({ actor: actor(waiter.id), clubId }),
    (error: unknown) =>
      error instanceof StaffAdministrationError &&
      error.code === 'STAFF_ADMIN_PERMISSION_DENIED' &&
      error.status === 403,
  );
});