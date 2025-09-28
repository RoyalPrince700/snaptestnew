/**
 * Logging middleware and helper functions for StudyAI
 * Tracks per-request metrics and RAG stats with PII-safe logging
 */

const mongoose = require('mongoose');

/**
 * Generate a sanitized request ID for tracking
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize user ID for logging (only show first/last few chars)
 */
function sanitizeUserId(userId) {
  if (!userId) return 'anonymous';
  const str = String(userId);
  if (str.length <= 8) return 'user_***';
  return `user_${str.slice(0, 3)}***${str.slice(-3)}`;
}

/**
 * Sanitize conversation ID for logging
 */
function sanitizeConversationId(conversationId) {
  if (!conversationId) return null;
  const str = String(conversationId);
  if (str.length <= 8) return 'conv_***';
  return `conv_${str.slice(0, 3)}***${str.slice(-3)}`;
}

/**
 * Get safe content preview (no PII)
 */
function getContentPreview(content, maxLength = 50) {
  if (!content || typeof content !== 'string') return '';
  const sanitized = content.replace(/\s+/g, ' ').trim();
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength) + '...';
}

/**
 * Request logging middleware
 * Logs basic request info and attaches request ID
 */
function requestLoggingMiddleware(req, res, next) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Attach request ID to request for downstream use
  req.requestId = requestId;
  req.startTime = startTime;
  
  // Log incoming request (PII-safe)
  const logData = {
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get('User-Agent')?.slice(0, 100),
    userId: sanitizeUserId(req.user?.userId),
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection?.remoteAddress
  };
  
  console.log('[REQ]', JSON.stringify(logData));
  
  // Log response when finished
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const responseLogData = {
      requestId,
      status: res.statusCode,
      duration,
      responseSize: data ? Buffer.byteLength(data, 'utf8') : 0,
      timestamp: new Date().toISOString()
    };
    
    console.log('[RES]', JSON.stringify(responseLogData));
    return originalSend.call(this, data);
  };
  
  next();
}

/**
 * Log RAG retrieval metrics
 */
function logRAGRetrieval({ requestId, userId, conversationId, query, results, duration, config }) {
  const logData = {
    type: 'RAG_RETRIEVAL',
    requestId,
    userId: sanitizeUserId(userId),
    conversationId: sanitizeConversationId(conversationId),
    queryLength: query ? query.length : 0,
    queryPreview: getContentPreview(query, 30),
    results: {
      docChunks: results.docChunks?.length || 0,
      pastMessages: results.pastMessages?.length || 0,
      memories: results.memories?.length || 0,
      lastTurns: results.lastTurns?.length || 0,
      totalRetrieved: (results.docChunks?.length || 0) + (results.pastMessages?.length || 0) + (results.memories?.length || 0)
    },
    config: {
      kDocs: config?.kDocs,
      kMsgs: config?.kMsgs,
      kMems: config?.kMems,
      lastN: config?.lastN,
      relevanceThreshold: config?.relevanceThreshold
    },
    duration,
    timestamp: new Date().toISOString()
  };
  
  console.log('[RAG]', JSON.stringify(logData));
}

/**
 * Log LLM generation metrics
 */
function logLLMGeneration({ requestId, userId, model, promptSize, completion, temperature, duration, retries, success }) {
  const logData = {
    type: 'LLM_GENERATION',
    requestId,
    userId: sanitizeUserId(userId),
    model: model || 'unknown',
    promptSize: promptSize || 0,
    completionLength: completion ? completion.length : 0,
    temperature,
    duration,
    retries: retries || 0,
    success: Boolean(success),
    timestamp: new Date().toISOString()
  };
  
  console.log('[LLM]', JSON.stringify(logData));
}

/**
 * Log JSON validation metrics
 */
function logJSONValidation({ requestId, userId, rawOutput, validationResult, retryAttempted }) {
  const logData = {
    type: 'JSON_VALIDATION',
    requestId,
    userId: sanitizeUserId(userId),
    rawOutputLength: rawOutput ? rawOutput.length : 0,
    valid: validationResult?.valid || false,
    errorCount: validationResult?.errors?.length || 0,
    retryAttempted: Boolean(retryAttempted),
    timestamp: new Date().toISOString()
  };
  
  console.log('[JSON]', JSON.stringify(logData));
}

/**
 * Log citation verification metrics
 */
function logCitationVerification({ requestId, userId, answer, citations, verificationResult }) {
  const logData = {
    type: 'CITATION_VERIFICATION',
    requestId,
    userId: sanitizeUserId(userId),
    answerLength: answer ? answer.length : 0,
    citationCount: Array.isArray(citations) ? citations.length : 0,
    citationTypes: Array.isArray(citations) 
      ? citations.reduce((acc, c) => {
          acc[c.type] = (acc[c.type] || 0) + 1;
          return acc;
        }, {})
      : {},
    verificationOk: verificationResult?.ok || false,
    unsupportedClaims: verificationResult?.unsupportedClaims?.length || 0,
    checkedCitations: verificationResult?.checkedCitations || 0,
    timestamp: new Date().toISOString()
  };
  
  console.log('[VERIFY]', JSON.stringify(logData));
}

/**
 * Log embedding generation metrics
 */
function logEmbeddingGeneration({ requestId, userId, textCount, totalTokens, duration, success }) {
  const logData = {
    type: 'EMBEDDING_GENERATION',
    requestId,
    userId: sanitizeUserId(userId),
    textCount: textCount || 0,
    totalTokens: totalTokens || 0,
    avgTokensPerText: textCount > 0 ? Math.round((totalTokens || 0) / textCount) : 0,
    duration,
    success: Boolean(success),
    timestamp: new Date().toISOString()
  };
  
  console.log('[EMBED]', JSON.stringify(logData));
}

/**
 * Log feedback submission metrics
 */
function logFeedbackSubmission({ requestId, userId, conversationId, messageId, feedbackType, success }) {
  const logData = {
    type: 'FEEDBACK_SUBMISSION',
    requestId,
    userId: sanitizeUserId(userId),
    conversationId: sanitizeConversationId(conversationId),
    messageId: messageId ? `msg_${String(messageId).slice(0, 3)}***${String(messageId).slice(-3)}` : null,
    feedbackType,
    success: Boolean(success),
    timestamp: new Date().toISOString()
  };
  
  console.log('[FEEDBACK]', JSON.stringify(logData));
}

/**
 * Log conversation summary metrics
 */
function logConversationSummary({ requestId, userId, conversationId, messageCount, summaryLength, duration, success }) {
  const logData = {
    type: 'CONVERSATION_SUMMARY',
    requestId,
    userId: sanitizeUserId(userId),
    conversationId: sanitizeConversationId(conversationId),
    messageCount: messageCount || 0,
    summaryLength: summaryLength || 0,
    duration,
    success: Boolean(success),
    timestamp: new Date().toISOString()
  };
  
  console.log('[SUMMARY]', JSON.stringify(logData));
}

/**
 * Log ingestion metrics
 */
function logIngestion({ requestId, userId, docId, textLength, chunkCount, duration, success }) {
  const logData = {
    type: 'INGESTION',
    requestId,
    userId: sanitizeUserId(userId),
    docId: docId ? `doc_${String(docId).slice(0, 10)}` : null,
    textLength: textLength || 0,
    chunkCount: chunkCount || 0,
    avgChunkSize: chunkCount > 0 ? Math.round((textLength || 0) / chunkCount) : 0,
    duration,
    success: Boolean(success),
    timestamp: new Date().toISOString()
  };
  
  console.log('[INGEST]', JSON.stringify(logData));
}

/**
 * Log error with context
 */
function logError({ requestId, userId, operation, error, context }) {
  const logData = {
    type: 'ERROR',
    requestId,
    userId: sanitizeUserId(userId),
    operation: operation || 'unknown',
    errorMessage: error?.message || String(error),
    errorType: error?.constructor?.name || 'Unknown',
    context: context || {},
    timestamp: new Date().toISOString()
  };
  
  console.error('[ERROR]', JSON.stringify(logData));
}

module.exports = {
  // Middleware
  requestLoggingMiddleware,
  
  // Helper functions
  generateRequestId,
  sanitizeUserId,
  sanitizeConversationId,
  getContentPreview,
  
  // Logging functions
  logRAGRetrieval,
  logLLMGeneration,
  logJSONValidation,
  logCitationVerification,
  logEmbeddingGeneration,
  logFeedbackSubmission,
  logConversationSummary,
  logIngestion,
  logError
};
