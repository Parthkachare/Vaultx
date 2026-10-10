const express = require('express');
const router = express.Router();
const { requestApprovalOtp, submitApproval, getApprovals } = require('../controllers/approvalsController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/otp', requireAuth, requireRole('Manager 1', 'Manager 2'), asyncHandler(requestApprovalOtp));
router.post('/', requireAuth, requireRole('Manager 1', 'Manager 2'), asyncHandler(submitApproval));
router.get('/:paperId', requireAuth, asyncHandler(getApprovals));

module.exports = router;
