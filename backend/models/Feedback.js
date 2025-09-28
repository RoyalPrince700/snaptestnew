const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  kind: {
    type: String,
    enum: ['hallucination', 'good', 'bad'],
    required: true
  },
  comment: {
    type: String,
    default: ''
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

feedbackSchema.index({ userId: 1, conversationId: 1, messageId: 1, createdAt: -1 });
feedbackSchema.index({ conversationId: 1, messageId: 1 });
feedbackSchema.index({ kind: 1, createdAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);


