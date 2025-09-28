require('dotenv').config();
const mongooseSingleton = require('mongoose');
if (mongooseSingleton.connection.readyState === 0 && process.env.MONGODB_URI) {
  mongooseSingleton.connect(process.env.MONGODB_URI).catch(() => {});
}
const mongoose = require('mongoose');
const { embedTexts } = require('./embeddings');
const DocChunk = require('../models/DocChunk');
const Message = require('../models/Message');
const Memory = require('../models/Memory');
const aiConfig = require('../config/ai');

// Vector index names (these don't need to be configurable)
const VECTOR_INDEX = {
  DOCS: 'docchunks_embedding',
  MSGS: 'messages_embedding',
  MEMS: 'memories_embedding'
};

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (_err) {
    return null;
  }
};

async function retrieveFromDocChunks({ userId, docId, queryVector, kDocs, relevanceThreshold }) {
  const userObjectId = toObjectId(userId);
  if (!userObjectId) {
    console.log(`[Retrieval Debug] ⚠️  Invalid userId: ${userId}`);
    return [];
  }

  console.log(`[Retrieval Debug] Searching doc chunks for user: ${userId} (ObjectId: ${userObjectId})`);
  console.log(`[Retrieval Debug] Query vector length: ${queryVector?.length}, kDocs: ${kDocs}, threshold: ${relevanceThreshold}`);
  if (docId) {
    console.log(`[Retrieval Debug] Active doc filter enabled: docId=${docId}`);
  } else {
    console.log(`[Retrieval Debug] ⚠️  No docId provided - returning empty results to prevent context leakage`);
    return [];
  }

  const docFilter = { userId: userObjectId };
  if (typeof docId === 'string' && docId.trim().length > 0) {
    docFilter.docId = docId.trim();
  } else {
    // If no specific docId is provided, don't retrieve any documents
    // This prevents PDF content from bleeding into unrelated conversations
    console.log(`[Retrieval Debug] No specific document context - skipping document retrieval`);
    return [];
  }

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX.DOCS,
        path: 'embedding',
        queryVector,
        numCandidates: Math.max(50, kDocs * 10),
        limit: kDocs,
        filter: docFilter
      }
    },
    { $project: { _id: 1, userId: 1, docId: 1, page: 1, text: 1, metadata: 1, score: { $meta: 'vectorSearchScore' } } }
  ];

  console.log(`[Retrieval Debug] Vector search pipeline:`, JSON.stringify(pipeline[0], null, 2));

  try {
    const results = await DocChunk.aggregate(pipeline).exec();
    console.log(`[Retrieval Debug] Raw vector search results: ${results.length} chunks`);
    
    if (results.length > 0) {
      results.forEach((chunk, idx) => {
        console.log(`  [${idx}] DocID: ${chunk.docId}, Score: ${chunk.score}, Text: ${chunk.text?.slice(0, 80)}...`);
      });
    } else {
      console.log(`[Retrieval Debug] ⚠️  No chunks found. Checking if any chunks exist for user...`);
      const totalUserChunks = await DocChunk.countDocuments({ userId: userObjectId });
      console.log(`[Retrieval Debug] Total chunks for user ${userId}: ${totalUserChunks}`);
      
      if (totalUserChunks > 0) {
        console.log(`[Retrieval Debug] ⚠️  User has ${totalUserChunks} chunks but vector search found 0 - possible index issue`);
        // Get a sample chunk to check embedding
        const sampleChunk = await DocChunk.findOne({ userId: userObjectId }).lean();
        console.log(`[Retrieval Debug] Sample chunk embedding exists: ${!!sampleChunk?.embedding}, length: ${sampleChunk?.embedding?.length}`);
      }
    }

    const filtered = results.filter(r => typeof r.score === 'number' ? r.score >= relevanceThreshold : true);
    console.log(`[Retrieval Debug] After relevance filtering (>=${relevanceThreshold}): ${filtered.length} chunks`);
    return filtered;
  } catch (error) {
    console.error(`[Retrieval Debug] ❌ Vector search failed:`, error);
    console.log(`[Retrieval Debug] Attempting fallback: simple text search`);
    
    // Fallback: simple text search if vector search fails
    try {
      const fallbackQuery = { userId: userObjectId };
      if (docFilter.docId) fallbackQuery.docId = docFilter.docId;
      const fallbackResults = await DocChunk.find({
        ...fallbackQuery,
        text: { $regex: new RegExp('.*', 'i') }
      })
      .limit(kDocs)
      .lean();
      
      console.log(`[Retrieval Debug] Fallback found ${fallbackResults.length} chunks`);
      return fallbackResults.map(chunk => ({ ...chunk, score: 0.5 })); // Assign default score
    } catch (fallbackError) {
      console.error(`[Retrieval Debug] ❌ Fallback search also failed:`, fallbackError);
      return [];
    }
  }
}

// Retrieve an overview sample across a document's chunks (page-ordered sampling)
async function retrieveDocOverview({ userId, docId, maxChunks = 20 }) {
  const userObjectId = toObjectId(userId);
  if (!userObjectId || !docId || typeof docId !== 'string') return [];

  // Fetch chunks ordered by page; cap to a reasonable upper bound to avoid huge reads
  const all = await DocChunk.find({ userId: userObjectId, docId: docId.trim() })
    .sort({ page: 1, _id: 1 })
    .select('_id userId docId page text metadata')
    .limit(500)
    .lean();

  if (all.length <= maxChunks) return all;

  const step = Math.ceil(all.length / maxChunks);
  const sampled = [];
  for (let i = 0; i < all.length && sampled.length < maxChunks; i += step) {
    sampled.push(all[i]);
  }
  return sampled;
}

async function retrieveFromMessages({ conversationId, queryVector, kMsgs, relevanceThreshold }) {
  const convObjectId = toObjectId(conversationId);
  if (!convObjectId) return [];

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX.MSGS,
        path: 'embedding',
        queryVector,
        numCandidates: Math.max(50, kMsgs * 10),
        limit: kMsgs,
        filter: { conversationId: convObjectId }
      }
    },
    { $project: { _id: 1, conversationId: 1, role: 1, content: 1, createdAt: 1, score: { $meta: 'vectorSearchScore' } } }
  ];

  try {
    const results = await Message.aggregate(pipeline).exec();
    return results.filter(r => typeof r.score === 'number' ? r.score >= relevanceThreshold : true);
  } catch (error) {
    console.error(`[Retrieval Debug] ❌ Message vector search failed:`, error);
    // Fallback: recent messages from this conversation
    try {
      const fallbackMsgs = await Message.find({ conversationId: convObjectId })
        .sort({ createdAt: -1 })
        .limit(kMsgs)
        .lean();
      return fallbackMsgs.map(m => ({ ...m, score: 0.5 }));
    } catch (fallbackError) {
      console.error(`[Retrieval Debug] ❌ Fallback message search also failed:`, fallbackError);
      return [];
    }
  }
}

async function retrieveFromMemories({ userId, queryVector, kMems, relevanceThreshold }) {
  const userObjectId = toObjectId(userId);
  if (!userObjectId) return [];

  const pipeline = [
    {
      $vectorSearch: {
        index: VECTOR_INDEX.MEMS,
        path: 'embedding',
        queryVector,
        numCandidates: Math.max(50, kMems * 10),
        limit: kMems,
        filter: { userId: userObjectId }
      }
    },
    { $project: { _id: 1, userId: 1, kind: 1, content: 1, updatedAt: 1, score: { $meta: 'vectorSearchScore' } } }
  ];

  const results = await Memory.aggregate(pipeline).exec();
  return results.filter(r => typeof r.score === 'number' ? r.score >= relevanceThreshold : true);
}

async function getLastTurns({ conversationId, lastN }) {
  const convObjectId = toObjectId(conversationId);
  if (!convObjectId) return [];

  const messages = await Message.find({ conversationId: convObjectId })
    .sort({ createdAt: -1 })
    .limit(lastN)
    .lean()
    .exec();

  return messages.reverse();
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items) {
    const key = String(item._id || item.id);
    if (!map.has(key)) map.set(key, item);
  }
  return Array.from(map.values());
}

function dedupeDocChunksByDocId(chunks) {
  const map = new Map();
  for (const chunk of chunks) {
    const key = `${String(chunk.userId)}::${chunk.docId}`;
    if (!map.has(key)) map.set(key, chunk);
  }
  return Array.from(map.values());
}

async function retrieveContext(params) {
  // Get configurable parameters with defaults from ai config
  const retrievalParams = aiConfig.getRetrievalParams(params);
  const {
    userId,
    conversationId,
    query,
    activeDocId
  } = params || {};

  const {
    kDocs,
    kMsgs,
    kMems,
    lastN,
    relevanceThreshold
  } = retrievalParams;

  if (!userId || !conversationId || !query || typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('retrieveContext: Missing or invalid required parameters');
  }

  // 1) Embed the query
  const [queryVector] = await embedTexts([query]);
  if (!Array.isArray(queryVector)) {
    throw new Error('Failed to generate query embedding');
  }

  // 2) Run three independent vector searches in parallel
  const [docChunksRaw, pastMessagesRaw, memoriesRaw, lastTurns] = await Promise.all([
    retrieveFromDocChunks({ userId, docId: activeDocId, queryVector, kDocs, relevanceThreshold }),
    retrieveFromMessages({ conversationId, queryVector, kMsgs, relevanceThreshold }),
    retrieveFromMemories({ userId, queryVector, kMems, relevanceThreshold }),
    getLastTurns({ conversationId, lastN })
  ]);

  // 3) Dedupe
  const docChunks = dedupeDocChunksByDocId(docChunksRaw)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const pastMessages = dedupeById(pastMessagesRaw)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const memories = dedupeById(memoriesRaw)
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    docChunks,
    pastMessages,
    memories,
    lastTurns
  };
}

module.exports = {
  retrieveContext,
  retrieveDocOverview
};


