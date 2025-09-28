require('dotenv').config();
const axios = require('axios');
const { logEmbeddingGeneration, logError } = require('../middleware/logging');

// Configuration
const API_CONFIG = {
  FIREWORKS_AI: {
    API_KEY: process.env.FIREWORKS_API_KEY,
    BASE_URL: 'https://api.fireworks.ai/inference/v1',
    // Allow override via env; default to a commonly available model name
    EMBEDDINGS_MODEL: process.env.FIREWORKS_EMBEDDINGS_MODEL || 'nomic-ai/nomic-embed-text-v1.5',
    MAX_TOKENS_PER_CHUNK: 800,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000 // Base delay in ms
  }
};

// Error messages
const ERROR_MESSAGES = {
  NO_API_KEY: 'Fireworks AI API key is not configured',
  INVALID_INPUT: 'Invalid input: texts must be a non-empty array of strings',
  API_ERROR: 'Fireworks AI embeddings API error',
  RATE_LIMIT: 'Rate limit exceeded, please try again later',
  TIMEOUT: 'Request timeout - embeddings service is taking too long to respond'
};

// Helper function to estimate token count (rough approximation)
const estimateTokenCount = (text) => {
  // Rough estimation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
};

// Helper function to chunk text into smaller pieces
const chunkText = (text, maxTokens = API_CONFIG.FIREWORKS_AI.MAX_TOKENS_PER_CHUNK) => {
  const estimatedTokens = estimateTokenCount(text);
  
  if (estimatedTokens <= maxTokens) {
    return [text];
  }
  
  // Split by sentences first, then by words if needed
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    const testChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
    const testTokens = estimateTokenCount(testChunk);
    
    if (testTokens <= maxTokens) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = trimmedSentence;
      } else {
        // Single sentence is too long, split by words
        const words = trimmedSentence.split(/\s+/);
        let wordChunk = '';
        
        for (const word of words) {
          const testWordChunk = wordChunk + (wordChunk ? ' ' : '') + word;
          const testWordTokens = estimateTokenCount(testWordChunk);
          
          if (testWordTokens <= maxTokens) {
            wordChunk = testWordChunk;
          } else {
            if (wordChunk) {
              chunks.push(wordChunk);
              wordChunk = word;
            } else {
              // Single word is too long, truncate
              chunks.push(word.substring(0, maxTokens * 4));
            }
          }
        }
        
        if (wordChunk) {
          currentChunk = wordChunk;
        }
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

// Helper function to sanitize input text
const sanitizeText = (text) => {
  if (typeof text !== 'string') {
    throw new Error('Text must be a string');
  }
  
  // Remove or replace potentially problematic characters
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Exponential backoff retry function
const retryWithBackoff = async (fn, maxRetries = API_CONFIG.FIREWORKS_AI.MAX_RETRIES) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.status === 400 || error.status === 401 || error.status === 403) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = API_CONFIG.FIREWORKS_AI.RETRY_DELAY * Math.pow(2, attempt);
      console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} after ${delay}ms delay`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Main embeddings function
const embedTexts = async (texts, requestId = null) => {
  const startTime = Date.now();
  
  // Input validation
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error(ERROR_MESSAGES.INVALID_INPUT);
  }
  
  if (!API_CONFIG.FIREWORKS_AI.API_KEY) {
    throw new Error(ERROR_MESSAGES.NO_API_KEY);
  }
  
  // Sanitize and validate inputs
  const sanitizedTexts = texts.map(text => {
    if (typeof text !== 'string') {
      throw new Error('All texts must be strings');
    }
    return sanitizeText(text);
  }).filter(text => text.length > 0);
  
  if (sanitizedTexts.length === 0) {
    throw new Error('No valid texts provided after sanitization');
  }
  
  // Chunk texts that are too long
  const allChunks = [];
  const chunkMapping = []; // Track which chunks belong to which original text
  
  for (let i = 0; i < sanitizedTexts.length; i++) {
    const chunks = chunkText(sanitizedTexts[i]);
    allChunks.push(...chunks);
    chunkMapping.push({
      originalIndex: i,
      chunkIndices: Array.from({ length: chunks.length }, (_, j) => allChunks.length - chunks.length + j)
    });
  }
  
  console.log(`Processing ${allChunks.length} text chunks for embeddings`);
  
  // Make API request with retry logic
  const makeEmbeddingRequest = async () => {
    const url = `${API_CONFIG.FIREWORKS_AI.BASE_URL}/embeddings`;
    
    const response = await axios.post(url, {
      model: API_CONFIG.FIREWORKS_AI.EMBEDDINGS_MODEL,
      input: allChunks
    }, {
      headers: {
        'Authorization': `Bearer ${API_CONFIG.FIREWORKS_AI.API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });
    
    if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
      throw new Error('Invalid response format from Fireworks AI embeddings API');
    }
    
    return response.data.data;
  };
  
  try {
    const embeddingsData = await retryWithBackoff(makeEmbeddingRequest);
    
    // Reconstruct embeddings for original texts
    const result = [];
    
    for (let i = 0; i < sanitizedTexts.length; i++) {
      const mapping = chunkMapping[i];
      const textEmbeddings = mapping.chunkIndices.map(chunkIndex => {
        const embeddingData = embeddingsData[chunkIndex];
        if (!embeddingData || !Array.isArray(embeddingData.embedding)) {
          throw new Error(`Invalid embedding data for chunk ${chunkIndex}`);
        }
        return embeddingData.embedding;
      });
      
      // If text was chunked, average the embeddings
      if (textEmbeddings.length === 1) {
        result.push(textEmbeddings[0]);
      } else {
        // Average multiple embeddings
        const dimension = textEmbeddings[0].length;
        const averagedEmbedding = new Array(dimension).fill(0);
        
        for (const embedding of textEmbeddings) {
          for (let j = 0; j < dimension; j++) {
            averagedEmbedding[j] += embedding[j];
          }
        }
        
        // Normalize the averaged embedding
        for (let j = 0; j < dimension; j++) {
          averagedEmbedding[j] /= textEmbeddings.length;
        }
        
        result.push(averagedEmbedding);
      }
    }
    
    const duration = Date.now() - startTime;
    const totalTokens = sanitizedTexts.reduce((sum, text) => sum + estimateTokenCount(text), 0);
    
    console.log(`Successfully generated ${result.length} embeddings in ${duration}ms`);
    
    // Log embedding generation metrics
    if (requestId) {
      logEmbeddingGeneration({
        requestId,
        userId: null, // Service level - no user context
        textCount: sanitizedTexts.length,
        totalTokens,
        duration,
        success: true
      });
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const totalTokens = sanitizedTexts ? sanitizedTexts.reduce((sum, text) => sum + estimateTokenCount(text), 0) : 0;
    
    console.error('Embeddings API error:', error.response?.data || error.message);
    
    // Log embedding error
    if (requestId) {
      logEmbeddingGeneration({
        requestId,
        userId: null,
        textCount: sanitizedTexts ? sanitizedTexts.length : texts.length,
        totalTokens,
        duration,
        success: false
      });
      
      logError({
        requestId,
        userId: null,
        operation: 'embedding_generation',
        error,
        context: { textCount: sanitizedTexts ? sanitizedTexts.length : texts.length, totalTokens }
      });
    }
    
    if (error.code === 'ECONNABORTED') {
      throw new Error(ERROR_MESSAGES.TIMEOUT);
    }
    
    if (error.response?.status === 429) {
      throw new Error(ERROR_MESSAGES.RATE_LIMIT);
    }
    
    if (error.response?.status >= 500) {
      throw new Error(`${ERROR_MESSAGES.API_ERROR}: ${error.response?.data?.message || error.message}`);
    }
    
    throw new Error(`${ERROR_MESSAGES.API_ERROR}: ${error.message}`);
  }
};

module.exports = {
  embedTexts
};
