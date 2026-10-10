const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be configured for the VaultX PostgreSQL connection.');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));
  }
  return pool;
}

async function query(text, values) {
  return getPool().query(text, values);
}

async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('PostgreSQL transaction rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}

function isConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function modelRow(row) {
  if (!row) return null;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    result[key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase())] = value;
  }
  if (result.id !== undefined) result._id = result.id;
  return result;
}

function modelRows(rows) {
  return rows.map(modelRow);
}

module.exports = { query, transaction, closePool, isConfigured, modelRow, modelRows };
