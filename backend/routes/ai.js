const express = require('express');
const router = express.Router();
const {
  chatWithAI,
  getStudyHelp,
  generateStudyPlan,
  submitFeedback,
  askQuestion
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

// All AI routes now require authentication for conversation system
router.post('/chat', protect, chatWithAI);
router.post('/study-help', getStudyHelp);

// Authenticated-only routes
router.post('/study-plan', protect, generateStudyPlan);
router.post('/feedback', protect, submitFeedback);
router.post('/ask-question', protect, askQuestion);

module.exports = router;
