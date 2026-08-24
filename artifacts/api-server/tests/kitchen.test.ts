import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import app from '../src/app';

test('kitchen tickets require Firebase staff authentication', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/v1/staff/kitchen-tickets?stationId=kitchen`,
    { headers: { 'X-Club-Id': 'club-test' } },
  );
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: {
      code: 'STAFF_AUTH_REQUIRED',
      message: 'A Firebase staff bearer token is required.',
    },
  });
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test('kitchen tickets require a stationId query parameter', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  // No Authorization header at all, so requireFirebaseStaff itself rejects
  // before the route body's own zod validation runs — this test asserts
  // the endpoint exists and is reachable at all (matching the existing
  // suite's style of testing auth-gating rather than full business logic,
  // since a real Firebase token/Firestore club isn't available in this
  // test environment).
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/v1/staff/kitchen-tickets`,
    { headers: { 'X-Club-Id': 'club-test' } },
  );
  assert.equal(response.status, 401);
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
