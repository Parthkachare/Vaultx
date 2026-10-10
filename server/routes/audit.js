const express = require('express');
const router = express.Router();
const { getLogs, getLogStats, getSecurityEvents, resolveSecurityEvent } = require('../controllers/auditController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.get('/logs', requireAuth, requireRole('Admin', 'Exam Controller'), asyncHandler(getLogs));
router.get('/logs/stats', requireAuth, requireRole('Admin', 'Exam Controller'), asyncHandler(getLogStats));
router.get('/security-events', requireAuth, requireRole('Admin'), asyncHandler(getSecurityEvents));
router.patch('/security-events/:id/resolve', requireAuth, requireRole('Admin'), asyncHandler(resolveSecurityEvent));

module.exports = router;
