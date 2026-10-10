const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, modelRow } = require('../services/db');
const audit = require('../services/audit');
const security = require('../services/security');
const { setReleaseDiagnostic } = require('./releaseDiagnostics');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    setReleaseDiagnostic(req, {
      stage: 'bearer_token_check',
      authentication: 'failed',
      authenticationFailure: 'missing_bearer_token',
    });
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const token = header.slice(7);
  let stage = 'jwt_verification';
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    stage = 'database_user_and_session_lookup';
    const [userResult, sessionResult] = await Promise.all([
      query('SELECT * FROM public.users WHERE id = $1', [payload.userId]),
      query(
        `SELECT * FROM public.sessions WHERE token_hash = $1`,
        [tokenHash],
      ),
    ]);
    const user = modelRow(userResult.rows[0]);
    const session = modelRow(sessionResult.rows[0]);
    const sessionValid = Boolean(
      session
      && !session.revokedAt
      && new Date(session.expiresAt).getTime() > Date.now()
      && session.userId === user?._id
      && payload.tokenVersion === user?.tokenVersion,
    );
    setReleaseDiagnostic(req, {
      stage: 'session_validation',
      databaseUserId: user?._id ?? null,
      resolvedRole: user?.role ?? null,
      userActive: Boolean(user?.isActive),
      sessionFound: Boolean(session),
      sessionRevoked: Boolean(session?.revokedAt),
      sessionExpired: Boolean(session && new Date(session.expiresAt).getTime() <= Date.now()),
      sessionUserMatches: Boolean(session && user && session.userId === user._id),
      tokenVersionMatches: Boolean(user && payload.tokenVersion === user.tokenVersion),
    });
    if (!user || !user.isActive) {
      setReleaseDiagnostic(req, {
        authentication: 'failed',
        authenticationFailure: !user ? 'database_user_not_found' : 'database_user_inactive',
      });
      return res.status(401).json({ error: 'User not found or deactivated.' });
    }
    if (!sessionValid) {
      setReleaseDiagnostic(req, {
        authentication: 'failed',
        authenticationFailure: !session
          ? 'session_not_found'
          : session.revokedAt
            ? 'session_revoked'
            : new Date(session.expiresAt).getTime() <= Date.now()
              ? 'session_expired'
              : session.userId !== user._id
                ? 'session_user_mismatch'
                : 'token_version_mismatch',
      });
      return res.status(401).json({ error: 'Session revoked or expired.' });
    }
    req.user = user;
    req.authSession = session;
    setReleaseDiagnostic(req, { authentication: 'succeeded', stage: 'role_authorization' });
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      setReleaseDiagnostic(req, {
        stage,
        authentication: 'failed',
        authenticationFailure: error.name === 'TokenExpiredError' ? 'jwt_expired' : 'jwt_invalid',
      });
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    setReleaseDiagnostic(req, { stage, authentication: 'failed', authenticationFailure: 'authentication_dependency_error' });
    next(error);
  }
}

function requireRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    setReleaseDiagnostic(req, { requiredRoles: roles });
    if (!roles.includes(req.user.role)) {
      setReleaseDiagnostic(req, { authorization: 'denied', stage: 'role_authorization' });
      try {
        const ip = getClientIp(req);
        const userAgent = req.headers['user-agent'] ?? '';
        await security.detectUnauthorizedRole(req.user._id, req.user.email, roles.join(' or '), req.user.role, ip, userAgent);
        await audit.log({
          userId: req.user._id,
          userEmail: req.user.email,
          userName: req.user.name,
          role: req.user.role,
          action: `Unauthorized role access — required ${roles.join(' or ')}`,
          ipAddress: ip,
          userAgent,
          status: 'Failed',
        });
        return res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}.` });
      } catch (error) {
        return next(error);
      }
    }
    setReleaseDiagnostic(req, { authorization: 'allowed', stage: 'release_eligibility' });
    next();
  };
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
}

module.exports = { requireAuth, requireRole, getClientIp };
