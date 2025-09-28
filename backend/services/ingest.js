const mongoose = require('mongoose');
const DocChunk = require('../models/DocChunk');
const Document = require('../models/Document');
const { embedTexts } = require('./embeddings');

// Load environment variables if not already loaded (useful for node -e tests)
try {
  // eslint-disable-next-line global-require
  require('dotenv').config();
} catch (_) {}

let connectPromise = null;

async function ensureDbConnection() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!connectPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI is not set.');
    }
    connectPromise = mongoose.connect(uri, {
      // Use Mongoose defaults; options left explicit for clarity if needed
    });
  }
  return connectPromise;
}

function estimateTokenCount(text) {
  // Approximate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function normalizeWhitespace(text) {
  return String(text).replace(/\s+/g, ' ').trim();
}

// Create overlapping chunks: ~maxTokens with overlapTokens overlap between consecutive chunks
function chunkWithOverlap(text, maxTokens = 800, overlapTokens = 200) {
  const clean = normalizeWhitespace(text);
  if (!clean) return [];

  // Split on whitespace to approximate tokens
  const words = clean.split(/\s+/);
  // Average 1 word ~ 1 token; adjust step accordingly
  const windowSize = Math.max(1, maxTokens);
  const stepSize = Math.max(1, windowSize - overlapTokens);

  const chunks = [];
  for (let start = 0; start < words.length; start += stepSize) {
    const end = Math.min(words.length, start + windowSize);
    const slice = words.slice(start, end).join(' ');
    if (slice.trim().length > 0) {
      chunks.push(slice.trim());
    }
    if (end === words.length) break;
  }

  // Guardrail: if we somehow produced no chunks but had content, fall back to the full text
  if (chunks.length === 0 && clean.length > 0) {
    chunks.push(clean);
  }

  // Small polish: ensure individual chunks are not wildly over the max token estimate
  return chunks.map((c) => {
    if (estimateTokenCount(c) <= maxTokens * 1.5) return c;
    // Hard trim by characters if needed as a last resort
    const approxChars = maxTokens * 4;
    return c.slice(0, approxChars);
  });
}

/**
 * Ingest a long text (e.g., extracted from PDF) into overlapping chunks with embeddings.
 * Stores results in the DocChunk collection and updates Document status.
 *
 * @param {Object} params
 * @param {string} params.userId - MongoDB ObjectId string of the user
 * @param {string} params.docId - Stable id for the ingested document (e.g., file hash or filename)
 * @param {string} params.fullText - The full extracted text content to ingest
 * @param {Object} [params.metadata] - Optional metadata to persist alongside chunks (e.g., { filename, course })
 * @param {Object} [params.documentInfo] - Document information for creating/updating Document record
 * @returns {Promise<number>} Number of chunks stored
 */
async function ingestChunks({ userId, docId, fullText, metadata = {}, documentInfo = {} }) {
  if (!userId || !docId) {
    throw new Error('userId and docId are required');
  }
  if (!fullText || typeof fullText !== 'string' || !fullText.trim()) {
    throw new Error('fullText must be a non-empty string');
  }

  await ensureDbConnection();

  const startTime = Date.now();
  
  try {
    // Update document status to processing
    await updateDocumentStatus(userId, docId, 'processing', {
      currentStep: 'Chunking text',
      progress: 10
    });

    const MAX_TOKENS = 800;
    const OVERLAP_TOKENS = 200;

    // 1) Chunk with overlap (~800 tokens with 200 overlap)
    console.log(`[Ingest Debug] Starting chunking for docId: ${docId}, fullText length: ${fullText.length}`);
    const chunks = chunkWithOverlap(fullText, MAX_TOKENS, OVERLAP_TOKENS);
    console.log(`[Ingest Debug] Created ${chunks.length} chunks`);
    if (chunks.length === 0) {
      console.log(`[Ingest Debug] ❌ No chunks created from text`);
      await updateDocumentStatus(userId, docId, 'failed', {
        errorDetails: {
          type: 'ChunkingError',
          message: 'No chunks could be created from the text',
          timestamp: new Date()
        }
      });
      return 0;
    }

    // Update progress
    await updateDocumentStatus(userId, docId, 'processing', {
      currentStep: 'Generating embeddings',
      progress: 50
    });

    // 2) Generate embeddings for each chunk
    console.log(`[Ingest Debug] Generating embeddings for ${chunks.length} chunks`);
    const embeddings = await embedTexts(chunks);
    console.log(`[Ingest Debug] Generated ${embeddings?.length || 0} embeddings`);

    if (!Array.isArray(embeddings) || embeddings.length !== chunks.length) {
      console.log(`[Ingest Debug] ❌ Embedding mismatch: expected ${chunks.length}, got ${embeddings?.length || 0}`);
      await updateDocumentStatus(userId, docId, 'failed', {
        errorDetails: {
          type: 'EmbeddingError',
          message: 'Embedding service returned unexpected result length',
          timestamp: new Date()
        }
      });
      throw new Error('Embedding service returned unexpected result length');
    }

    // Verify embeddings have proper dimensions
    const firstEmbedding = embeddings[0];
    console.log(`[Ingest Debug] First embedding dimensions: ${firstEmbedding?.length || 0}`);
    if (!firstEmbedding || !Array.isArray(firstEmbedding) || firstEmbedding.length === 0) {
      console.log(`[Ingest Debug] ❌ Invalid embedding format`);
      throw new Error('Invalid embedding format received');
    }

    // Update progress
    await updateDocumentStatus(userId, docId, 'processing', {
      currentStep: 'Storing chunks',
      progress: 80
    });

    // 3) Persist DocChunk records. Page best-effort: unknown here → 0
    const docs = chunks.map((text, idx) => ({
      userId,
      docId,
      page: 0,
      text,
      embedding: embeddings[idx],
      metadata: { ...metadata }
    }));

    const result = await DocChunk.insertMany(docs, { ordered: true });
    const chunkCount = Array.isArray(result) ? result.length : 0;

    // 4) Create and persist a rich document summary (broad, content-heavy)
    try {
      const { retrieveDocOverview } = require('./retrieval');
      const { generateConstrainedAnswer } = require('./llm');
      const overviewChunks = await retrieveDocOverview({ userId, docId, maxChunks: 35 });
      const context = overviewChunks.map((c) => {
        const snippet = normalizeWhitespace(c.text || '').slice(0, 1200);
        return `- [pdf] docId=${c.docId} page=${typeof c.page === 'number' ? c.page : 0} text: ${snippet}`;
      }).join('\n');
      const question = `Create a comprehensive, structured educational summary that will serve as a learning roadmap for students. This summary should be organized in a way that both students and AI can reference for progressive teaching.

Format your response with this exact structure:

## DOCUMENT OVERVIEW
[Brief 2-3 sentence summary of what this document is about and its educational purpose]

## COURSE INFORMATION
- **Course Code & Title**: [If available]
- **Institution**: [If mentioned]
- **Level**: [Undergraduate/Graduate/etc.]
- **Credits/Units**: [If specified]

## QUICK SUMMARY
[A concise 3-4 sentence summary of the main focus and scope]

## LEARNING ROADMAP

### TOPIC 1: [Main Topic Name]
**Core Concept**: [One sentence explaining the main idea]
**Key Subtopics**:
- **1.1 [Subtopic Name]**: [Brief explanation]
- **1.2 [Subtopic Name]**: [Brief explanation]
- **1.3 [Subtopic Name]**: [Brief explanation]

### TOPIC 2: [Main Topic Name]
**Core Concept**: [One sentence explaining the main idea]
**Key Subtopics**:
- **2.1 [Subtopic Name]**: [Brief explanation]
- **2.2 [Subtopic Name]**: [Brief explanation]

[Continue with additional topics...]

## KEY DEFINITIONS & TERMS
- **[Term 1]**: [Clear definition]
- **[Term 2]**: [Clear definition]
- **[Term 3]**: [Clear definition]

## IMPORTANT FORMULAS & METHODS
[List any formulas, calculations, or methodologies]

## PRACTICAL APPLICATIONS
[Real-world applications and examples mentioned]

## TEACHING PROGRESSION GUIDE
**Beginner Level**: Start with [specific topics]
**Intermediate Level**: Progress to [specific topics]
**Advanced Level**: Master [specific topics]

This structure will allow for systematic teaching and easy reference during study sessions.

## NEXT STEPS SUGGESTIONS
After reviewing this summary, I can help you with:
1. **Create a Detailed Learning Roadmap** - Would you like me to create a step-by-step study plan for mastering this material?
2. **Start Interactive Teaching** - Should I begin teaching you the first topic in detail with examples and explanations?
3. **Generate Practice Materials** - Would you like me to create practice questions, flashcards, or exercises for any specific topic?
4. **Deep Dive Sessions** - Is there any particular section you'd like to explore in greater depth?
5. **Concept Clarification** - Are there any terms or concepts you'd like me to explain in simpler language?

Just let me know which option interests you most, and we can start learning together!`;

      const llmResult = await generateConstrainedAnswer({
        question,
        context: `DOC_CHUNKS:\n${context}`,
        taskType: 'document_summary',
        temperature: 0.3
      });

      const summaryText = llmResult?.json?.answer || '';
      if (summaryText && summaryText.length > 0) {
        await Document.findOneAndUpdate(
          { userId, docId },
          { $set: { summary: summaryText, summaryCreatedAt: new Date() } },
          { new: false }
        );
      }
    } catch (summaryErr) {
      console.warn('[Ingest] Document summary generation skipped:', summaryErr?.message || summaryErr);
      // Do not fail ingestion on summary errors
    }

    // Update document status to completed
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    await updateDocumentStatus(userId, docId, 'completed', {
      chunkCount,
      progress: 100,
      currentStep: 'Completed',
      processingSteps: [
        {
          name: 'Text Extraction',
          status: 'completed',
          timestamp: new Date(startTime),
          duration: Math.round(duration * 0.1)
        },
        {
          name: 'Chunking',
          status: 'completed',
          timestamp: new Date(startTime + duration * 0.1),
          duration: Math.round(duration * 0.3)
        },
        {
          name: 'Embedding Generation',
          status: 'completed',
          timestamp: new Date(startTime + duration * 0.4),
          duration: Math.round(duration * 0.5)
        },
        {
          name: 'Storage',
          status: 'completed',
          timestamp: new Date(startTime + duration * 0.9),
          duration: Math.round(duration * 0.1)
        }
      ]
    });

    return chunkCount;
  } catch (error) {
    // Update document status to failed
    await updateDocumentStatus(userId, docId, 'failed', {
      errorDetails: {
        type: 'ProcessingError',
        message: error.message || 'Unknown error during processing',
        timestamp: new Date()
      }
    });
    throw error;
  }
}

/**
 * Update document status and metadata
 * @param {string} userId - User ID
 * @param {string} docId - Document ID
 * @param {string} status - New status (pending, processing, completed, failed)
 * @param {Object} updates - Additional fields to update
 */
async function updateDocumentStatus(userId, docId, status, updates = {}) {
  try {
    const updateData = {
      ingestionStatus: status,
      ...updates
    };

    await Document.findOneAndUpdate(
      { userId, docId },
      { $set: updateData },
      { upsert: false }
    );
  } catch (error) {
    console.error('Failed to update document status:', error);
    // Don't throw here to avoid breaking the main process
  }
}

/**
 * Create a new document record
 * @param {Object} params - Document parameters
 */
async function createDocument({ userId, docId, filename, originalName, fileSize, mimeType, metadata = {} }) {
  try {
    const document = new Document({
      userId,
      docId,
      filename,
      originalName,
      fileSize,
      mimeType,
      ingestionStatus: 'pending',
      chunkCount: 0,
      progress: 0,
      metadata
    });

    await document.save();
    return document;
  } catch (error) {
    console.error('Failed to create document record:', error);
    throw error;
  }
}

module.exports = {
  ingestChunks,
  createDocument,
  updateDocumentStatus,
  // Exported for potential testing
  chunkWithOverlap,
  estimateTokenCount
};


