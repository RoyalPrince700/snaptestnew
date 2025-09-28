const mongoose = require('mongoose');

const studySessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 1
  },
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },
  studyType: {
    type: String,
    enum: ['reading', 'practice', 'review', 'quiz', 'notes', 'other'],
    default: 'reading'
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  notes: {
    type: String,
    maxlength: 1000
  },
  aiInteractions: [{
    question: String,
    aiResponse: String,
    timestamp: { type: Date, default: Date.now },
    helpful: { type: Boolean, default: null }
  }],
  completed: {
    type: Boolean,
    default: true
  },
  productivity: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Index for efficient queries
studySessionSchema.index({ user: 1, startTime: -1 });
studySessionSchema.index({ subject: 1, user: 1 });

// Virtual for formatted duration
studySessionSchema.virtual('formattedDuration').get(function() {
  const hours = Math.floor(this.duration / 60);
  const minutes = this.duration % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
});

module.exports = mongoose.model('StudySession', studySessionSchema);
