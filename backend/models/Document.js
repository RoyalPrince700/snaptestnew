const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  docId: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  filename: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  ingestionStatus: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  chunkCount: {
    type: Number,
    default: 0
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  currentStep: {
    type: String,
    default: ''
  },
  errorDetails: {
    type: {
      type: String
    },
    message: String,
    timestamp: Date
  },
  processingSteps: [{
    name: String,
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed']
    },
    timestamp: Date,
    duration: Number // in milliseconds
  }],
  summary: {
    type: String,
    default: ''
  },
  summaryCreatedAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
documentSchema.index({ userId: 1 });
documentSchema.index({ docId: 1 });
documentSchema.index({ userId: 1, uploadDate: -1 });
documentSchema.index({ userId: 1, ingestionStatus: 1 });

module.exports = mongoose.model('Document', documentSchema);
