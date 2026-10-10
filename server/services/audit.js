const { query, modelRow } = require('./db');

async function log({ userId, userEmail, userName, role, action, paperId, ipAddress, userAgent, status }) {
  const { rows } = await query(
    `INSERT INTO public.audit_logs
       (user_id, user_email, user_name, role, action, paper_id, ip_address, user_agent, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId ?? null, userEmail ?? '', userName ?? '', role ?? '', action, paperId ?? null, ipAddress, userAgent ?? '', status ?? 'Success'],
  );
  return modelRow(rows[0]);
}

async function logSecurityEvent({ userId, userEmail, eventType, riskLevel, description, ipAddress, userAgent }) {
  const { rows } = await query(
    `INSERT INTO public.security_events
       (user_id, user_email, event_type, risk_level, description, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId ?? null, userEmail ?? '', eventType, riskLevel ?? 'Medium', description, ipAddress, userAgent ?? ''],
  );
  return modelRow(rows[0]);
}

module.exports = { log, logSecurityEvent };
