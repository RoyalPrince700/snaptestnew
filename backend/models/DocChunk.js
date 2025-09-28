const mongoose = require('mongoose');

const docChunkSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  docId: {
    type: String,
    required: true,
    trim: true
  },
  page: {
    type: Number,
    default: 0
  },
  text: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    default: []
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
docChunkSchema.index({ userId: 1, docId: 1 });
docChunkSchema.index({ embedding: 1 }); // For vector search
docChunkSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model('DocChunk', docChunkSchema);
