require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const papersRoutes = require('./routes/papers');
const approvalsRoutes = require('./routes/approvals');
const auditRoutes = require('./routes/audit');
const usersRoutes = require('./routes/users');
const notificationsRoutes = require('./routes/notifications');
const { getMasterKey } = require('./services/encryption');
const { query, isConfigured } = require('./services/db');
const storage = require('./services/storage');
const { releaseDiagnostics } = require('./middleware/releaseDiagnostics');

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// Ensure upload directories exist
['uploads', 'uploads/tmp'].forEach(dir => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      frameSrc: ["'self'", 'blob:'],
    },
  },
}));

// CORS — only allow the frontend origin in production
app.use(cors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
  exposedHeaders: ['X-Request-ID'],
}));

// Rate limiting — login endpoint gets stricter limit
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts. Try again in 15 minutes.' } });
app.use(globalLimiter);
app.use('/api/auth/login', loginLimiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(releaseDiagnostics);

app.use((req, res, next) => {
  const json = res.json.bind(res);
  res.json = body => {
    if (body && typeof body.success === 'boolean') return json(body);
    if (res.statusCode >= 400) {
      return json({ success: false, error: body?.error ?? 'Request failed.' });
    }
    return json({ success: true, data: body });
  };
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/papers', papersRoutes);
app.use('/api/approvals', approvalsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationsRoutes);

// Block direct access to the uploads directory
app.use('/uploads', (_req, res) => res.status(403).json({ error: 'Forbidden.' }));

// Health check
app.get('/api/health', async (_req, res) => {
  let connected = false;
  if (isConfigured()) {
    try {
      await query('SELECT 1');
      connected = true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
    }
  }
  return res.json({
    status: connected ? 'ok' : 'unavailable',
    database: connected ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  if (!err.uploadDiagnosticLogged) console.error(err);
  const status = err.status ?? (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = status < 500 ? err.message : 'Internal server error.';
  res.status(status).json({ success: false, error: message });
});

async function start() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');
  getMasterKey();
  storage.assertConfigured();
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('PORT must be a valid TCP port.');

  await query('SELECT 1');
  console.log('Supabase PostgreSQL connected');
  return app.listen(PORT, () => console.log(`VaultX server running on port ${PORT}`));
}

if (require.main === module) {
  start().catch(error => {
    console.error('VaultX startup failed:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, start };
