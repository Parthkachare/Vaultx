const express = require('express');
const router = express.Router();
const { list, markRead, markAllRead } = require('../controllers/notificationsController');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

router.use(requireAuth);
router.get('/', asyncHandler(list));
router.patch('/:id/read', asyncHandler(markRead));
router.post('/read-all', asyncHandler(markAllRead));

module.exports = router;
