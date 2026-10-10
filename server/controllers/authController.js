const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passwords = require('../services/passwords');
const { query, modelRow, modelRows } = require('../services/db');
const { issueOtp, consumeOtp, invalidateOtp } = require('../services/otpChallenges');
const audit = require('../services/audit');
const security = require('../services/security');
const { deliverOtp } = require('../services/otpDelivery');
const { getClientIp } = require('../middleware/auth');

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function normalizeEmail(email) {
  return email.toLowerCase().trim();
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone,
    preferences: user.preferences ?? {},
    notificationPreferences: user.notificationPreferences ?? {},
  };
}

async function login(req, res) {
  const { email: submittedEmail, password } = req.body;
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] ?? '';
  if (typeof submittedEmail !== 'string' || typeof password !== 'string' || !submittedEmail.trim() || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const email = normalizeEmail(submittedEmail);
  const user = modelRow((await query(
    'SELECT * FROM public.users WHERE email = $1 AND is_deleted = false',
    [email],
  )).rows[0]);
  if (!user || !user.isActive) {
    await audit.log({ userEmail: email, action: 'Failed login — invalid credentials', ipAddress: ip, userAgent: ua, status: 'Failed' });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return res.status(403).json({ error: 'Account temporarily locked due to too many failed attempts.' });
  }

  if (!await passwords.comparePassword(password, user.passwordHash)) {
    await security.recordFailedLogin(email, ip, ua, user);
    await audit.log({ userId: user._id, userEmail: email, userName: user.name, role: user.role, action: 'Failed login — wrong password', ipAddress: ip, userAgent: ua, status: 'Failed' });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const code = await issueOtp({ userId: user._id, purpose: 'login' });
  try {
    await deliverOtp(email, code, 'login');
  } catch (error) {
    await invalidateOtp({ userId: user._id, purpose: 'login' });
    throw error;
  }
  const response = { message: 'OTP sent to registered email.' };
  if (process.env.NODE_ENV !== 'production') response._devOtp = code;
  return res.json(response);
}

async function verifyOtp(req, res) {
  const { email: submittedEmail, otp } = req.body;
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] ?? '';
  if (typeof submittedEmail !== 'string' || typeof otp !== 'string' || !submittedEmail.trim() || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }

  const email = normalizeEmail(submittedEmail);
  const user = modelRow((await query(
    'SELECT * FROM public.users WHERE email = $1 AND is_deleted = false',
    [email],
  )).rows[0]);
  if (!user || !user.isActive) {
    await audit.log({ userEmail: email, action: 'Failed OTP verification — user unavailable', ipAddress: ip, userAgent: ua, status: 'Failed' });
    return res.status(401).json({ error: 'Invalid or expired OTP.' });
  }
  if (!await consumeOtp({ userId: user._id, purpose: 'login', code: otp })) {
    await audit.log({ userId: user._id, userEmail: email, userName: user.name, role: user.role, action: 'Failed OTP verification — invalid, expired, or missing challenge', ipAddress: ip, userAgent: ua, status: 'Failed' });
    return res.status(401).json({ error: 'Invalid or expired OTP.' });
  }

  await security.recordSuccessfulLogin(user, ip, ua);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const token = jwt.sign(
    { userId: user._id.toString(), jti: sessionId, tokenVersion: user.tokenVersion },
    process.env.JWT_SECRET,
    { expiresIn: '8h' },
  );
  await query(
    `INSERT INTO public.sessions (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sessionId, user._id, crypto.createHash('sha256').update(token).digest('hex'), ua, ip, expiresAt],
  );
  await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: 'Login successful (OTP verified)', ipAddress: ip, userAgent: ua, status: 'Success' });
  return res.json({ token, user: safeUser(user) });
}

async function logout(req, res) {
  const { user } = req;
  await query(
    'UPDATE public.sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2',
    [req.authSession._id, user._id],
  );
  await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: 'Logout', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
  return res.json({ message: 'Logged out.' });
}

async function currentUser(req, res) {
  return res.json({ user: safeUser(req.user) });
}

async function updateProfile(req, res) {
  const { name, email, department, phone } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid name and email are required.' });
  }
  try {
    const user = modelRow((await query(
      `UPDATE public.users
       SET name = $2, email = $3, department = $4, phone = $5
       WHERE id = $1 AND is_deleted = false
       RETURNING *`,
      [req.user._id, name.trim(), normalizeEmail(email), typeof department === 'string' ? department.trim() : '', typeof phone === 'string' ? phone.trim() : ''],
    )).rows[0]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: 'Profile updated', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
    return res.json({ user: safeUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
}

async function updatePreferences(req, res) {
  const { preferences, notificationPreferences } = req.body;
  if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)
    || !notificationPreferences || typeof notificationPreferences !== 'object' || Array.isArray(notificationPreferences)) {
    return res.status(400).json({ error: 'Valid preferences and notification preferences are required.' });
  }
  const boolRecords = [preferences, notificationPreferences];
  if (boolRecords.some(record => Object.values(record).some(value => typeof value !== 'boolean'))) {
    return res.status(400).json({ error: 'Preference values must be booleans.' });
  }
  const user = modelRow((await query(
    `UPDATE public.users SET preferences = $2, notification_preferences = $3
     WHERE id = $1 RETURNING *`,
    [req.user._id, preferences, notificationPreferences],
  )).rows[0]);
  await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: 'Account preferences updated', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
  return res.json({ user: safeUser(user) });
}

async function updatePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 12) {
    return res.status(400).json({ error: 'Current password and a new password of at least 12 characters are required.' });
  }
  if (!await passwords.comparePassword(currentPassword, req.user.passwordHash)) {
    await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: 'Failed password change — current password mismatch', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Failed' });
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const passwordHash = await passwords.hashPassword(newPassword);
  await query('UPDATE public.users SET password_hash = $2 WHERE id = $1', [req.user._id, passwordHash]);
  await query(
    `UPDATE public.sessions SET revoked_at = now()
     WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [req.user._id, req.authSession._id],
  );
  await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: 'Password changed', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
  return res.json({ message: 'Password updated. Other sessions have been revoked.' });
}

async function listSessions(req, res) {
  const { rows } = await query(
    `SELECT id, user_agent, ip_address, expires_at, created_at
     FROM public.sessions
     WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC`,
    [req.user._id],
  );
  return res.json(modelRows(rows).map(session => ({
    id: session.id,
    userAgent: session.userAgent,
    ipAddress: session.ipAddress,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    current: session.id === req.authSession._id,
  })));
}

async function revokeSession(req, res) {
  const { rows } = await query(
    `UPDATE public.sessions SET revoked_at = now()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND id <> $3
     RETURNING id`,
    [req.params.id, req.user._id, req.authSession._id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Session not found or cannot revoke the current session.' });
  await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: 'Other session revoked', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
  return res.json({ message: 'Session revoked.' });
}

async function revokeOtherSessions(req, res) {
  await query(
    `UPDATE public.sessions SET revoked_at = now()
     WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
    [req.user._id, req.authSession._id],
  );
  await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: 'Other sessions revoked', ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
  return res.json({ message: 'Other sessions revoked.' });
}

module.exports = {
  login, verifyOtp, logout, currentUser, updateProfile, updatePreferences, updatePassword,
  listSessions, revokeSession, revokeOtherSessions,
};
