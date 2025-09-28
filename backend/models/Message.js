const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  tokens: {
    type: Number,
    default: 0
  },
  embedding: {
    type: [Number],
    default: []
  },
  sourceRefs: [{
    type: {
      type: String,
      enum: ['pdf', 'chat', 'profile'],
      required: true
    },
    id: {
      type: String,
      required: true
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ embedding: 1 }); // For vector search

module.exports = mongoose.model('Message', messageSchema);
