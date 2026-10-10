const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('./storage');

test('encrypted object upload uses the private server-side Storage API', async t => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://unit-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key';
  const payload = Buffer.from([0, 1, 2, 255]);
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return new Response('', { status: 200 });
  };
  t.after(() => {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });

  assert.doesNotThrow(() => storage.assertConfigured());
  await storage.uploadEncrypted('test-paper.enc', payload);
  assert.equal(request.url, 'https://unit-test.supabase.co/storage/v1/object/vaultx-papers/test-paper.enc');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers.apikey, 'unit-test-service-role-key');
  assert.equal(request.options.headers.authorization, 'Bearer unit-test-service-role-key');
  assert.equal(request.options.headers['x-upsert'], 'false');
  assert.deepEqual(Buffer.from(request.options.body), payload);
});

test('rejects a malformed Supabase URL before making Storage requests', t => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'SUPABASE_URL=https://unit-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role-key';
  t.after(() => {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  });

  assert.throws(storage.assertConfigured, /SUPABASE_URL must be an absolute HTTP\(S\) URL/);
});
