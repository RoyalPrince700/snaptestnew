require('dotenv').config();
const axios = require('axios');
const Conversation = require('../models/Conversation');
const aiConfig = require('../config/ai');
const { logConversationSummary, logError } = require('../middleware/logging');

const FIREWORKS = {
  API_KEY: process.env.FIREWORKS_API_KEY,
  BASE_URL: 'https://api.fireworks.ai/inference/v1',
  MODEL: process.env.FIREWORKS_SUMMARY_MODEL || 'accounts/fireworks/models/llama-v3p1-70b-instruct'
};

const SUMMARIZE_EVERY_N_TURNS = parseInt(process.env.SUMMARIZE_EVERY_N_TURNS || '12', 10);

async function callFireworksChat(messages, options = {}) {
  if (!FIREWORKS.API_KEY) {
    throw new Error('Fireworks AI API key is not configured');
  }

  // Use configurable parameters for summarization
  const genParams = aiConfig.getGenerationParams('summary', options);

  const url = `${FIREWORKS.BASE_URL}/chat/completions`;

  const body = {
    model: FIREWORKS.MODEL,
    messages,
    max_tokens: genParams.max_tokens,
    temperature: genParams.temperature,
    top_p: genParams.top_p
  };

  const resp = await axios.post(url, body, {
    headers: {
      'Authorization': `Bearer ${FIREWORKS.API_KEY}`,
      'Content-Type': 'application/json'
    },
    timeout: aiConfig.TIMEOUT_MS
  });

  if (!resp.data || !resp.data.choices || !resp.data.choices[0]) {
    throw new Error('Invalid response format from Fireworks AI');
  }
  return resp.data.choices[0].message.content || '';
}

function buildSummaryPrompt(messages) {
  const conversationText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const system = `You are a diligent note-taker. Summarize the conversation into 600-800 tokens focusing on:\n- Student profile facts and preferences if stated\n- Key questions asked and answers provided\n- Important definitions, examples, or steps\n- Open questions or TODOs\nKeep it concise and faithful to the original content. Do not invent details.`;
  const user = `Summarize the following dialogue into a coherent study session summary.\n\n${conversationText}`;
  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

async function summarizeConversation({ conversationId, requestId = null }) {
  const startTime = Date.now();
  
  try {
    const convo = await Conversation.findById(conversationId);
    if (!convo) throw new Error('Conversation not found');

    const lastMessages = (convo.messages || []).slice(-30);
    if (lastMessages.length === 0) return '';

    const promptMessages = buildSummaryPrompt(lastMessages);
    const summary = await callFireworksChat(promptMessages);

    convo.sessionSummary = summary;
    await convo.save();
    
    const duration = Date.now() - startTime;
    
    // Log conversation summary metrics
    if (requestId) {
      logConversationSummary({
        requestId,
        userId: convo.userId,
        conversationId,
        messageCount: lastMessages.length,
        summaryLength: summary.length,
        duration,
        success: true
      });
    }
    
    return summary;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (requestId) {
      logConversationSummary({
        requestId,
        userId: null,
        conversationId,
        messageCount: 0,
        summaryLength: 0,
        duration,
        success: false
      });
      
      logError({
        requestId,
        userId: null,
        operation: 'conversation_summary',
        error,
        context: { conversationId }
      });
    }
    
    throw error;
  }
}

async function updateSummaryIfNeeded(conversationId, requestId = null) {
  const convo = await Conversation.findById(conversationId).select('messages sessionSummary');
  if (!convo) return { updated: false };

  const count = (convo.messages || []).length;
  if (count > 0 && count % SUMMARIZE_EVERY_N_TURNS === 0) {
    const summary = await summarizeConversation({ conversationId, requestId });
    return { updated: true, summary };
  }
  return { updated: false };
}

module.exports = {
  summarizeConversation,
  updateSummaryIfNeeded
};


