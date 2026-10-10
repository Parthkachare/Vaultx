const passwords = require('../services/passwords');
const { query, modelRow, modelRows, transaction } = require('../services/db');
const audit = require('../services/audit');
const { getClientIp } = require('../middleware/auth');

const ROLES = ['Admin', 'Exam Controller', 'Manager 1', 'Manager 2'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    phone: user.phone ?? '',
    status: user.isActive ? 'Active' : 'Inactive',
    isActive: user.isActive,
    lastActive: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : 'Never',
  };
}

function clientDetails(req) {
  return { ipAddress: getClientIp(req), userAgent: req.headers['user-agent'] ?? '' };
}

async function listUsers(_req, res) {
  const { rows } = await query(
    'SELECT * FROM public.users WHERE is_deleted = false ORDER BY name ASC',
  );
  return res.json(modelRows(rows).map(safeUser));
}

async function listApprovers(_req, res) {
  const { rows } = await query(
    `SELECT id, name, email, role, department
     FROM public.users
     WHERE is_active = true AND is_deleted = false AND role = ANY($1)
     ORDER BY name ASC`,
    [['Manager 1', 'Manager 2']],
  );
  return res.json(modelRows(rows).map(user => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    status: 'Active',
  })));
}

async function createUser(req, res) {
  const { name, email, role, department = '', password } = req.body;
  if (typeof name !== 'string' || !name.trim()
    || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    || typeof password !== 'string' || password.length < 12
    || !ROLES.includes(role)) {
    return res.status(400).json({ error: 'Name, valid email, role, and a password of at least 12 characters are required.' });
  }
  const passwordHash = await passwords.hashPassword(password);
  try {
    const user = modelRow((await query(
      `INSERT INTO public.users (name, email, role, department, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), role, typeof department === 'string' ? department.trim() : '', passwordHash],
    )).rows[0]);
    const details = clientDetails(req);
    await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: `User created — ${user.email} (${user.role})`, ipAddress: details.ipAddress, userAgent: details.userAgent, status: 'Success' });
    return res.status(201).json({ user: safeUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
}

async function updateUser(req, res) {
  const { id } = req.params;
  if (!UUID_PATTERN.test(id)) return res.status(400).json({ error: 'Invalid user ID.' });
  const allowed = ['name', 'email', 'role', 'department', 'isActive', 'isDeleted', 'deletedAt'];
  const changes = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (Object.keys(changes).length === 0) return res.status(400).json({ error: 'No supported user changes were provided.' });
  if (changes.role && !ROLES.includes(changes.role)) return res.status(400).json({ error: 'Unsupported user role.' });
  if (changes.name !== undefined && (typeof changes.name !== 'string' || !changes.name.trim())) return res.status(400).json({ error: 'Name cannot be empty.' });
  if (changes.email !== undefined) {
    if (typeof changes.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email.trim())) return res.status(400).json({ error: 'A valid email is required.' });
    changes.email = changes.email.toLowerCase().trim();
  }
  if (changes.isActive !== undefined && typeof changes.isActive !== 'boolean') return res.status(400).json({ error: 'isActive must be a boolean.' });

  const columnMap = {
    name: 'name',
    email: 'email',
    role: 'role',
    department: 'department',
    isActive: 'is_active',
    isDeleted: 'is_deleted',
    deletedAt: 'deleted_at',
  };
  const keys = Object.keys(changes);
  const assignments = keys.map((key, index) => `${columnMap[key]} = $${index + 2}`);
  try {
    const user = await transaction(async client => {
      const { rows } = await client.query(
        `UPDATE public.users SET ${assignments.join(', ')}
         WHERE id = $1 AND is_deleted = false RETURNING *`,
        [id, ...keys.map(key => changes[key])],
      );
      const updated = modelRow(rows[0]);
      if (updated && changes.isActive === false) {
        await client.query(
          'UPDATE public.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
          [updated._id],
        );
      }
      return updated;
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const details = clientDetails(req);
    await audit.log({ userId: req.user._id, userEmail: req.user.email, userName: req.user.name, role: req.user.role, action: `User updated — ${user.email}`, ipAddress: details.ipAddress, userAgent: details.userAgent, status: 'Success' });
    return res.json({ user: safeUser(user) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account with that email already exists.' });
    throw error;
  }
}

async function deactivateUser(req, res) {
  if (req.user._id.toString() === req.params.id) {
    return res.status(400).json({ error: 'You cannot deactivate or remove your own account.' });
  }
  req.body = { isActive: false, isDeleted: true, deletedAt: new Date() };
  return updateUser(req, res);
}

module.exports = { listUsers, listApprovers, createUser, updateUser, deactivateUser };
