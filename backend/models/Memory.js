const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  kind: {
    type: String,
    enum: ['profile', 'fact', 'preference'],
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  embedding: {
    type: [Number],
    default: []
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
memorySchema.index({ userId: 1, kind: 1 });
memorySchema.index({ embedding: 1 }); // For vector search
memorySchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('Memory', memorySchema);
