const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRole } = require('./auth');
const audit = require('../services/audit');
const security = require('../services/security');

test('release eligibility role gate accepts Admin and rejects other roles with an explicit 403', async () => {
  const guard = requireRole('Admin', 'Exam Controller');
  const adminRequest = { user: { role: 'Admin' }, releaseDiagnostic: {} };
  let adminPassed = false;
  await guard(adminRequest, {}, error => {
    if (error) throw error;
    adminPassed = true;
  });
  assert.equal(adminPassed, true);
  assert.equal(adminRequest.releaseDiagnostic.authorization, 'allowed');

  const originalDetectUnauthorizedRole = security.detectUnauthorizedRole;
  const originalAuditLog = audit.log;
  security.detectUnauthorizedRole = async () => {};
  audit.log = async () => {};
  try {
    let statusCode;
    let responseBody;
    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };
    const managerRequest = {
      user: { role: 'Manager 1', _id: 'user-id', email: '', name: '' },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' },
      releaseDiagnostic: {},
    };
    await guard(managerRequest, response, error => {
      if (error) throw error;
    });
    assert.equal(statusCode, 403);
    assert.deepEqual(responseBody, { error: 'Access denied. Required roles: Admin, Exam Controller.' });
    assert.equal(managerRequest.releaseDiagnostic.authorization, 'denied');
    assert.deepEqual(managerRequest.releaseDiagnostic.requiredRoles, ['Admin', 'Exam Controller']);
  } finally {
    security.detectUnauthorizedRole = originalDetectUnauthorizedRole;
    audit.log = originalAuditLog;
  }
});
