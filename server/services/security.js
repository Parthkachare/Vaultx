// Rule-based security detection — detects threats without AI/ML dependency
const { query, modelRow } = require('./db');
const audit = require('./audit');

const BRUTE_FORCE_THRESHOLD = 5;  // failed logins before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const UNLOCK_ATTEMPT_THRESHOLD = 3; // repeated unlock attempts

// Track unlock attempts per paper per user (in-memory; use Redis in production)
const unlockAttempts = new Map();

async function recordFailedLogin(email, ipAddress, userAgent, knownUser) {
  const user = knownUser ?? modelRow((await query(
    'SELECT * FROM public.users WHERE email = $1 AND is_deleted = false',
    [email],
  )).rows[0]);
  if (!user) return;

  const updated = modelRow((await query(
    `UPDATE public.users SET failed_login_attempts = failed_login_attempts + 1
     WHERE id = $1 RETURNING *`,
    [user._id],
  )).rows[0]);
  if (!updated) return;
  if (updated.failedLoginAttempts >= BRUTE_FORCE_THRESHOLD) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await query('UPDATE public.users SET locked_until = $2 WHERE id = $1', [updated._id, lockedUntil]);
    await audit.logSecurityEvent({
      userId: updated._id,
      userEmail: email,
      eventType: 'BRUTE_FORCE',
      riskLevel: 'High',
      description: `Account locked after ${updated.failedLoginAttempts} failed login attempts from ${ipAddress}`,
      ipAddress,
      userAgent,
    });
  }
}

async function recordSuccessfulLogin(user, ipAddress, userAgent) {
  // Detect new/unrecognized IP
  if (user.lastLoginIp && user.lastLoginIp !== ipAddress) {
    await audit.logSecurityEvent({
      userId: user._id,
      userEmail: user.email,
      eventType: 'UNKNOWN_IP',
      riskLevel: 'Medium',
      description: `Login from new IP ${ipAddress} — previous: ${user.lastLoginIp}`,
      ipAddress,
      userAgent,
    });
  }
  const { rows } = await query(
    `UPDATE public.users
     SET failed_login_attempts = 0, locked_until = NULL, last_login_at = now(), last_login_ip = $2
     WHERE id = $1 RETURNING *`,
    [user._id, ipAddress],
  );
  Object.assign(user, modelRow(rows[0]));
}

async function checkUnlockAttempt(userId, paperId, ipAddress, userAgent, denied) {
  const key = `${userId}:${paperId}`;
  const count = (unlockAttempts.get(key) ?? 0) + 1;
  unlockAttempts.set(key, count);

  if (denied && count >= UNLOCK_ATTEMPT_THRESHOLD) {
    await audit.logSecurityEvent({
      userId,
      eventType: 'REPEATED_UNLOCK_ATTEMPT',
      riskLevel: 'High',
      description: `${count} consecutive denied unlock attempts on paper ${paperId}`,
      ipAddress,
      userAgent,
    });
  }
}

function resetUnlockAttempts(userId, paperId) {
  unlockAttempts.delete(`${userId}:${paperId}`);
}

async function detectUnauthorizedRole(userId, userEmail, requiredRole, actualRole, ipAddress, userAgent) {
  await audit.logSecurityEvent({
    userId,
    userEmail,
    eventType: 'UNAUTHORIZED_ROLE',
    riskLevel: 'High',
    description: `User with role '${actualRole}' attempted to access a resource requiring role '${requiredRole}'`,
    ipAddress,
    userAgent,
  });
}

module.exports = {
  recordFailedLogin,
  recordSuccessfulLogin,
  checkUnlockAttempt,
  resetUnlockAttempts,
  detectUnauthorizedRole,
};
