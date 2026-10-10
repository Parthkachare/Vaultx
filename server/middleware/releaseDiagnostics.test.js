const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const {
  markReleaseRoute,
  releaseDiagnostics,
  setReleaseDiagnostic,
} = require('./releaseDiagnostics');

test('release diagnostics correlate the route, resolved identity, authorization, and HTTP response safely', () => {
  const req = { method: 'GET', path: '/api/papers/VX-2026-123456/eligibility' };
  const res = new EventEmitter();
  res.statusCode = 403;
  const headers = {};
  res.setHeader = (name, value) => { headers[name] = value; };
  const originalInfo = console.info;
  let diagnosticLine;
  console.info = (...args) => { diagnosticLine = args.join(' '); };
  try {
    releaseDiagnostics(req, res, () => {});
    markReleaseRoute('eligibility')(req, res, () => {});
    setReleaseDiagnostic(req, {
      authentication: 'succeeded',
      databaseUserId: 'resolved-user-id',
      resolvedRole: 'Manager 2',
      authorization: 'denied',
      requiredRoles: ['Admin', 'Exam Controller'],
      stage: 'role_authorization',
    });
    res.emit('finish');
  } finally {
    console.info = originalInfo;
  }

  assert.match(headers['X-Request-ID'], /^[0-9a-f-]{36}$/i);
  const line = JSON.parse(diagnosticLine.replace('VaultX release diagnostic: ', ''));
  assert.equal(line.requestId, headers['X-Request-ID']);
  assert.equal(line.route, '/api/papers/:paperId/eligibility');
  assert.equal(line.routeReached, true);
  assert.equal(line.authentication, 'succeeded');
  assert.equal(line.databaseUserId, 'resolved-user-id');
  assert.equal(line.resolvedRole, 'Manager 2');
  assert.equal(line.authorization, 'denied');
  assert.deepEqual(line.requiredRoles, ['Admin', 'Exam Controller']);
  assert.equal(line.responseStatus, 403);
  assert.equal(JSON.stringify(line).includes('Bearer'), false);
});

test('release diagnostics do not log non-release requests', () => {
  const req = { method: 'GET', path: '/api/papers' };
  const res = new EventEmitter();
  let nextCalled = false;
  releaseDiagnostics(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(req.releaseDiagnostic, undefined);
});
