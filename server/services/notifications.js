const { query, modelRow } = require('./db');

async function notifyUser(recipient, type, title, message, paperId) {
  if (!recipient) return null;
  const { rows } = await query(
    `INSERT INTO public.notifications (recipient, type, title, message, paper_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [recipient, type, title, message, paperId ?? null],
  );
  return modelRow(rows[0]);
}

module.exports = { notifyUser };
