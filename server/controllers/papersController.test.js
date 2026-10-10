const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { makeEligibility } = require('./papersController');

test('paper response preserves PostgreSQL date-only values in positive UTC offsets', () => {
  const controllerPath = path.resolve(__dirname, 'papersController.js');
  const script = `
    const { paperResponse } = require(${JSON.stringify(controllerPath)});
    const paper = paperResponse({
      exam_date: new Date(2026, 9, 10),
      exam_start_at: new Date('2026-10-10T06:45:00.000Z'),
      unlock_at: new Date('2026-10-10T06:45:00.000Z'),
      expiry_at: new Date('2026-10-10T08:00:00.000Z'),
    });
    process.stdout.write(paper.examDate);
  `;
  const result = execFileSync(process.execPath, ['-e', script], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'Asia/Kolkata' },
  });
  assert.equal(result, '2026-10-10');
});

test('release eligibility requires both distinct approval slots and the server-time window', () => {
  const paper = {
    status: 'LOCKED',
    unlockAt: new Date('2026-10-10T06:45:00.000Z'),
    expiryAt: new Date('2026-10-10T08:00:00.000Z'),
  };
  const manager1Only = [{ status: 'APPROVED', managerSlot: 1 }];
  const manager2Only = [{ status: 'APPROVED', managerSlot: 2 }];
  const bothManagers = [
    ...manager1Only,
    ...manager2Only,
  ];
  const beforeUnlock = new Date('2026-10-10T06:44:59.999Z');
  const insideWindow = new Date('2026-10-10T07:00:00.000Z');
  const afterExpiry = new Date('2026-10-10T08:00:00.001Z');

  assert.equal(makeEligibility(paper, manager1Only, insideWindow).reason, 'APPROVAL_PENDING_M2');
  assert.equal(makeEligibility(paper, manager2Only, insideWindow).reason, 'APPROVAL_PENDING_M1');
  assert.equal(makeEligibility(paper, bothManagers, beforeUnlock).reason, 'BEFORE_UNLOCK_TIME');
  assert.deepEqual(makeEligibility(paper, bothManagers, insideWindow), { allowed: true });
  assert.equal(makeEligibility(paper, bothManagers, afterExpiry).reason, 'AFTER_EXPIRY');
});
