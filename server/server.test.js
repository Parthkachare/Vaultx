const test = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./server');

test('health endpoint returns API envelope and database status', async t => {
  const server = app.listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(['ok', 'unavailable'].includes(body.data.status));
  assert.ok(['connected', 'disconnected'].includes(body.data.database));
  assert.equal(typeof body.data.time, 'string');
});

test('protected APIs reject requests without a bearer token', async t => {
  const server = app.listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}/api`;

  for (const path of ['/papers', '/audit/logs', '/notifications']) {
    const response = await fetch(`${origin}${path}`);
    const body = await response.json();
    assert.equal(response.status, 401, `${path} should require authentication`);
    assert.equal(body.success, false);
    assert.equal(typeof body.error, 'string');
  }
});

test('release diagnostics expose their safe request ID to the configured frontend origin', async t => {
  const server = app.listen(0);
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/papers/test-paper/eligibility`,
    { headers: { Origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' } },
  );
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error, 'Authentication required.');
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/i);
  assert.match(response.headers.get('access-control-expose-headers') ?? '', /x-request-id/i);
});
