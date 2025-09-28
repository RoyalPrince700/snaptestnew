const StudySession = require('../models/StudySession');
const User = require('../models/User');

// @desc    Create new study session
// @route   POST /api/study/sessions
// @access  Private
const createStudySession = async (req, res) => {
  try {
    const {
      subject,
      topic,
      duration,
      studyType,
      difficulty,
      notes,
      tags,
      productivity
    } = req.body;

    const session = await StudySession.create({
      user: req.user.userId,
      subject,
      topic,
      duration,
      startTime: new Date(),
      endTime: new Date(),
      studyType: studyType || 'reading',
      difficulty: difficulty || 'medium',
      notes,
      tags: tags || [],
      productivity: productivity || 5
    });

    // Update user's study stats
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: {
        'studyStats.totalStudyTime': duration,
        'studyStats.sessionsCompleted': 1
      },
      $addToSet: {
        'studyStats.subjectsStudied': subject
      }
    });

    res.status(201).json({
      success: true,
      message: 'Study session created successfully',
      data: { session }
    });
  } catch (error) {
    console.error('Create study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create study session',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get user's study sessions
// @route   GET /api/study/sessions
// @access  Private
const getStudySessions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      subject,
      studyType,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { user: req.user.userId };

    // Add filters
    if (subject) query.subject = new RegExp(subject, 'i');
    if (studyType) query.studyType = studyType;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 },
      populate: []
    };

    const sessions = await StudySession.find(query)
      .sort(options.sort)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await StudySession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: options.page,
          limit: options.limit,
          total,
          pages: Math.ceil(total / options.limit)
        }
      }
    });
  } catch (error) {
    console.error('Get study sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get study sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get study session by ID
// @route   GET /api/study/sessions/:id
// @access  Private
const getStudySession = async (req, res) => {
  try {
    const session = await StudySession.findOne({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found'
      });
    }

    res.json({
      success: true,
      data: { session }
    });
  } catch (error) {
    console.error('Get study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get study session',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Update study session
// @route   PUT /api/study/sessions/:id
// @access  Private
const updateStudySession = async (req, res) => {
  try {
    const allowedFields = [
      'subject',
      'topic',
      'duration',
      'studyType',
      'difficulty',
      'notes',
      'tags',
      'productivity'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    const session = await StudySession.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found'
      });
    }

    res.json({
      success: true,
      message: 'Study session updated successfully',
      data: { session }
    });
  } catch (error) {
    console.error('Update study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update study session',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Delete study session
// @route   DELETE /api/study/sessions/:id
// @access  Private
const deleteStudySession = async (req, res) => {
  try {
    const session = await StudySession.findOneAndDelete({
      _id: req.params.id,
      user: req.user.userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found'
      });
    }

    // Update user's study stats
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: {
        'studyStats.totalStudyTime': -session.duration,
        'studyStats.sessionsCompleted': -1
      }
    });

    res.json({
      success: true,
      message: 'Study session deleted successfully'
    });
  } catch (error) {
    console.error('Delete study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete study session',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get study statistics
// @route   GET /api/study/stats
// @access  Private
const getStudyStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    // Get additional stats from sessions
    const sessions = await StudySession.find({ user: req.user.userId });

    const stats = {
      totalStudyTime: user.studyStats.totalStudyTime,
      sessionsCompleted: user.studyStats.sessionsCompleted,
      subjectsStudied: user.studyStats.subjectsStudied,
      averageProductivity: sessions.length > 0
        ? sessions.reduce((sum, session) => sum + session.productivity, 0) / sessions.length
        : 0,
      recentSessions: sessions.slice(-5).reverse(),
      studyTimeBySubject: {}
    };

    // Calculate study time by subject
    sessions.forEach(session => {
      if (!stats.studyTimeBySubject[session.subject]) {
        stats.studyTimeBySubject[session.subject] = 0;
      }
      stats.studyTimeBySubject[session.subject] += session.duration;
    });

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get study stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get study statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

module.exports = {
  createStudySession,
  getStudySessions,
  getStudySession,
  updateStudySession,
  deleteStudySession,
  getStudyStats
};
