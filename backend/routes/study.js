const express = require('express');
const router = express.Router();
const {
  createStudySession,
  getStudySessions,
  getStudySession,
  updateStudySession,
  deleteStudySession,
  getStudyStats
} = require('../controllers/studyController');
const { protect } = require('../middleware/auth');

// All study routes require authentication
router.post('/sessions', protect, createStudySession);
router.get('/sessions', protect, getStudySessions);
router.get('/sessions/:id', protect, getStudySession);
router.put('/sessions/:id', protect, updateStudySession);
router.delete('/sessions/:id', protect, deleteStudySession);
router.get('/stats', protect, getStudyStats);

module.exports = router;
