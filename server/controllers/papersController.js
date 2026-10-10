const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const encryption = require('../services/encryption');
const { query, modelRow, modelRows } = require('../services/db');
const storage = require('../services/storage');
const audit = require('../services/audit');
const security = require('../services/security');
const { scheduleInstants, validateSchedule } = require('../services/timeWindow');
const notifications = require('../services/notifications');
const { getClientIp } = require('../middleware/auth');
const { setReleaseDiagnostic } = require('../middleware/releaseDiagnostics');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function makeHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function logUploadError(stage, error) {
  const rawMessage = typeof error?.message === 'string' ? error.message : 'Unknown upload error.';
  const message = rawMessage
    .replace(/Bearer\s+[^\s,]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/\b(password|jwt|token|secret|otp|(?:master|service[-_ ]role)[-_ ]?key)\b(\s*[:=]\s*)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/\b[0-9a-f]{64}\b/gi, '[redacted]')
    .slice(0, 400);
  console.error('Paper upload stage failed:', {
    stage,
    code: typeof error?.code === 'string' ? error.code.slice(0, 64) : null,
    message,
  });
  if (error && typeof error === 'object') error.uploadDiagnosticLogged = true;
}

function removeFile(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function makeEligibility(paper, approvals, now) {
  const approvedSlots = new Set(
    approvals.filter(approval => approval.status === 'APPROVED').map(approval => approval.managerSlot),
  );
  if (paper.status === 'EXPIRED') {
    return { allowed: false, reason: 'PAPER_EXPIRED', message: 'This paper access window has expired.' };
  }
  if (!approvedSlots.has(1) || !approvedSlots.has(2)) {
    const reason = !approvedSlots.has(1) && !approvedSlots.has(2)
      ? 'APPROVAL_PENDING_BOTH'
      : !approvedSlots.has(1) ? 'APPROVAL_PENDING_M1' : 'APPROVAL_PENDING_M2';
    return { allowed: false, reason, message: 'Both assigned managers must approve this paper before it can be opened.' };
  }
  const unlockAt = new Date(paper.unlockAt).getTime();
  const expiryAt = new Date(paper.expiryAt).getTime();
  const nowAt = now.getTime();
  if (!Number.isFinite(unlockAt) || !Number.isFinite(expiryAt)) {
    return { allowed: false, reason: 'INVALID_SCHEDULE', message: 'Paper schedule is invalid. Contact an administrator.' };
  }
  if (nowAt < unlockAt) {
    return { allowed: false, reason: 'BEFORE_UNLOCK_TIME', message: `Paper unlocks at ${new Date(unlockAt).toISOString()}.` };
  }
  if (nowAt > expiryAt) {
    paper.status = 'EXPIRED';
    return { allowed: false, reason: 'AFTER_EXPIRY', message: `Paper access window expired at ${new Date(expiryAt).toISOString()}.` };
  }
  return { allowed: true };
}

function formattedUtcTime(value) {
  const date = new Date(value);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function formattedExamDate(value) {
  if (typeof value === 'string') return value.slice(0, 10);
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('Paper exam date from PostgreSQL is invalid.');
  }
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function paperResponse(row) {
  const paper = modelRow(row);
  if (!paper) return null;
  return {
    _id: paper.id,
    paperId: paper.paperId,
    examName: paper.examName,
    subject: paper.subject,
    course: paper.course,
    examDate: formattedExamDate(paper.examDate),
    examStartTime: formattedUtcTime(paper.examStartAt),
    unlockTime: formattedUtcTime(paper.unlockAt),
    expiryTime: formattedUtcTime(paper.expiryAt),
    manager1: paper.manager1,
    manager2: paper.manager2,
    manager1Approved: paper.manager1Approved,
    manager2Approved: paper.manager2Approved,
    manager1ApprovedAt: paper.manager1ApprovedAt,
    manager2ApprovedAt: paper.manager2ApprovedAt,
    uploadedBy: paper.uploadedBy,
    encryptionId: paper.encryptionKeyId,
    originalFilename: paper.originalFilename,
    fileSizeBytes: Number(paper.fileSizeBytes),
    status: paper.status,
    securityLevel: paper.securityLevel,
    createdAt: paper.createdAt,
  };
}

function mapJoinedPaper(row) {
  const response = paperResponse(row);
  if (!response) return null;
  response.manager1 = row.manager1_user_id ? {
    _id: row.manager1_user_id,
    name: row.manager1_user_name,
    email: row.manager1_user_email,
    role: row.manager1_user_role,
  } : response.manager1;
  response.manager2 = row.manager2_user_id ? {
    _id: row.manager2_user_id,
    name: row.manager2_user_name,
    email: row.manager2_user_email,
    role: row.manager2_user_role,
  } : response.manager2;
  response.uploadedBy = row.uploader_user_id ? {
    _id: row.uploader_user_id,
    name: row.uploader_user_name,
    email: row.uploader_user_email,
  } : response.uploadedBy;
  return response;
}

async function upload(req, res) {
  const { user } = req;
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  let encryptedFilePath;
  let storageObjectPath;
  let storageAttempted = false;
  let persisted = false;
  let paperId;
  let stage = 'pdf_validation';

  try {
    if (!req.file) throw makeHttpError(400, 'No PDF file uploaded.');
    if (req.file.size > MAX_FILE_SIZE) throw makeHttpError(400, 'File size exceeds 50MB limit.');
    const fileHandle = await fs.promises.open(req.file.path, 'r');
    const signature = Buffer.alloc(5);
    try {
      await fileHandle.read(signature, 0, 5, 0);
    } finally {
      await fileHandle.close();
    }
    if (req.file.mimetype !== 'application/pdf' || signature.toString('ascii') !== '%PDF-') {
      throw makeHttpError(400, 'Only valid PDF files are accepted.');
    }

    stage = 'metadata_validation';
    const { examName, subject, course, examDate, examStartTime, unlockTime, expiryTime, manager1Id, manager2Id } = req.body;
    if (![examName, subject, course, examDate, examStartTime, unlockTime, expiryTime, manager1Id, manager2Id]
      .every(value => typeof value === 'string' && value.trim())) {
      throw makeHttpError(400, 'All exam details are required.');
    }
    stage = 'schedule_validation';
    const scheduleError = validateSchedule(examDate, examStartTime, unlockTime, expiryTime);
    if (scheduleError) throw makeHttpError(400, scheduleError);
    const schedule = scheduleInstants(examDate, examStartTime, unlockTime, expiryTime);
    if (manager1Id === manager2Id) throw makeHttpError(400, 'Manager 1 and Manager 2 must be different people.');

    stage = 'manager_lookup';
    const { rows: managers } = await query(
      `SELECT * FROM public.users
       WHERE id = ANY($1::uuid[]) AND is_active = true AND is_deleted = false`,
      [[manager1Id, manager2Id]],
    );
    const manager1 = managers.map(modelRow).find(item => item.id === manager1Id);
    const manager2 = managers.map(modelRow).find(item => item.id === manager2Id);
    if (!manager1 || manager1.role !== 'Manager 1') throw makeHttpError(400, 'Select an active Manager 1 account.');
    if (!manager2 || manager2.role !== 'Manager 2') throw makeHttpError(400, 'Select an active Manager 2 account.');

    stage = 'encryption';
    const encrypted = encryption.encryptFile(req.file.path, UPLOADS_DIR);
    encryptedFilePath = encrypted.encryptedFilePath;
    const encryptedBytes = await fs.promises.readFile(encryptedFilePath);
    storageObjectPath = `${crypto.randomUUID()}.enc`;

    stage = 'paper_id_allocation';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = encryption.generatePaperId();
      const exists = await query('SELECT 1 FROM public.papers WHERE paper_id = $1', [candidate]);
      if (!exists.rowCount) {
        paperId = candidate;
        break;
      }
    }
    if (!paperId) throw makeHttpError(503, 'Could not allocate a unique paper ID. Please retry.');

    stage = 'storage_upload';
    storageAttempted = true;
    await storage.uploadEncrypted(storageObjectPath, encryptedBytes);
    stage = 'database_insert';
    const { rows } = await query(
      `INSERT INTO public.papers
         (paper_id, exam_name, subject, course, exam_date, exam_start_at, unlock_at, expiry_at,
          manager1_id, manager2_id, uploaded_by, storage_object_path, encryption_key_id,
          wrapped_encryption_key, key_wrapping_iv, key_wrapping_tag, encryption_iv,
          encryption_tag, original_filename, file_size_bytes, status, security_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'LOCKED', 'HIGH')
       RETURNING *`,
      [
        paperId,
        examName.trim(),
        subject.trim(),
        course.trim(),
        examDate,
        schedule.examStartAt,
        schedule.unlockAt,
        schedule.expiryAt,
        manager1.id,
        manager2.id,
        user._id,
        storageObjectPath,
        encryption.generateKeyId(),
        encrypted.wrappedEncryptionKey,
        encrypted.keyWrappingIv,
        encrypted.keyWrappingTag,
        encrypted.ivHex,
        encrypted.tagHex,
        path.basename(req.file.originalname),
        req.file.size,
      ],
    );
    persisted = true;
    const paper = modelRow(rows[0]);

    const sideEffects = await Promise.allSettled([
      notifications.notifyUser(manager1.id, 'approval', 'Approval required', `${subject.trim()} (${paperId}) requires your Manager 1 approval.`, paperId),
      notifications.notifyUser(manager2.id, 'approval', 'Approval required', `${subject.trim()} (${paperId}) requires your Manager 2 approval.`, paperId),
      audit.log({
        userId: user._id, userEmail: user.email, userName: user.name, role: user.role,
        action: `Paper uploaded and encrypted — ${subject.trim()} (${paperId})`,
        paperId, ipAddress: ip, userAgent, status: 'Success',
      }),
    ]);
    const warnings = [];
    if (sideEffects[0].status === 'rejected' || sideEffects[1].status === 'rejected') {
      sideEffects.slice(0, 2).forEach(result => {
        if (result.status === 'rejected') logUploadError('manager_notification', result.reason);
      });
      warnings.push('Paper is persisted, but one or more manager notifications could not be recorded.');
    }
    if (sideEffects[2].status === 'rejected') {
      logUploadError('success_audit_logging', sideEffects[2].reason);
      warnings.push('Paper is persisted, but its upload audit event could not be recorded.');
    }
    return res.status(201).json({ paperId: paper.paperId, message: 'Paper uploaded and encrypted successfully.', status: paper.status, warnings });
  } catch (error) {
    if (error.code === '23505') {
      error.status = 409;
      error.message = 'A paper with this ID already exists. Please retry the upload.';
    }
    logUploadError(stage, error);
    if (paperId) {
      try {
        await audit.log({
          userId: user._id, userEmail: user.email, userName: user.name, role: user.role,
          action: `Paper upload failed — ${paperId}`,
          paperId, ipAddress: ip, userAgent, status: 'Failed',
        });
      } catch (auditError) {
        logUploadError('failure_audit_logging', auditError);
      }
    }
    throw error;
  } finally {
    if (req.file?.path) removeFile(req.file.path);
    if (encryptedFilePath) removeFile(encryptedFilePath);
    if (!persisted && storageAttempted && storageObjectPath) {
      try {
        await storage.removeEncrypted(storageObjectPath);
      } catch (cleanupError) {
        logUploadError('storage_cleanup', cleanupError);
      }
    }
  }
}

const PAPER_WITH_USERS = `
  SELECT p.*,
         m1.id AS manager1_user_id, m1.name AS manager1_user_name,
         m1.email AS manager1_user_email, m1.role AS manager1_user_role,
         m2.id AS manager2_user_id, m2.name AS manager2_user_name,
         m2.email AS manager2_user_email, m2.role AS manager2_user_role,
         uploader.id AS uploader_user_id, uploader.name AS uploader_user_name,
         uploader.email AS uploader_user_email
  FROM public.papers p
  JOIN public.users m1 ON m1.id = p.manager1_id
  JOIN public.users m2 ON m2.id = p.manager2_id
  JOIN public.users uploader ON uploader.id = p.uploaded_by`;

async function list(_req, res) {
  const { rows } = await query(`${PAPER_WITH_USERS} ORDER BY p.created_at DESC`);
  return res.json(rows.map(mapJoinedPaper));
}

async function getById(req, res) {
  const { rows } = await query(`${PAPER_WITH_USERS} WHERE p.paper_id = $1`, [req.params.paperId]);
  if (!rows[0]) return res.status(404).json({ error: 'Paper not found.' });
  return res.json(mapJoinedPaper(rows[0]));
}

async function getApprovals(paperId) {
  const { rows } = await query(
    `SELECT manager_slot, status FROM public.approvals WHERE paper_id = $1`,
    [paperId],
  );
  return modelRows(rows);
}

async function eligibility(req, res) {
  setReleaseDiagnostic(req, { stage: 'paper_lookup' });
  const { paperId } = req.params;
  const paper = modelRow((await query('SELECT * FROM public.papers WHERE paper_id = $1', [paperId])).rows[0]);
  if (!paper) {
    setReleaseDiagnostic(req, { releaseDecision: 'paper_not_found' });
    return res.status(404).json({ error: 'Paper not found.' });
  }
  setReleaseDiagnostic(req, { stage: 'approval_and_time_window_checks' });
  const result = makeEligibility(paper, await getApprovals(paper.id), new Date());
  setReleaseDiagnostic(req, {
    releaseDecision: result.allowed ? 'eligible' : result.reason,
  });
  if (paper.status === 'EXPIRED') await query("UPDATE public.papers SET status = 'EXPIRED' WHERE id = $1", [paper.id]);
  else if (result.reason === 'AFTER_EXPIRY') await query("UPDATE public.papers SET status = 'EXPIRED' WHERE id = $1", [paper.id]);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  await audit.log({
    userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role,
    action: result.allowed ? `Paper eligibility verified — ${paperId}` : `Paper eligibility denied — ${paperId}: ${result.reason}`,
    paperId, ipAddress, userAgent, status: result.allowed ? 'Success' : 'Failed',
  });
  if (!result.allowed) await security.checkUnlockAttempt(req.user._id, paperId, ipAddress, userAgent, true);
  setReleaseDiagnostic(req, { stage: 'eligibility_response' });
  return res.json({ ...result, serverTime: new Date().toISOString() });
}

async function view(req, res) {
  const { user } = req;
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  const { paperId } = req.params;
  setReleaseDiagnostic(req, { stage: 'paper_lookup' });
  const paper = modelRow((await query('SELECT * FROM public.papers WHERE paper_id = $1', [paperId])).rows[0]);
  if (!paper) {
    setReleaseDiagnostic(req, { releaseDecision: 'paper_not_found' });
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Paper view denied — not found (${paperId})`, paperId, ipAddress, userAgent, status: 'Failed' });
    return res.status(404).json({ error: 'Paper not found.' });
  }

  setReleaseDiagnostic(req, { stage: 'approval_and_time_window_checks' });
  const result = makeEligibility(paper, await getApprovals(paper.id), new Date());
  setReleaseDiagnostic(req, {
    releaseDecision: result.allowed ? 'eligible' : result.reason,
  });
  if (paper.status === 'EXPIRED' || result.reason === 'AFTER_EXPIRY') {
    await query("UPDATE public.papers SET status = 'EXPIRED' WHERE id = $1", [paper.id]);
  }
  if (!result.allowed) {
    await security.checkUnlockAttempt(user._id, paperId, ipAddress, userAgent, true);
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Paper view denied — ${paperId}: ${result.reason}`, paperId, ipAddress, userAgent, status: 'Failed' });
    return res.status(403).json({ error: result.message, reason: result.reason, serverTime: new Date().toISOString() });
  }

  setReleaseDiagnostic(req, { stage: 'encrypted_storage_download' });
  const encryptedBytes = await storage.downloadEncrypted(paper.storageObjectPath);
  setReleaseDiagnostic(req, { stage: 'aes_256_gcm_decryption' });
  const pdfBuffer = encryption.decryptBuffer(encryptedBytes, {
    wrappedEncryptionKey: paper.wrappedEncryptionKey,
    keyWrappingIv: paper.keyWrappingIv,
    keyWrappingTag: paper.keyWrappingTag,
    ivHex: paper.encryptionIv,
    tagHex: paper.encryptionTag,
  });
  setReleaseDiagnostic(req, { stage: 'view_audit_and_status_update' });
  security.resetUnlockAttempts(user._id, paperId);
  await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Paper viewed — ${paperId} opened in secure viewer`, paperId, ipAddress, userAgent, status: 'Success' });
  if (paper.status !== 'UNLOCKED') {
    await query("UPDATE public.papers SET status = 'UNLOCKED' WHERE id = $1", [paper.id]);
  }
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline',
    'X-VaultX-Viewer': user.name,
    'X-VaultX-Paper': paperId,
    'X-VaultX-Timestamp': new Date().toISOString(),
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Frame-Options': 'SAMEORIGIN',
  });
  setReleaseDiagnostic(req, { stage: 'pdf_response' });
  return res.send(pdfBuffer);
}

async function requestPrint(req, res) {
  const { user } = req;
  const { paperId } = req.params;
  const paper = modelRow((await query('SELECT * FROM public.papers WHERE paper_id = $1', [paperId])).rows[0]);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  if (!paper) {
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `PDF print denied — not found (${paperId})`, paperId, ipAddress, userAgent, status: 'Failed' });
    return res.status(404).json({ error: 'Paper not found.' });
  }
  const result = makeEligibility(paper, await getApprovals(paper.id), new Date());
  if (paper.status === 'EXPIRED' || result.reason === 'AFTER_EXPIRY') {
    await query("UPDATE public.papers SET status = 'EXPIRED' WHERE id = $1", [paper.id]);
  }
  if (!result.allowed) {
    await security.checkUnlockAttempt(user._id, paperId, ipAddress, userAgent, true);
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `PDF print denied — ${paperId}: ${result.reason}`, paperId, ipAddress, userAgent, status: 'Failed' });
    return res.status(403).json({ error: result.message, reason: result.reason });
  }
  await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `PDF print requested — ${paperId}`, paperId, ipAddress, userAgent, status: 'Success' });
  return res.json({ message: 'PDF print request recorded.' });
}

module.exports = { upload, list, getById, eligibility, view, requestPrint, makeEligibility, paperResponse };
