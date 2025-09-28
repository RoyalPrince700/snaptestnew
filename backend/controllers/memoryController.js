const Memory = require('../models/Memory');
const { embedTexts } = require('../services/embeddings');

// GET /api/memories
exports.listMemories = async (req, res) => {
  try {
    const { kind, search } = req.query || {};
    const query = { userId: req.user.userId };
    if (kind && ['profile', 'fact', 'preference'].includes(kind)) {
      query.kind = kind;
    }
    if (search && typeof search === 'string' && search.trim().length > 0) {
      query.content = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    const docs = await Memory.find(query).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('List memories error:', error);
    res.status(500).json({ success: false, message: 'Failed to list memories' });
  }
};

// POST /api/memories
exports.createMemory = async (req, res) => {
  try {
    const { content, kind } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ success: false, message: 'content is required' });
    }
    if (!['profile', 'fact', 'preference'].includes(kind)) {
      return res.status(400).json({ success: false, message: 'kind must be profile|fact|preference' });
    }

    const [embedding] = await embedTexts([content]);
    const doc = await Memory.create({ userId: req.user.userId, content: content.trim(), kind, embedding });
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('Create memory error:', error);
    res.status(500).json({ success: false, message: 'Failed to create memory' });
  }
};

// PUT /api/memories/:id
exports.updateMemory = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, kind } = req.body || {};

    const updates = {};
    if (typeof content === 'string' && content.trim().length > 0) {
      updates.content = content.trim();
      const [embedding] = await embedTexts([updates.content]);
      updates.embedding = embedding;
    }
    if (kind && ['profile', 'fact', 'preference'].includes(kind)) {
      updates.kind = kind;
    }

    const doc = await Memory.findOneAndUpdate(
      { _id: id, userId: req.user.userId },
      updates,
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: 'Memory not found' });
    res.json({ success: true, data: doc });
  } catch (error) {
    console.error('Update memory error:', error);
    res.status(500).json({ success: false, message: 'Failed to update memory' });
  }
};

// DELETE /api/memories/:id
exports.deleteMemory = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Memory.deleteOne({ _id: id, userId: req.user.userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Memory not found' });
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    console.error('Delete memory error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete memory' });
  }
};

// GET /api/memories/stats
exports.getMemoryStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const [counts, last] = await Promise.all([
      Memory.aggregate([
        { $match: { userId } },
        { $group: { _id: '$kind', count: { $sum: 1 } } }
      ]),
      Memory.findOne({ userId }).sort({ updatedAt: -1 }).lean()
    ]);

    const byKind = { profile: 0, fact: 0, preference: 0 };
    for (const c of counts) byKind[c._id] = c.count;

    res.json({ success: true, data: { total: byKind.profile + byKind.fact + byKind.preference, byKind, lastUpdated: last?.updatedAt || null } });
  } catch (error) {
    console.error('Memory stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get memory stats' });
  }
};


