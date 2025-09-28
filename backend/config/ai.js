/**
 * AI Configuration Module
 * 
 * Provides configurable defaults and environment variable overrides for:
 * - Retrieval parameters (K values, relevance threshold)
 * - LLM temperature settings for different use cases
 * - Other AI-related configuration
 */

// Default configuration values
const defaults = {
  // Retrieval parameters
  K_DOCS: 12,          // Number of document chunks to retrieve (increased for better context)
  K_MSGS: 3,           // Number of past messages to retrieve  
  K_MEMS: 2,           // Number of memories to retrieve
  LAST_N: 12,          // Number of last conversation turns to include
  
  // Vector search parameters
  RELEVANCE_THRESHOLD: 0.25,  // Minimum similarity score for retrieval (lowered for more comprehensive coverage)
  
  // Temperature settings for different use cases
  TEMP_FACT: 0.1,      // Low temperature for factual responses
  TEMP_TEACH: 0.4,     // Medium temperature for teaching/explanations
  TEMP_CREATIVE: 0.7,  // Higher temperature for creative tasks
  TEMP_SUMMARY: 0.3,   // Slightly higher temperature for engaging educational summaries
  
  // Generation parameters
  MAX_TOKENS: 2500,    // Maximum tokens for generated responses (increased for comprehensive summaries)
  MAX_TOKENS_SUMMARY: 4000,  // Maximum tokens specifically for document summaries (increased for structured format)
  TOP_P: 0.9,          // Nucleus sampling parameter
  
  // Retry and timeout settings
  MAX_RETRIES: 2,      // Maximum retries for failed API calls
  TIMEOUT_MS: 30000,   // Request timeout in milliseconds
  
  // Validation settings
  MAX_CITATION_DISTANCE: 0.5,  // Maximum semantic distance for citation validation
  MIN_SUPPORT_SCORE: 0.3,      // Minimum support score for claim verification
};

// Environment variable overrides with type conversion
const config = {
  // Retrieval parameters
  K_DOCS: parseInt(process.env.K_DOCS) || defaults.K_DOCS,
  K_MSGS: parseInt(process.env.K_MSGS) || defaults.K_MSGS,
  K_MEMS: parseInt(process.env.K_MEMS) || defaults.K_MEMS,
  LAST_N: parseInt(process.env.LAST_N) || defaults.LAST_N,
  
  // Vector search parameters
  RELEVANCE_THRESHOLD: parseFloat(process.env.RELEVANCE_THRESHOLD) || defaults.RELEVANCE_THRESHOLD,
  
  // Temperature settings
  TEMP_FACT: parseFloat(process.env.TEMP_FACT) || defaults.TEMP_FACT,
  TEMP_TEACH: parseFloat(process.env.TEMP_TEACH) || defaults.TEMP_TEACH,
  TEMP_CREATIVE: parseFloat(process.env.TEMP_CREATIVE) || defaults.TEMP_CREATIVE,
  TEMP_SUMMARY: parseFloat(process.env.TEMP_SUMMARY) || defaults.TEMP_SUMMARY,
  
  // Generation parameters
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS) || defaults.MAX_TOKENS,
  MAX_TOKENS_SUMMARY: parseInt(process.env.MAX_TOKENS_SUMMARY) || defaults.MAX_TOKENS_SUMMARY,
  TOP_P: parseFloat(process.env.TOP_P) || defaults.TOP_P,
  
  // Retry and timeout settings
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || defaults.MAX_RETRIES,
  TIMEOUT_MS: parseInt(process.env.TIMEOUT_MS) || defaults.TIMEOUT_MS,
  
  // Validation settings
  MAX_CITATION_DISTANCE: parseFloat(process.env.MAX_CITATION_DISTANCE) || defaults.MAX_CITATION_DISTANCE,
  MIN_SUPPORT_SCORE: parseFloat(process.env.MIN_SUPPORT_SCORE) || defaults.MIN_SUPPORT_SCORE,
};

// Helper function to get temperature based on task type
function getTemperatureForTask(taskType = 'teach') {
  const temperatures = {
    'fact': config.TEMP_FACT,
    'teach': config.TEMP_TEACH,
    'creative': config.TEMP_CREATIVE,
    'summary': config.TEMP_SUMMARY,
  };
  
  return temperatures[taskType] || config.TEMP_TEACH;
}

// Helper function to get retrieval parameters as object
function getRetrievalParams(overrides = {}) {
  return {
    kDocs: overrides.kDocs || config.K_DOCS,
    kMsgs: overrides.kMsgs || config.K_MSGS,
    kMems: overrides.kMems || config.K_MEMS,
    lastN: overrides.lastN || config.LAST_N,
    relevanceThreshold: overrides.relevanceThreshold || config.RELEVANCE_THRESHOLD,
  };
}

// Helper function to get generation parameters
function getGenerationParams(taskType = 'teach', overrides = {}) {
  // Use higher token limit for summaries and document analysis
  const maxTokens = (taskType === 'summary' || taskType === 'document_summary') 
    ? config.MAX_TOKENS_SUMMARY 
    : config.MAX_TOKENS;
    
  return {
    temperature: overrides.temperature || getTemperatureForTask(taskType),
    max_tokens: overrides.max_tokens || maxTokens,
    top_p: overrides.top_p || config.TOP_P,
  };
}

// Helper function to validate configuration values
function validateConfig() {
  const errors = [];
  
  // Validate ranges
  if (config.RELEVANCE_THRESHOLD < 0 || config.RELEVANCE_THRESHOLD > 1) {
    errors.push('RELEVANCE_THRESHOLD must be between 0 and 1');
  }
  
  if (config.TEMP_FACT < 0 || config.TEMP_FACT > 2) {
    errors.push('TEMP_FACT must be between 0 and 2');
  }
  
  if (config.TEMP_TEACH < 0 || config.TEMP_TEACH > 2) {
    errors.push('TEMP_TEACH must be between 0 and 2');
  }
  
  if (config.TOP_P < 0 || config.TOP_P > 1) {
    errors.push('TOP_P must be between 0 and 1');
  }
  
  if (config.K_DOCS < 1 || config.K_DOCS > 50) {
    errors.push('K_DOCS must be between 1 and 50');
  }
  
  if (config.K_MSGS < 1 || config.K_MSGS > 20) {
    errors.push('K_MSGS must be between 1 and 20');
  }
  
  if (config.K_MEMS < 1 || config.K_MEMS > 10) {
    errors.push('K_MEMS must be between 1 and 10');
  }
  
  if (config.MAX_TOKENS < 100 || config.MAX_TOKENS > 8000) {
    errors.push('MAX_TOKENS must be between 100 and 8000');
  }
  
  if (config.MAX_TOKENS_SUMMARY < 100 || config.MAX_TOKENS_SUMMARY > 10000) {
    errors.push('MAX_TOKENS_SUMMARY must be between 100 and 10000');
  }
  
  if (errors.length > 0) {
    throw new Error('AI Configuration validation failed:\n' + errors.join('\n'));
  }
  
  return true;
}

// Validate configuration on module load
try {
  validateConfig();
} catch (error) {
  console.error('AI Configuration Error:', error.message);
  process.exit(1);
}

module.exports = {
  // Export all configuration values
  ...config,
  
  // Export defaults for reference
  defaults,
  
  // Export helper functions
  getTemperatureForTask,
  getRetrievalParams,
  getGenerationParams,
  validateConfig,
};
