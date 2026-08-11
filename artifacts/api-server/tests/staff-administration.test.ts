import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import app from '../src/app';

test('staff administration requires Firebase staff authentication', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/admin/staff`, {
    headers: { 'X-Club-Id': 'club-test' },
  });
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

test('staff realtime projection requires Firebase staff authentication', async () => {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/staff/realtime`, {
    headers: { 'X-Club-Id': 'club-test' },
  });
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