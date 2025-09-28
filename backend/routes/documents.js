const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDocuments,
  getDocumentStatus,
  retryIngestion,
  deleteDocument,
  getIngestionStats
} = require('../controllers/documentsController');

// @route   GET /api/documents/stats
// @desc    Get user's ingestion analytics and statistics
// @access  Private
router.get('/stats', protect, getIngestionStats);

// @route   GET /api/documents
// @desc    Get all user documents with ingestion status
// @access  Private
router.get('/', protect, getDocuments);

// @route   GET /api/documents/:id/status
// @desc    Get detailed status for a specific document
// @access  Private
router.get('/:id/status', protect, getDocumentStatus);

// @route   POST /api/documents/:id/retry
// @desc    Retry ingestion for a failed document
// @access  Private
router.post('/:id/retry', protect, retryIngestion);

// @route   DELETE /api/documents/:id
// @desc    Delete a document and all its chunks
// @access  Private
router.delete('/:id', protect, deleteDocument);

module.exports = router;
