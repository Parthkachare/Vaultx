const crypto = require('crypto');
const { query, transaction } = require('./db');

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(challengeId, code) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured to protect OTP challenges.');
  return crypto.createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}

async function issueOtp({ userId, purpose, paperId = null }) {
  const challengeId = crypto.randomUUID();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  await transaction(async client => {
    await client.query(
      `UPDATE public.otp_challenges
       SET invalidated_at = now()
       WHERE user_id = $1 AND purpose = $2
         AND paper_id IS NOT DISTINCT FROM $3
         AND consumed_at IS NULL AND invalidated_at IS NULL`,
      [userId, purpose, paperId],
    );
    await client.query(
      `INSERT INTO public.otp_challenges
         (id, user_id, purpose, paper_id, code_hash, expires_at, max_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [challengeId, userId, purpose, paperId, hashOtp(challengeId, code), expiresAt, OTP_MAX_ATTEMPTS],
    );
  });
  return code;
}

async function consumeOtp({ userId, purpose, code, paperId = null }) {
  return transaction(async client => {
    const { rows } = await client.query(
      `SELECT id, code_hash, attempts, max_attempts
       FROM public.otp_challenges
       WHERE user_id = $1 AND purpose = $2
         AND paper_id IS NOT DISTINCT FROM $3
         AND consumed_at IS NULL AND invalidated_at IS NULL
         AND expires_at > now() AND attempts < max_attempts
       ORDER BY created_at DESC
       LIMIT 1 FOR UPDATE`,
      [userId, purpose, paperId],
    );
    const challenge = rows[0];
    if (!challenge) return false;

    const expected = Buffer.from(challenge.code_hash, 'hex');
    const supplied = Buffer.from(hashOtp(challenge.id, code), 'hex');
    const valid = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    if (valid) {
      await client.query(
        'UPDATE public.otp_challenges SET consumed_at = now() WHERE id = $1',
        [challenge.id],
      );
      return true;
    }

    const attempts = challenge.attempts + 1;
    await client.query(
      `UPDATE public.otp_challenges
       SET attempts = $2,
           invalidated_at = CASE WHEN $2 >= max_attempts THEN now() ELSE NULL END
       WHERE id = $1`,
      [challenge.id, attempts],
    );
    return false;
  });
}

async function invalidateOtp({ userId, purpose, paperId = null }) {
  await query(
    `UPDATE public.otp_challenges SET invalidated_at = now()
     WHERE user_id = $1 AND purpose = $2
       AND paper_id IS NOT DISTINCT FROM $3
       AND consumed_at IS NULL AND invalidated_at IS NULL`,
    [userId, purpose, paperId],
  );
}

module.exports = { issueOtp, consumeOtp, invalidateOtp };
