const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { deliverOtp } = require('./otpDelivery');

test('OTP email delivery uses bounded SMTP timeouts', async t => {
  const previousEnv = Object.fromEntries(
    ['NODE_ENV', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']
      .map(key => [key, process.env[key]]),
  );
  const originalCreateTransport = nodemailer.createTransport;
  let transportOptions;
  let message;

  Object.assign(process.env, {
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_USER: 'smtp-user',
    SMTP_PASSWORD: 'smtp-password',
    SMTP_FROM: 'VaultX <no-reply@example.com>',
  });
  nodemailer.createTransport = options => {
    transportOptions = options;
    return { sendMail: async mail => { message = mail; } };
  };
  t.after(() => {
    nodemailer.createTransport = originalCreateTransport;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await deliverOtp('user@example.com', '123456', 'login');

  assert.equal(transportOptions.connectionTimeout, 10_000);
  assert.equal(transportOptions.greetingTimeout, 10_000);
  assert.equal(transportOptions.socketTimeout, 30_000);
  assert.equal(message.to, 'user@example.com');
});

test('Gmail API delivery sends the OTP using HTTPS and a refreshed OAuth token', async t => {
  const keys = [
    'NODE_ENV', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER',
    'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM',
  ];
  const previousEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const previousFetch = global.fetch;
  const requests = [];
  Object.assign(process.env, {
    NODE_ENV: 'production',
    GMAIL_CLIENT_ID: 'test-client-id',
    GMAIL_CLIENT_SECRET: 'test-client-secret',
    GMAIL_REFRESH_TOKEN: 'test-refresh-token',
    GMAIL_USER: 'vaultx.sender@gmail.com',
  });
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']) {
    delete process.env[key];
  }
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url === 'https://oauth2.googleapis.com/token') {
      return new Response(JSON.stringify({ access_token: 'test-access-token' }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
  t.after(() => {
    global.fetch = previousFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await deliverOtp('manager@gmail.com', '123456', 'login');

  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(requests[1].url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(requests[1].options.headers.authorization, 'Bearer test-access-token');
  const rawMessage = Buffer.from(JSON.parse(requests[1].options.body).raw, 'base64url').toString('utf8');
  assert.match(rawMessage, /To: manager@gmail\.com/);
  assert.match(rawMessage, /From: VaultX <vaultx\.sender@gmail\.com>/);
  assert.match(rawMessage, /verification code is 123456/);
});

test('Gmail API delivery rejects incomplete OAuth configuration', async t => {
  const keys = ['NODE_ENV', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];
  const previousEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: 'production',
    GMAIL_CLIENT_ID: 'test-client-id',
    GMAIL_CLIENT_SECRET: '',
    GMAIL_REFRESH_TOKEN: '',
    GMAIL_USER: '',
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await assert.rejects(deliverOtp('manager@gmail.com', '123456', 'login'), {
    message: /Gmail API delivery requires/,
    status: 503,
  });
});

test('OTP delivery rejects invalid recipients and purposes', async t => {
  const keys = ['NODE_ENV', 'GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];
  const previousEnv = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    NODE_ENV: 'production',
    GMAIL_CLIENT_ID: '',
    GMAIL_CLIENT_SECRET: '',
    GMAIL_REFRESH_TOKEN: '',
    GMAIL_USER: '',
  });
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  await assert.rejects(deliverOtp('bad-address', '123456', 'login'), {
    message: /valid recipient and purpose/,
    status: 400,
  });
  await assert.rejects(deliverOtp('manager@gmail.com', '123456', 'unknown'), {
    message: /valid recipient and purpose/,
    status: 400,
  });
});
