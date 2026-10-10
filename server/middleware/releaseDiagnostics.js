const crypto = require('crypto');

const RELEASE_ROUTE_PATTERN = /^\/api\/papers\/[^/]+\/(eligibility|view)$/;

function releaseDiagnostics(req, res, next) {
  if (req.method !== 'GET') return next();
  const match = req.path.match(RELEASE_ROUTE_PATTERN);
  if (!match) return next();

  req.releaseDiagnostic = {
    requestId: crypto.randomUUID(),
    route: `/api/papers/:paperId/${match[1]}`,
    routeReached: false,
    stage: 'route_dispatch',
    authentication: 'not_checked',
    databaseUserId: null,
    resolvedRole: null,
    authorization: 'not_checked',
    requiredRoles: [],
    releaseDecision: 'not_checked',
  };
  res.setHeader('X-Request-ID', req.releaseDiagnostic.requestId);
  res.once('finish', () => {
    console.info('VaultX release diagnostic:', JSON.stringify({
      ...req.releaseDiagnostic,
      responseStatus: res.statusCode,
    }));
  });
  next();
}

function markReleaseRoute(route) {
  return (req, _res, next) => {
    if (req.releaseDiagnostic) {
      req.releaseDiagnostic.routeReached = true;
      req.releaseDiagnostic.stage = 'authentication';
      req.releaseDiagnostic.route = `/api/papers/:paperId/${route}`;
    }
    next();
  };
}

function setReleaseDiagnostic(req, values) {
  if (req.releaseDiagnostic) Object.assign(req.releaseDiagnostic, values);
}

module.exports = { releaseDiagnostics, markReleaseRoute, setReleaseDiagnostic };
