const test = require('node:test');
const assert = require('node:assert/strict');
const { nextApprovalState } = require('./approvalState');

test('first assigned manager approval leaves paper awaiting approval', () => {
  assert.deepEqual(
    nextApprovalState({ manager1Approved: false, manager2Approved: false }, 1),
    { manager1Approved: true, manager2Approved: false, status: 'AWAITING_APPROVAL' },
  );
});

test('second assigned manager approval completes both approval slots', () => {
  assert.deepEqual(
    nextApprovalState({ manager1Approved: true, manager2Approved: false }, 2),
    { manager1Approved: true, manager2Approved: true, status: 'APPROVED' },
  );
});

test('approval state rejects invalid manager slots', () => {
  assert.throws(() => nextApprovalState({ manager1Approved: false, manager2Approved: false }, 3));
});
