const test = require('node:test');
const assert = require('node:assert/strict');
const { isConfigured, modelRow, query } = require('./db');

test('PostgreSQL rows map snake_case columns to existing API property names', () => {
  assert.deepEqual(modelRow({
    id: '8a886789-a024-48fa-9cee-fd86ca32f720',
    manager1_id: 'f4299ee5-4f75-4c92-89ce-5d2594be1e3c',
    failed_login_attempts: 2,
  }), {
    id: '8a886789-a024-48fa-9cee-fd86ca32f720',
    _id: '8a886789-a024-48fa-9cee-fd86ca32f720',
    manager1Id: 'f4299ee5-4f75-4c92-89ce-5d2594be1e3c',
    failedLoginAttempts: 2,
  });
});

test('database operations require the server-side DATABASE_URL', async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.equal(isConfigured(), false);
    await assert.rejects(query('SELECT 1'), /DATABASE_URL must be configured/);
  } finally {
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  }
});
