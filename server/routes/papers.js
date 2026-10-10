const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const { upload, list, getById, eligibility, view, requestPrint } = require('../controllers/papersController');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { markReleaseRoute } = require('../middleware/releaseDiagnostics');

// Multer: store uploads in a temp directory, rename to random filename
const tempStorage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads/tmp'),
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.pdf`),
});
const uploadMiddleware = multer({
  storage: tempStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else {
      const error = new Error('Only PDF files are accepted.');
      error.status = 400;
      cb(error);
    }
  },
});

router.get('/', requireAuth, asyncHandler(list));
router.get('/:paperId/eligibility', markReleaseRoute('eligibility'), requireAuth, requireRole('Admin', 'Exam Controller'), asyncHandler(eligibility));
router.get('/:paperId', requireAuth, asyncHandler(getById));
router.get('/:paperId/view', markReleaseRoute('view'), requireAuth, requireRole('Admin', 'Exam Controller'), asyncHandler(view));
router.post('/:paperId/print', requireAuth, requireRole('Admin', 'Exam Controller'), asyncHandler(requestPrint));
router.post('/', requireAuth, requireRole('Admin', 'Exam Controller'), uploadMiddleware.single('file'), asyncHandler(upload));

module.exports = router;
