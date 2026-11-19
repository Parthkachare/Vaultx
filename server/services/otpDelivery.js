const nodemailer = require('nodemailer');

function getGmailConfig() {
  const keys = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN', 'GMAIL_USER'];
  const configured = keys.filter(key => process.env[key]);
  if (configured.length === 0) return null;
  if (configured.length !== keys.length) {
    const error = new Error('Gmail API delivery requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, and GMAIL_USER.');
    error.status = 503;
    throw error;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.GMAIL_USER)) {
    const error = new Error('GMAIL_USER must be a valid Gmail address.');
    error.status = 503;
    throw error;
  }
  return {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    user: process.env.GMAIL_USER,
  };
}

async function deliverWithGmailApi(email, code, purpose, config) {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenResponse.ok) {
    const error = new Error(`Gmail OAuth token request failed (${tokenResponse.status}).`);
    error.status = 502;
    throw error;
  }
  const token = await tokenResponse.json();
  if (typeof token.access_token !== 'string' || !token.access_token) {
    const error = new Error('Gmail OAuth token response did not contain an access token.');
    error.status = 502;
    throw error;
  }

  const message = [
    `From: VaultX <${config.user}>`,
    `To: ${email}`,
    `Subject: VaultX ${purpose} verification code`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    `Your VaultX ${purpose} verification code is ${code}. It expires in 5 minutes.`,
  ].join('\r\n');
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ raw: Buffer.from(message, 'utf8').toString('base64url') }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const body = await response.json();
    const reason = typeof body.error?.status === 'string'
      ? body.error.status
      : typeof body.error?.errors?.[0]?.reason === 'string'
        ? body.error.errors[0].reason
        : 'UNKNOWN';
    const error = new Error(`Gmail API failed to send the OTP (${response.status}, ${reason}).`);
    error.status = 502;
    throw error;
  }
}

async function deliverOtp(email, code, purpose) {
  if (process.env.NODE_ENV !== 'production') return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['login', 'approval'].includes(purpose)) {
    const error = new Error('OTP delivery requires a valid recipient and purpose.');
    error.status = 400;
    throw error;
  }

  const gmailConfig = getGmailConfig();
  if (gmailConfig) {
    await deliverWithGmailApi(email, code, purpose, gmailConfig);
    return;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    const error = new Error('OTP email delivery is not configured.');
    error.status = 503;
    throw error;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: `VaultX ${purpose} verification code`,
    text: `Your VaultX verification code is ${code}. It expires in 5 minutes.`,
  });
}

module.exports = { deliverOtp };
