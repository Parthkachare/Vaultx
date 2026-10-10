const express = require('express');
const router = express.Router();
const {
  login, verifyOtp, logout, currentUser, updateProfile, updatePreferences, updatePassword,
  listSessions, revokeSession, revokeOtherSessions,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.post('/login', asyncHandler(login));
router.post('/verify-otp', asyncHandler(verifyOtp));
router.post('/logout', requireAuth, asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(currentUser));
router.patch('/profile', requireAuth, asyncHandler(updateProfile));
router.put('/preferences', requireAuth, asyncHandler(updatePreferences));
router.post('/password', requireAuth, asyncHandler(updatePassword));
router.get('/sessions', requireAuth, asyncHandler(listSessions));
router.delete('/sessions/:id', requireAuth, asyncHandler(revokeSession));
router.post('/sessions/revoke-others', requireAuth, asyncHandler(revokeOtherSessions));

module.exports = router;
