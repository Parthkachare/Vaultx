const { query, modelRow, modelRows } = require('../services/db');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function list(req, res) {
  const { rows } = await query(
    `SELECT * FROM public.notifications
     WHERE recipient = $1 ORDER BY created_at DESC LIMIT 200`,
    [req.user._id],
  );
  return res.json(modelRows(rows));
}

async function markRead(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'Notification not found.' });
  const notification = modelRow((await query(
    `UPDATE public.notifications SET is_read = true
     WHERE id = $1 AND recipient = $2 RETURNING *`,
    [req.params.id, req.user._id],
  )).rows[0]);
  if (!notification) return res.status(404).json({ error: 'Notification not found.' });
  return res.json(notification);
}

async function markAllRead(req, res) {
  const result = await query(
    `UPDATE public.notifications SET is_read = true
     WHERE recipient = $1 AND is_read = false`,
    [req.user._id],
  );
  return res.json({ modifiedCount: result.rowCount });
}

module.exports = { list, markRead, markAllRead };
