const express = require('express');
const router = express.Router();
const { listUsers, listApprovers, createUser, updateUser, deactivateUser } = require('../controllers/usersController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/approvers', asyncHandler(listApprovers));
router.use(requireRole('Admin'));
router.get('/', asyncHandler(listUsers));
router.post('/', asyncHandler(createUser));
router.patch('/:id', asyncHandler(updateUser));
router.delete('/:id', asyncHandler(deactivateUser));

module.exports = router;
