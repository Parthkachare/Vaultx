const nodemailer = require('nodemailer');

async function deliverOtp(email, code, purpose) {
  if (process.env.NODE_ENV !== 'production') return;

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
