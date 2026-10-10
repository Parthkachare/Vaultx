const { query, transaction, modelRow, modelRows } = require('../services/db');
const audit = require('../services/audit');
const security = require('../services/security');
const { issueOtp, consumeOtp, invalidateOtp } = require('../services/otpChallenges');
const { nextApprovalState } = require('../services/approvalState');
const { deliverOtp } = require('../services/otpDelivery');
const notifications = require('../services/notifications');
const { getClientIp } = require('../middleware/auth');

function managerSlotFor(role) {
  return role === 'Manager 1' ? 1 : 2;
}

async function requestApprovalOtp(req, res) {
  const { user } = req;
  const { paperId } = req.body;
  if (typeof paperId !== 'string' || !paperId.trim()) return res.status(400).json({ error: 'Paper ID is required.' });

  const paper = modelRow((await query('SELECT * FROM public.papers WHERE paper_id = $1', [paperId])).rows[0]);
  if (!paper) return res.status(404).json({ error: 'Paper not found.' });
  const slot = managerSlotFor(user.role);
  const assignedId = slot === 1 ? paper.manager1Id : paper.manager2Id;
  if (assignedId !== user._id) {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? '';
    await security.detectUnauthorizedRole(user._id, user.email, `assigned Manager ${slot}`, user.role, ip, userAgent);
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Unassigned manager requested approval OTP — ${paperId}`, paperId, ipAddress: ip, userAgent, status: 'Failed' });
    return res.status(403).json({ error: `You are not the assigned Manager ${slot} for this paper.` });
  }
  const approved = slot === 1 ? paper.manager1Approved : paper.manager2Approved;
  if (approved) return res.status(409).json({ error: `Manager ${slot} has already approved this paper.` });

  const code = await issueOtp({ userId: user._id, purpose: 'approval', paperId: paper.id });
  try {
    await deliverOtp(user.email, code, 'approval');
  } catch (error) {
    await invalidateOtp({ userId: user._id, purpose: 'approval', paperId: paper.id });
    throw error;
  }
  await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Approval OTP requested — ${paperId}`, paperId, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Success' });
  const response = { message: 'OTP sent to your registered email.' };
  if (process.env.NODE_ENV !== 'production') response._devOtp = code;
  return res.json(response);
}

async function submitApproval(req, res) {
  const { user } = req;
  const { paperId, otp } = req.body;
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] ?? '';
  if (typeof paperId !== 'string' || typeof otp !== 'string' || !paperId.trim() || !otp) {
    return res.status(400).json({ error: 'Paper ID and OTP are required.' });
  }

  const paper = modelRow((await query('SELECT * FROM public.papers WHERE paper_id = $1', [paperId])).rows[0]);
  if (!paper) return res.status(404).json({ error: 'Paper not found.' });
  const managerSlot = managerSlotFor(user.role);
  const assignedManagerId = managerSlot === 1 ? paper.manager1Id : paper.manager2Id;
  if (assignedManagerId !== user._id) {
    await security.detectUnauthorizedRole(user._id, user.email, `assigned Manager ${managerSlot}`, user.role, ip, userAgent);
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Unauthorized approval attempt — not assigned manager for ${paperId}`, paperId, ipAddress: ip, userAgent, status: 'Failed' });
    return res.status(403).json({ error: `You are not the assigned Manager ${managerSlot} for this paper.` });
  }
  if (paper.status === 'EXPIRED') return res.status(409).json({ error: 'Expired papers cannot be approved.' });

  if (!await consumeOtp({ userId: user._id, purpose: 'approval', paperId: paper.id, code: otp })) {
    await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Invalid or expired approval OTP — ${paperId}`, paperId, ipAddress: ip, userAgent, status: 'Failed' });
    return res.status(401).json({ error: 'Invalid or expired OTP.' });
  }

  let updatedPaper;
  try {
    updatedPaper = await transaction(async client => {
      const locked = modelRow((await client.query(
        'SELECT * FROM public.papers WHERE id = $1 FOR UPDATE',
        [paper.id],
      )).rows[0]);
      if (!locked || locked.status === 'EXPIRED') {
        const error = new Error('Expired papers cannot be approved.');
        error.code = 'PAPER_EXPIRED';
        throw error;
      }
      const assignedId = managerSlot === 1 ? locked.manager1Id : locked.manager2Id;
      const approved = managerSlot === 1 ? locked.manager1Approved : locked.manager2Approved;
      if (assignedId !== user._id || approved) {
        const error = new Error('Manager has already approved this paper, or is not assigned to this slot.');
        error.code = 'APPROVAL_CONFLICT';
        throw error;
      }
      await client.query(
        `INSERT INTO public.approvals (paper_id, manager_id, manager_slot, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [locked.id, user._id, managerSlot, ip, userAgent],
      );
      const nextState = nextApprovalState(locked, managerSlot);
      const approvedAtColumn = managerSlot === 1 ? 'manager1_approved_at' : 'manager2_approved_at';
      const approvedColumn = managerSlot === 1 ? 'manager1_approved' : 'manager2_approved';
      const { rows } = await client.query(
        `UPDATE public.papers
         SET ${approvedColumn} = true, ${approvedAtColumn} = now(), status = $2
         WHERE id = $1 RETURNING *`,
        [locked.id, nextState.status],
      );
      return modelRow(rows[0]);
    });
  } catch (error) {
    if (error.code === 'PAPER_EXPIRED') return res.status(409).json({ error: 'Expired papers cannot be approved.' });
    if (error.code === 'APPROVAL_CONFLICT' || error.code === '23505') {
      await audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Duplicate or conflicting approval attempt — ${paperId}`, paperId, ipAddress: ip, userAgent, status: 'Failed' });
      return res.status(409).json({ error: `Manager ${managerSlot} has already approved this paper, or it is expired.` });
    }
    throw error;
  }

  const sideEffects = await Promise.allSettled([
    audit.log({ userId: user._id, userEmail: user.email, userName: user.name, role: user.role, action: `Manager ${managerSlot} approval submitted — ${paperId} (OTP verified)`, paperId, ipAddress: ip, userAgent, status: 'Success' }),
    notifications.notifyUser(paper.uploadedBy, 'approval', 'Manager approval recorded', `${user.name} approved ${paper.subject} (${paperId}).`, paperId),
  ]);
  const warnings = [];
  if (sideEffects[0].status === 'rejected') {
    console.error(`Manager ${managerSlot} approval persisted but audit logging failed:`, sideEffects[0].reason);
    warnings.push('Approval is recorded, but its audit event could not be stored.');
  }
  if (sideEffects[1].status === 'rejected') {
    console.error(`Manager ${managerSlot} approval persisted but notification failed:`, sideEffects[1].reason);
    warnings.push('Approval is recorded, but the paper uploader notification could not be stored.');
  }
  return res.json({ message: `Manager ${managerSlot} approval recorded.`, paperStatus: updatedPaper.status, warnings });
}

async function getApprovals(req, res) {
  const paper = modelRow((await query('SELECT * FROM public.papers WHERE paper_id = $1', [req.params.paperId])).rows[0]);
  if (!paper) return res.status(404).json({ error: 'Paper not found.' });
  const assigned = [paper.manager1Id, paper.manager2Id].includes(req.user._id);
  if (!assigned && !['Admin', 'Exam Controller'].includes(req.user.role)) {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] ?? '';
    await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: `Unauthorized approval history access — ${req.params.paperId}`, paperId: req.params.paperId, ipAddress: ip, userAgent, status: 'Failed' });
    return res.status(403).json({ error: 'You are not authorized to view this approval history.' });
  }
  const { rows } = await query(
    `SELECT a.*, u.name AS manager_name, u.email AS manager_email, u.role AS manager_role
     FROM public.approvals a JOIN public.users u ON u.id = a.manager_id
     WHERE a.paper_id = $1 ORDER BY a.manager_slot`,
    [paper.id],
  );
  return res.json(modelRows(rows).map(approval => {
    const managerId = approval.managerId;
    const manager = {
      _id: managerId,
      name: approval.managerName,
      email: approval.managerEmail,
      role: approval.managerRole,
    };
    delete approval.managerName;
    delete approval.managerEmail;
    delete approval.managerRole;
    approval.managerId = manager;
    return approval;
  }));
}

module.exports = { requestApprovalOtp, submitApproval, getApprovals };
