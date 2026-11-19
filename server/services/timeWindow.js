function parseTimeMinutes(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();

  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour === 0)) return null;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function scheduleTimestamp(date, time) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const minutes = parseTimeMinutes(time);
  if (minutes === null) return null;
  const [year, month, day] = date.split('-').map(Number);
  const dateTimestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(dateTimestamp);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return dateTimestamp + minutes * 60 * 1000 - 330 * 60 * 1000;
}

function scheduleInstants(examDate, examStartTime, unlockTime, expiryTime) {
  const examStartAt = scheduleTimestamp(examDate, examStartTime);
  const unlockAt = scheduleTimestamp(examDate, unlockTime);
  const expiryAt = scheduleTimestamp(examDate, expiryTime);
  if (examStartAt === null || unlockAt === null || expiryAt === null) return null;
  return {
    examStartAt: new Date(examStartAt),
    unlockAt: new Date(unlockAt),
    expiryAt: new Date(expiryAt),
  };
}

function validateSchedule(examDate, examStartTime, unlockTime, expiryTime) {
  const start = scheduleTimestamp(examDate, examStartTime);
  const unlock = scheduleTimestamp(examDate, unlockTime);
  const expiry = scheduleTimestamp(examDate, expiryTime);
  if (start === null || unlock === null || expiry === null) return 'Exam date and times must be valid.';
  if (unlock > start) return 'Unlock time must be at or before the exam start.';
  if (expiry <= start || expiry <= unlock) return 'Expiry must be after the exam start and unlock time.';
  return null;
}

function checkSchedule(examDate, unlockTime, expiryTime, now = new Date()) {
  const unlockAt = scheduleTimestamp(examDate, unlockTime);
  const expiryAt = scheduleTimestamp(examDate, expiryTime);
  if (unlockAt === null || expiryAt === null) {
    return { allowed: false, reason: 'INVALID_SCHEDULE', message: 'Paper schedule is invalid. Contact an administrator.' };
  }
  const nowAt = now.getTime();
  if (nowAt < unlockAt) {
    return { allowed: false, reason: 'BEFORE_UNLOCK_TIME', message: `Paper unlocks at ${new Date(unlockAt).toISOString()}.` };
  }
  if (nowAt > expiryAt) {
    return { allowed: false, reason: 'AFTER_EXPIRY', message: `Paper access window expired at ${new Date(expiryAt).toISOString()}.` };
  }
  return { allowed: true };
}

module.exports = { parseTimeMinutes, scheduleTimestamp, scheduleInstants, validateSchedule, checkSchedule };
