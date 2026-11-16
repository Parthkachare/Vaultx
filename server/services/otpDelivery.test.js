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
