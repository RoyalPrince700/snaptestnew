const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversation,
  createConversation,
  addMessage,
  updateConversation,
  deleteConversation,
  setActiveDoc
} = require('../controllers/conversationController');
const { protect } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(protect);

// @route   GET /api/conversations
// @desc    Get all conversations for authenticated user
// @access  Private
router.get('/', getConversations);

// @route   GET /api/conversations/:id
// @desc    Get specific conversation
// @access  Private
router.get('/:id', getConversation);

// @route   POST /api/conversations
// @desc    Create new conversation
// @access  Private
router.post('/', createConversation);

// @route   POST /api/conversations/:id/messages
// @desc    Add message to conversation
// @access  Private
router.post('/:id/messages', addMessage);

// @route   PUT /api/conversations/:id
// @desc    Update conversation (title)
// @access  Private
router.put('/:id', updateConversation);

// @route   PUT /api/conversations/:id/active-doc
// @desc    Set or clear the active document (docId) for retrieval
// @access  Private
router.put('/:id/active-doc', setActiveDoc);

// @route   DELETE /api/conversations/:id
// @desc    Delete conversation (soft delete)
// @access  Private
router.delete('/:id', deleteConversation);

module.exports = router;
