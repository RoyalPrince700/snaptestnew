const Document = require('../models/Document');
const DocChunk = require('../models/DocChunk');

// @desc    Get all user documents with ingestion status
// @route   GET /api/documents
// @access  Private
const getDocuments = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Fetch all documents for the user, sorted by upload date (newest first)
    const documents = await Document.find({ userId })
      .sort({ uploadDate: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        documents
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get detailed status for a specific document
// @route   GET /api/documents/:id/status
// @access  Private
const getDocumentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Find document by docId (not MongoDB _id)
    const document = await Document.findOne({ docId: id, userId });
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Get chunk preview for completed documents
    let chunkPreview = [];
    if (document.ingestionStatus === 'completed' && document.chunkCount > 0) {
      const chunks = await DocChunk.find({ docId: id, userId })
        .limit(3)
        .select('text metadata')
        .lean();
      
      chunkPreview = chunks.map((chunk, index) => ({
        chunkIndex: index,
        content: chunk.text.substring(0, 200) + (chunk.text.length > 200 ? '...' : ''),
        metadata: chunk.metadata
      }));
    }

    // Build response with enhanced status information
    const statusData = {
      _id: document._id,
      docId: document.docId,
      filename: document.filename,
      originalName: document.originalName,
      uploadDate: document.uploadDate,
      ingestionStatus: document.ingestionStatus,
      chunkCount: document.chunkCount,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      progress: document.progress,
      currentStep: document.currentStep,
      processingSteps: document.processingSteps || [],
      chunkPreview,
      errorDetails: document.errorDetails,
      embeddingStatus: {
        status: document.ingestionStatus,
        embeddingsGenerated: document.chunkCount,
        model: 'nomic-ai/nomic-embed-text-v1.5'
      },
      metadata: document.metadata
    };

    res.json({
      success: true,
      data: statusData
    });
  } catch (error) {
    console.error('Get document status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document status',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Retry ingestion for a failed document
// @route   POST /api/documents/:id/retry
// @access  Private
const retryIngestion = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // TODO: Implement actual retry logic
    console.log(`Retrying ingestion for document ${id} for user ${userId}`);

    res.json({
      success: true,
      message: 'Ingestion retry initiated',
      data: {
        documentId: id,
        status: 'processing'
      }
    });
  } catch (error) {
    console.error('Retry ingestion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retry ingestion',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Delete a document and all its chunks
// @route   DELETE /api/documents/:id
// @access  Private
const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // 1) Find the document by docId and userId
    const doc = await Document.findOne({ docId: id, userId }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // 2) Delete all related chunks
    const chunkDelete = await DocChunk.deleteMany({ userId, docId: id });

    // 3) Delete the document record
    await Document.deleteOne({ _id: doc._id });

    return res.json({
      success: true,
      message: 'Document and its chunks deleted',
      data: {
        documentId: id,
        deletedChunks: chunkDelete?.deletedCount || 0
      }
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get user's ingestion analytics and statistics
// @route   GET /api/documents/stats
// @access  Private
const getIngestionStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get aggregated statistics from the database
    const statsAggregation = await Document.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$ingestionStatus',
          count: { $sum: 1 },
          totalChunks: { $sum: '$chunkCount' }
        }
      }
    ]);

    // Get total documents count
    const totalDocuments = await Document.countDocuments({ userId });
    
    // Get last ingestion date
    const lastDocument = await Document.findOne({ userId })
      .sort({ uploadDate: -1 })
      .select('uploadDate')
      .lean();

    // Process aggregation results
    const statusCounts = {
      completed: 0,
      processing: 0,
      failed: 0,
      pending: 0
    };

    let totalChunks = 0;

    statsAggregation.forEach(stat => {
      if (statusCounts.hasOwnProperty(stat._id)) {
        statusCounts[stat._id] = stat.count;
        totalChunks += stat.totalChunks;
      }
    });

    // Calculate average processing time from completed documents
    const completedDocs = await Document.find({ 
      userId, 
      ingestionStatus: 'completed',
      'processingSteps.0': { $exists: true }
    }).select('processingSteps').lean();

    let averageProcessingTime = 0;
    if (completedDocs.length > 0) {
      const totalProcessingTime = completedDocs.reduce((total, doc) => {
        const processingTime = doc.processingSteps.reduce((stepTotal, step) => {
          return stepTotal + (step.duration || 0);
        }, 0);
        return total + processingTime;
      }, 0);
      averageProcessingTime = Math.round(totalProcessingTime / completedDocs.length);
    }

    const stats = {
      totalDocuments,
      completed: statusCounts.completed,
      processing: statusCounts.processing,
      failed: statusCounts.failed,
      pending: statusCounts.pending,
      totalChunks,
      averageProcessingTime,
      lastIngestion: lastDocument ? lastDocument.uploadDate : null
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get ingestion stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ingestion statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

module.exports = {
  getDocuments,
  getDocumentStatus,
  retryIngestion,
  deleteDocument,
  getIngestionStats
};
