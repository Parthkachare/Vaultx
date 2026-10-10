// Vault security service — enforces dual-auth, time-lock, and role checks
import type { Paper } from '../data/mockData';

export type UnlockDenialReason =
  | 'NOT_AUTHENTICATED'
  | 'UNAUTHORIZED_ROLE'
  | 'APPROVAL_PENDING_M1'
  | 'APPROVAL_PENDING_M2'
  | 'APPROVAL_PENDING_BOTH'
  | 'BEFORE_UNLOCK_TIME'
  | 'AFTER_EXPIRY'
  | 'PAPER_EXPIRED'
  | 'PAPER_NOT_FOUND';

export interface UnlockCheck {
  allowed: boolean;
  reason?: UnlockDenialReason;
  message?: string;
}

// Parse "HH:MM AM/PM" or "HH:MM" into minutes-since-midnight
function parseTimeMins(timeStr: string): number {
  if (!timeStr) return -1;
  const upper = timeStr.trim().toUpperCase();
  const isPm = upper.includes('PM');
  const isAm = upper.includes('AM');
  const clean = upper.replace('AM', '').replace('PM', '').trim();
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  if (isPm && h !== 12) h += 12;
  if (isAm && h === 12) h = 0;
  return h * 60 + m;
}

// Current server time expressed as minutes-since-midnight (uses actual Date)
function nowMins(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

// Returns today's date string as YYYY-MM-DD
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function checkUnlockEligibility(
  paper: Paper | undefined,
  userRole: string,
  testMode = false,
): UnlockCheck {
  if (!paper) return { allowed: false, reason: 'PAPER_NOT_FOUND', message: 'Paper not found.' };

  // Role check — only Exam Controller and Admin can open papers
  const allowedRoles = ['Admin', 'Exam Controller'];
  if (!allowedRoles.includes(userRole)) {
    return { allowed: false, reason: 'UNAUTHORIZED_ROLE', message: 'Your role does not have permission to open question papers.' };
  }

  // Dual approval check
  const m1 = paper.manager1Approved;
  const m2 = paper.manager2Approved;
  if (!m1 && !m2) return { allowed: false, reason: 'APPROVAL_PENDING_BOTH', message: 'Both Manager 1 and Manager 2 must approve this paper before it can be unlocked.' };
  if (!m1) return { allowed: false, reason: 'APPROVAL_PENDING_M1', message: 'Waiting for Manager 1 approval.' };
  if (!m2) return { allowed: false, reason: 'APPROVAL_PENDING_M2', message: 'Waiting for Manager 2 approval.' };

  if (testMode) return { allowed: true };

  // Time-based check — use actual server time (Date.now())
  const today = todayStr();
  const examDay = paper.examDate; // YYYY-MM-DD

  // If exam date is in the future → locked
  if (examDay > today) {
    const unlockMins = parseTimeMins(paper.unlockTime);
    const unlockHH = Math.floor(unlockMins / 60).toString().padStart(2, '0');
    const unlockMM = (unlockMins % 60).toString().padStart(2, '0');
    return {
      allowed: false,
      reason: 'BEFORE_UNLOCK_TIME',
      message: `Paper will be available on ${examDay} at ${unlockHH}:${unlockMM}. Current server time is before the unlock window.`,
    };
  }

  // If exam date was in the past → check expiry
  if (examDay < today) {
    return { allowed: false, reason: 'PAPER_EXPIRED', message: 'This paper\'s access window has expired.' };
  }

  // Exam date is today — check time window
  const current = nowMins();
  const unlockAt = parseTimeMins(paper.unlockTime);
  const expiryAt = parseTimeMins(paper.expiryTime);

  if (current < unlockAt) {
    const remaining = unlockAt - current;
    const h = Math.floor(remaining / 60);
    const m = remaining % 60;
    const waitStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return {
      allowed: false,
      reason: 'BEFORE_UNLOCK_TIME',
      message: `Paper is time-locked. Unlock time: ${paper.unlockTime}. Time remaining: ${waitStr}.`,
    };
  }

  if (expiryAt > 0 && current > expiryAt) {
    return { allowed: false, reason: 'AFTER_EXPIRY', message: `Paper access window expired at ${paper.expiryTime}.` };
  }

  return { allowed: true };
}

export function canManagerApprove(
  paper: Paper,
  managerSlot: 1 | 2,
  userName: string,
  userRole: string,
): { allowed: boolean; reason?: string } {
  // Admin can approve any slot (for emergency admin override)
  if (userRole === 'Admin') return { allowed: true };

  if (managerSlot === 1) {
    if (userRole !== 'Manager 1') return { allowed: false, reason: 'Only a Manager 1 role can submit Manager 1 approval.' };
    if (paper.manager1 !== userName) return { allowed: false, reason: `Only ${paper.manager1} is assigned as Manager 1 for this paper.` };
  } else {
    if (userRole !== 'Manager 2') return { allowed: false, reason: 'Only a Manager 2 role can submit Manager 2 approval.' };
    if (paper.manager2 !== userName) return { allowed: false, reason: `Only ${paper.manager2} is assigned as Manager 2 for this paper.` };
  }

  return { allowed: true };
}

// AES-256-GCM simulation using Web Crypto API
export async function encryptFile(fileBytes: ArrayBuffer): Promise<{
  encryptedData: ArrayBuffer;
  keyHex: string;
  ivHex: string;
  tagHex: string;
}> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer }, key, fileBytes);
  const rawKey = await crypto.subtle.exportKey('raw', key);

  const toHex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    encryptedData: encrypted,
    keyHex: toHex(rawKey),
    ivHex: toHex(iv.buffer as ArrayBuffer),
    tagHex: toHex(encrypted.slice(-16)),
  };
}

export function generateEncryptionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return 'AES256-' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
