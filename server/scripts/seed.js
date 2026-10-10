require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const passwords = require('../services/passwords');
const { transaction, closePool } = require('../services/db');

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured before seeding.');
  if (!process.env.SEED_USERS_JSON) throw new Error('SEED_USERS_JSON must contain one or more initial user records.');

  let records;
  try {
    records = JSON.parse(process.env.SEED_USERS_JSON);
  } catch {
    throw new Error('SEED_USERS_JSON must be valid JSON.');
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('SEED_USERS_JSON must be a non-empty array.');
  }

  let inserted = 0;
  await transaction(async client => {
    for (const record of records) {
      const { name, email, password, role, department = '' } = record;
      if (![name, email, password].every(value => typeof value === 'string' && value.trim())) {
        throw new Error('Every seed user requires name, email, and password.');
      }
      if (!['Admin', 'Exam Controller', 'Manager 1', 'Manager 2'].includes(role)) {
        throw new Error(`Unsupported seed role: ${role}`);
      }
      if (password.length < 12) throw new Error(`Seed password for ${email} must be at least 12 characters.`);
      const normalizedEmail = email.toLowerCase().trim();
      const passwordHash = await passwords.hashPassword(password);
      const result = await client.query(
        `INSERT INTO public.users (name, email, password_hash, role, department)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [name.trim(), normalizedEmail, passwordHash, role, typeof department === 'string' ? department.trim() : ''],
      );
      inserted += result.rowCount;
    }
  });
  console.log(`Seeded ${inserted} new account(s); existing accounts were preserved.`);
}

seed()
  .catch(error => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
