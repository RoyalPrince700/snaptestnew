const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const fireworksService = require('../services/fireworksService');

// @desc    Get all conversations for a user
// @route   GET /api/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user.userId,
      isActive: true
    })
    .sort({ lastMessageAt: -1 })
    .select('title lastMessageAt messageCount lastMessagePreview createdAt')
    .limit(50);

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get a specific conversation
// @route   GET /api/conversations/:id
// @access  Private
const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      isActive: true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Fetch messages from the Message collection
    const messages = await Message.find({
      conversationId: conversation._id
    })
    .sort({ createdAt: 1 }) // Sort by creation time, oldest first
    .select('role content createdAt sourceRefs')
    .lean();

    // Format messages to match frontend expectations
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.createdAt.toISOString(),
      citations: msg.sourceRefs || []
    }));

    res.json({
      success: true,
      data: {
        ...conversation.toObject(),
        messages: formattedMessages
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Create a new conversation
// @route   POST /api/conversations
// @access  Private
const createConversation = async (req, res) => {
  try {
    const { title = 'New Chat' } = req.body;

    // Check if this is the user's first conversation and if they're a new user
    const userConversations = await Conversation.countDocuments({
      userId: req.user.userId,
      isActive: true
    });

    const user = await User.findById(req.user.userId).select('profile courses onboardingCompleted');

    const isNewUser = !user?.profile?.firstName && !user?.profile?.university && (!user?.courses || user.courses.length === 0);
    const isFirstConversation = userConversations === 0;

    const conversation = new Conversation({
      userId: req.user.userId,
      title,
      messages: []
    });

    // If this is a new user's first conversation, add a welcome message
    if (isNewUser && isFirstConversation) {
      // Note: Welcome message creation is handled separately via Message model
      // No need to add messages directly to conversation object
      conversation.lastMessageAt = new Date();
    }

    await conversation.save();

    res.status(201).json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Add message to conversation
// @route   POST /api/conversations/:id/messages
// @access  Private
const addMessage = async (req, res) => {
  try {
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        message: 'Role and content are required'
      });
    }

    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be either user or assistant'
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.userId,
      isActive: true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Create message in Message collection instead of embedding in conversation
    const message = await Message.create({
      conversationId: conversation._id,
      role,
      content,
      tokens: 0,
      embedding: [],
      sourceRefs: []
    });

    // Update conversation timestamp
    conversation.lastMessageAt = new Date();

    // Update title if it's the first user message
    if (role === 'user') {
      const userMessageCount = await Message.countDocuments({
        conversationId: conversation._id,
        role: 'user'
      });
      
      if (userMessageCount === 1) {
        try {
          // Generate AI-powered title
          const aiTitle = await fireworksService.generateConversationTitle(content);
          conversation.title = aiTitle;
        } catch (titleError) {
          console.error('[Conversation] Failed to generate AI title, using fallback:', titleError);
          // Fallback to truncated message
          conversation.title = content.length > 50 ? content.substring(0, 50) + '...' : content;
        }
      }
    }

    await conversation.save();

    res.json({
      success: true,
      data: {
        message: {
          role: message.role,
          content: message.content,
          timestamp: message.createdAt.toISOString()
        },
        conversation: {
          id: conversation._id,
          title: conversation.title,
          lastMessageAt: conversation.lastMessageAt
        }
      }
    });
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add message',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Update conversation title
// @route   PUT /api/conversations/:id
// @access  Private
const updateConversation = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
        isActive: true
      },
      { title: title.trim() },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Delete conversation (soft delete)
// @route   DELETE /api/conversations/:id
// @access  Private
const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
        isActive: true
      },
      { isActive: false },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Set or clear the active document for targeted retrieval
// @route   PUT /api/conversations/:id/active-doc
// @access  Private
const setActiveDoc = async (req, res) => {
  try {
    const { docId } = req.body || {};

    // Validate input: allow string (non-empty) or null to clear
    const nextDocId = docId === null ? null : (typeof docId === 'string' ? docId.trim() : undefined);
    if (typeof nextDocId === 'undefined') {
      return res.status(400).json({ success: false, message: 'docId must be a string or null' });
    }

    const conversation = await Conversation.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.userId,
        isActive: true
      },
      { $set: { activeDocId: nextDocId } },
      { new: true }
    ).select('title activeDocId lastMessageAt createdAt');

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    return res.json({ success: true, data: conversation });
  } catch (error) {
    console.error('Set active doc error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update active document', error: process.env.NODE_ENV === 'development' ? error.message : {} });
  }
};

module.exports = {
  getConversations,
  getConversation,
  createConversation,
  addMessage,
  updateConversation,
  deleteConversation,
  setActiveDoc
};
