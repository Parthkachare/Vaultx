const { query, modelRows, modelRow } = require('../services/db');
const audit = require('../services/audit');
const { getClientIp } = require('../middleware/auth');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getLogs(req, res) {
  const { page = '1', limit = '50', paperId, status, search } = req.query;
  const pageNumber = Number(page);
  const pageSize = Number(limit);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    return res.status(400).json({ error: 'Page must be positive and limit must be between 1 and 500.' });
  }
  if (status && !['Success', 'Failed', 'Warning'].includes(status)) return res.status(400).json({ error: 'Unsupported audit status.' });

  const conditions = [];
  const values = [];
  if (req.user.role === 'Exam Controller') {
    values.push(req.user._id);
    conditions.push(`user_id = $${values.length}`);
  }
  if (paperId) {
    values.push(paperId);
    conditions.push(`paper_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  if (typeof search === 'string' && search.trim()) {
    values.push(`%${search.trim().replace(/[\\%_]/g, '\\$&')}%`);
    const parameter = `$${values.length}`;
    conditions.push(`(
      action ILIKE ${parameter} ESCAPE '\\'
      OR user_name ILIKE ${parameter} ESCAPE '\\'
      OR user_email ILIKE ${parameter} ESCAPE '\\'
      OR role ILIKE ${parameter} ESCAPE '\\'
      OR COALESCE(paper_id, '') ILIKE ${parameter} ESCAPE '\\'
      OR ip_address ILIKE ${parameter} ESCAPE '\\'
    )`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows: countRows } = await query(`SELECT count(*)::integer AS total FROM public.audit_logs ${where}`, values);
  const total = countRows[0].total;
  const pageValues = [...values, pageSize, (pageNumber - 1) * pageSize];
  const { rows } = await query(
    `SELECT * FROM public.audit_logs ${where}
     ORDER BY timestamp DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    pageValues,
  );
  return res.json({ logs: modelRows(rows), total, page: pageNumber, pages: Math.ceil(total / pageSize) });
}

async function getLogStats(req, res) {
  const values = [];
  const where = req.user.role === 'Exam Controller'
    ? (values.push(req.user._id), `WHERE user_id = $${values.length}`)
    : '';
  const { rows } = await query(
    `SELECT count(*)::integer AS total,
            count(*) FILTER (WHERE status = 'Success')::integer AS success,
            count(*) FILTER (WHERE status = 'Failed')::integer AS failed,
            count(*) FILTER (WHERE status = 'Warning')::integer AS warning
     FROM public.audit_logs ${where}`,
    values,
  );
  return res.json(rows[0]);
}

async function getSecurityEvents(req, res) {
  const values = [];
  let where = '';
  if (req.query.resolved !== undefined) {
    values.push(req.query.resolved === 'true');
    where = `WHERE resolved = $1`;
  }
  const { rows } = await query(
    `SELECT * FROM public.security_events ${where} ORDER BY timestamp DESC LIMIT 100`,
    values,
  );
  return res.json(modelRows(rows));
}

async function resolveSecurityEvent(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(400).json({ error: 'Invalid security event ID.' });
  const event = modelRow((await query(
    `UPDATE public.security_events
     SET resolved = true, resolved_by = $2, resolved_at = now()
     WHERE id = $1 AND resolved = false RETURNING *`,
    [req.params.id, req.user._id],
  )).rows[0]);
  if (!event) {
    await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: `Failed security event resolution — ${req.params.id}`, ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '', status: 'Failed' });
    return res.status(404).json({ error: 'Event not found or already resolved.' });
  }
  await audit.log({
    userId: req.user._id,
    userEmail: req.user.email,
    userName: req.user.name,
    role: req.user.role,
    action: `Security event resolved — ${event.eventType}`,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? '',
    status: 'Success',
  });
  return res.json(event);
}

module.exports = { getLogs, getLogStats, getSecurityEvents, resolveSecurityEvent };
