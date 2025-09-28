const fs = require('fs-extra');
const path = require('path');
const ocrService = require('../services/ocrService');
const { ingestChunks, createDocument } = require('../services/ingest');

// Ingest plain text content (already extracted on the client or another service)
async function ingestText(req, res) {
  try {
    const userId = req.user.userId;
    const { docId, text, metadata } = req.body;

    if (!docId || !text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ success: false, message: 'docId and non-empty text are required' });
    }

    const count = await ingestChunks({
      userId,
      docId,
      fullText: text,
      metadata: metadata || {}
    });

    return res.json({ success: true, message: 'Ingestion completed', data: { chunksStored: count } });
  } catch (error) {
    console.error('[Ingest] ingestText error:', error);
    return res.status(500).json({ success: false, message: 'Failed to ingest text', error: process.env.NODE_ENV === 'development' ? error.message : {} });
  }
}

// Ingest a file (PDF or image). Uses existing OCR service to extract text
async function ingestFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const userId = req.user.userId;
    const { docId, course } = req.body;
    const file = req.file;

    if (!docId) {
      await ocrService.cleanupFile(file.path);
      return res.status(400).json({ success: false, message: 'docId is required' });
    }

    // Create document record first
    try {
      await createDocument({
        userId,
        docId,
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        metadata: {
          course: course || undefined,
          source: 'direct-upload'
        }
      });
    } catch (createError) {
      console.error('Failed to create document record:', createError);
      await ocrService.cleanupFile(file.path);
      return res.status(500).json({ success: false, message: 'Failed to create document record' });
    }

    // Reuse OCR service to extract text
    const result = await ocrService.processFile(file.path, file.mimetype);
    if (!result.success) {
      await ocrService.cleanupFile(file.path);
      return res.status(500).json({ success: false, message: 'Failed to extract text', error: result.error, details: result.details });
    }

    const metadata = {
      filename: file.originalname,
      course: course || undefined,
      pages: result.pages,
      processingMethod: result.processingMethod
    };

    console.log(`[Ingest Debug] Starting chunk ingestion for docId: ${docId}, userId: ${userId}`);
    console.log(`[Ingest Debug] Full text length: ${result.text?.length || 0} characters`);
    
    const count = await ingestChunks({
      userId,
      docId,
      fullText: result.text,
      metadata
    });

    await ocrService.cleanupFile(file.path);

    console.log(`[Ingest Debug] ✅ Successfully stored ${count} chunks for docId: ${docId}, userId: ${userId}`);
    
    // Verify chunks were actually stored with embeddings
    const DocChunk = require('../models/DocChunk');
    const storedChunks = await DocChunk.find({ userId, docId }).lean();
    console.log(`[Ingest Debug] Verification: Found ${storedChunks.length} stored chunks`);
    if (storedChunks.length > 0) {
      const firstChunk = storedChunks[0];
      console.log(`[Ingest Debug] First chunk has embedding: ${!!firstChunk.embedding}, length: ${firstChunk.embedding?.length}`);
      console.log(`[Ingest Debug] First chunk text preview: ${firstChunk.text?.slice(0, 100)}...`);
    }
    
    return res.json({ success: true, message: 'File ingested', data: { chunksStored: count, pages: result.pages, docId, filename: file.originalname } });
  } catch (error) {
    console.error('[Ingest] ingestFile error:', error);
    // Clean up uploaded file if present
    if (req.file && req.file.path) {
      await ocrService.cleanupFile(req.file.path);
    }
    return res.status(500).json({ success: false, message: 'Failed to ingest file', error: process.env.NODE_ENV === 'development' ? error.message : {} });
  }
}

module.exports = {
  ingestText,
  ingestFile
};


