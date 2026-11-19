const test = require('node:test');
const assert = require('node:assert/strict');
const { checkSchedule, parseTimeMinutes, scheduleInstants, scheduleTimestamp, validateSchedule } = require('./timeWindow');

test('parses 12-hour and 24-hour times into minutes', () => {
  assert.equal(parseTimeMinutes('12:00 AM'), 0);
  assert.equal(parseTimeMinutes('12:00 PM'), 720);
  assert.equal(parseTimeMinutes('23:59'), 1439);
  assert.equal(parseTimeMinutes('24:00'), null);
  assert.equal(parseTimeMinutes('09:60 AM'), null);
});

test('IST schedule boundaries include unlock and expiry instants', () => {
  const unlock = scheduleTimestamp('2030-06-15', '09:30');
  const expiry = scheduleTimestamp('2030-06-15', '13:00');
  assert.equal(checkSchedule('2030-06-15', '09:30', '13:00', new Date(unlock - 1)).reason, 'BEFORE_UNLOCK_TIME');
  assert.deepEqual(checkSchedule('2030-06-15', '09:30', '13:00', new Date(unlock)), { allowed: true });
  assert.deepEqual(checkSchedule('2030-06-15', '09:30', '13:00', new Date(expiry)), { allowed: true });
  assert.equal(checkSchedule('2030-06-15', '09:30', '13:00', new Date(expiry + 1)).reason, 'AFTER_EXPIRY');
});

test('IST schedule values persist as equivalent UTC instants', () => {
  const schedule = scheduleInstants('2030-06-15', '09:30', '08:00', '13:00');
  assert.equal(schedule.examStartAt.toISOString(), '2030-06-15T04:00:00.000Z');
  assert.equal(schedule.unlockAt.toISOString(), '2030-06-15T02:30:00.000Z');
  assert.equal(schedule.expiryAt.toISOString(), '2030-06-15T07:30:00.000Z');
});

test('validates early-morning IST times even when they fall on the previous UTC date', () => {
  assert.equal(scheduleTimestamp('2030-06-15', '00:15'), Date.parse('2030-06-14T18:45:00.000Z'));
});

test('rejects invalid dates and improperly ordered schedules', () => {
  assert.equal(scheduleTimestamp('2030-02-30', '09:00'), null);
  assert.equal(validateSchedule('2030-06-15', '09:00', '10:00', '13:00'), 'Unlock time must be at or before the exam start.');
  assert.equal(validateSchedule('2030-06-15', '09:00', '08:00', '09:00'), 'Expiry must be after the exam start and unlock time.');
  assert.equal(validateSchedule('2030-06-15', '09:00', '08:00', '13:00'), null);
});
