require('dotenv').config();
const axios = require('axios');
const aiConfig = require('../config/ai');

const FIREWORKS = {
  API_KEY: process.env.FIREWORKS_API_KEY,
  BASE_URL: 'https://api.fireworks.ai/inference/v1',
  MODEL: process.env.FIREWORKS_CHAT_MODEL || 'accounts/fireworks/models/llama-v3p1-70b-instruct'
};

function buildSystemPrompt(userContext = {}) {
  const { studentName, university, major, year } = userContext;
  
  return `You are ${studentName ? studentName + "'s" : "a"} fun, engaging AI tutor who makes learning exciting and memorable! You're like that amazing teacher who knows how to make even the most complex topics feel like an adventure. You have a warm, friendly personality with just the right amount of humor to keep things interesting.

🎓 PERSONALIZED TEACHING PRINCIPLES:
1. ${studentName ? `Address ${studentName} by name naturally throughout responses - "Hey ${studentName}!", "${studentName}, let me blow your mind!", "You know what's cool, ${studentName}?"` : 'Use an enthusiastic, encouraging tone'}
2. Add light humor and personality without losing educational value - "This is going to make your brain do a happy dance!", "Prepare for some serious mind-blowing facts!"
3. Break complex topics into 4-8 clear, digestible sections (perfect for sticky note display)
4. Use vivid examples, analogies, and real-world connections that students can relate to
5. Include fascinating facts, specific numbers, and superlatives to make content memorable
6. Make learning feel like a conversation with a knowledgeable friend

💫 PERSONALITY & HUMOR GUIDELINES:
- Use playful expressions: "Let me burst your brain with this!", "This is where it gets spicy!", "Hold onto your hat!"
- Add gentle humor: "I know, I know, math can be scary, but stick with me!", "Plot twist coming up!"
- Be encouraging: "You're going to love this part!", "This is actually way cooler than it sounds!"
- Use fun transitions: "But wait, there's more!", "Here's where things get interesting!"
- Show excitement: "This blows my circuits every time!", "Okay, this is my favorite part!"

📚 RESPONSE STRUCTURE FOR OPTIMAL DISPLAY:
- ${studentName ? `Start with personalized greeting using ${studentName}'s name` : 'Start with enthusiastic greeting'}
- Write 6-12 well-structured sentences that can be grouped into educational sections
- Start each major concept in a new sentence for clear section breaks
- Include specific measurements, comparisons, and quantitative details when available
- Add personality-filled transitions between concepts
- Use descriptive language that helps students visualize complex concepts
- Create natural groupings of 1-2 sentences per concept for sticky note format

🌟 ENGAGEMENT & LEARNING OPTIMIZATION:
- Be conversational like talking to a friend, not lecturing
- ${studentName ? `Make ${studentName} feel special and recognized` : 'Make the student feel valued'}
- Use humor to make difficult concepts less intimidating
- Show genuine excitement about the subject matter
- Help students understand WHY topics are fascinating and important
- Connect new information to things students already know
- Include memorable details (largest, smallest, oldest, most interesting aspects)
- Structure content so it works well in both paragraph and mind-map formats
- Build confidence through supportive, clear explanations

CONTEXT USAGE:
- Use provided CONTEXT comprehensively - don't just answer briefly
- Include citations with exact source ids and quotes for factual statements
- If CONTEXT is insufficient, explain what's missing and provide what you can
- Do not invent sources or information not present in the CONTEXT

OUTPUT FORMAT: Return valid JSON per the schema, with "answer" field optimized for visual, interactive display.

PROACTIVE LEARNING SUGGESTIONS: Always end with 2-3 specific next steps like:
- ${studentName ? `"${studentName}, want me to explain [specific concept] in more detail?"` : '"Want me to explain [specific concept] in more detail?"'}
- ${studentName ? `"Should I create practice questions for you, ${studentName}?"` : '"Should I create practice questions about [topic]?"'}
- ${studentName ? `"${studentName}, would you like to explore how [topic] connects to [related area]?"` : '"Would you like to explore how [topic] connects to [related area]?"'}
- ${studentName ? `"Ready to dive deeper, ${studentName}?"` : '"Ready to dive deeper into [fascinating aspect]?"'}

${studentName ? `Remember: You're ${studentName}'s personal tutor! Make them feel like learning is the best part of their day.` : ''}

Student Profile: ${studentName ? studentName : 'Student'}${university ? ` from ${university}` : ''}${major ? ` studying ${major}` : ''}${year ? ` (${year})` : ''}`;
}

const JSON_SCHEMA_TEXT = `{
  "answer": "string",
  "citations": [
    {"type": "pdf" | "chat" | "profile", "id": "string", "page": 0, "quote": "string"}
  ],
  "uncertainty": { "isUncertain": true, "reasons": ["string"] }
}`;

async function callFireworks(messages, options = {}) {
  if (!FIREWORKS.API_KEY) {
    throw new Error('Fireworks AI API key is not configured');
  }

  // Use configurable defaults with option overrides
  const {
    maxTokens = aiConfig.MAX_TOKENS,
    temperature = aiConfig.TEMP_TEACH,
    top_p = aiConfig.TOP_P
  } = options;

  const url = `${FIREWORKS.BASE_URL}/chat/completions`;
  const body = {
    model: FIREWORKS.MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p
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

function buildContextBlock({ sessionSummary, docChunks, pastMessages, memories, lastTurns }) {
  const lines = [];
  if (sessionSummary && sessionSummary.trim()) {
    lines.push('SESSION_SUMMARY:');
    lines.push(sessionSummary.trim());
  }

  if (Array.isArray(docChunks) && docChunks.length > 0) {
    lines.push('\nDOC_CHUNKS:');
    docChunks.forEach((c, idx) => {
      lines.push(`- [pdf] id=${c._id} docId=${c.docId} page=${typeof c.page === 'number' ? c.page : 0}`);
      const snippet = (c.text || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
      lines.push(`  text: ${snippet}`);
    });
  }

  if (Array.isArray(pastMessages) && pastMessages.length > 0) {
    lines.push('\nRELEVANT_CHAT_MESSAGES:');
    pastMessages.forEach(m => {
      const snippet = (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      lines.push(`- [chat] id=${m._id} role=${m.role} text: ${snippet}`);
    });
  }

  if (Array.isArray(memories) && memories.length > 0) {
    lines.push('\nPROFILE_MEMORIES:');
    memories.forEach(mem => {
      const snippet = (mem.content || '').replace(/\s+/g, ' ').trim().slice(0, 300);
      lines.push(`- [profile] id=${mem._id} kind=${mem.kind} text: ${snippet}`);
    });
  }

  if (Array.isArray(lastTurns) && lastTurns.length > 0) {
    lines.push('\nLAST_TURNS:');
    lastTurns.forEach(t => {
      const snippet = (t.content || '').replace(/\s+/g, ' ').trim().slice(0, 200);
      lines.push(`- id=${t._id} role=${t.role} text: ${snippet}`);
    });
  }

  return lines.join('\n');
}

function validateAnswerJson(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Output is not a JSON object'] };
  }
  if (typeof obj.answer !== 'string') errors.push('answer must be a string');
  if (!Array.isArray(obj.citations)) errors.push('citations must be an array');
  if (!obj.uncertainty || typeof obj.uncertainty !== 'object') {
    errors.push('uncertainty must be an object');
  } else {
    if (typeof obj.uncertainty.isUncertain !== 'boolean') errors.push('uncertainty.isUncertain must be boolean');
    if (!Array.isArray(obj.uncertainty.reasons)) errors.push('uncertainty.reasons must be an array of strings');
  }
  if (Array.isArray(obj.citations)) {
    const allowed = new Set(['pdf', 'chat', 'profile']);
    obj.citations.forEach((c, i) => {
      if (!c || typeof c !== 'object') errors.push(`citations[${i}] must be object`);
      else {
        if (!allowed.has(c.type)) errors.push(`citations[${i}].type invalid`);
        if (typeof c.id !== 'string' || !c.id) errors.push(`citations[${i}].id must be string`);
        if (c.page !== undefined && typeof c.page !== 'number') errors.push(`citations[${i}].page must be number if present`);
        if (c.quote !== undefined && typeof c.quote !== 'string') errors.push(`citations[${i}].quote must be string if present`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

function tryParseJson(text) {
  const trimmed = (text || '').trim();
  // Remove code fences if present
  const noFence = trimmed.replace(/^```[a-zA-Z]*\n?|```$/g, '');
  try {
    return JSON.parse(noFence);
  } catch (_e) {
    return null;
  }
}

async function generateConstrainedAnswer({ question, context, taskType = 'teach', temperature, userContext = {} }) {
  // Use configurable generation parameters
  const genParams = aiConfig.getGenerationParams(taskType, { temperature });
  
  // Add specialized instructions for document summaries
  let additionalInstructions = '';
  if (taskType === 'document_summary' || taskType === 'summary') {
    additionalInstructions = `\n\nSPECIAL INSTRUCTIONS FOR DOCUMENT SUMMARIES:
- Create a highly structured, educational summary using clear hierarchical organization
- Use the exact format structure: Document Overview → Course Information → Quick Summary → Learning Roadmap → Key Definitions → Formulas → Applications → Teaching Progression
- Organize content into numbered topics (TOPIC 1, TOPIC 2, etc.) with numbered subtopics (1.1, 1.2, etc.)
- Each topic should have a "Core Concept" and "Key Subtopics" breakdown
- Make it a learning roadmap that both students and AI can reference for progressive teaching
- Include a Teaching Progression Guide (Beginner → Intermediate → Advanced levels)
- Use markdown formatting with ## for main sections and ### for topics
- Focus on creating a structured breakdown that facilitates systematic learning
- Include specific page references in citations when available
- ALWAYS end your response with relevant proactive suggestions for next steps, such as:
  * "Would you like me to create a detailed learning roadmap for us to study this material together?"
  * "Should I start teaching you the first topic in detail?"
  * "Would you like me to create practice questions on any specific topic?"
  * "Should we dive deeper into any particular section that interests you?"`;
  }
  
  const systemPrompt = buildSystemPrompt(userContext);
  const system = `${systemPrompt}${additionalInstructions}\n\nYou MUST return ONLY valid JSON matching this exact schema (no extra keys, no markdown, no prose):\n${JSON_SCHEMA_TEXT}`;
  const user = `CONTEXT:\n${context}\n\nQUESTION: ${question}\n\nReturn ONLY JSON with keys answer, citations, uncertainty. Do not include any non-JSON text.`;

  let output = await callFireworks([
    { role: 'system', content: system },
    { role: 'user', content: user }
  ], genParams);

  let obj = tryParseJson(output);
  let validation = validateAnswerJson(obj);
  if (!validation.valid) {
    const retrySystem = `${system}\nSTRICTNESS: The previous output was invalid because: ${validation.errors.join('; ')}. You must fix it.`;
    const retryUser = `${user}\nSTRICT: Output MUST be valid JSON. No commentary. No code fences.`;
    
    // Use slightly lower temperature for retry
    const retryParams = {
      ...genParams,
      temperature: Math.max(0, genParams.temperature - 0.1)
    };
    
    output = await callFireworks([
      { role: 'system', content: retrySystem },
      { role: 'user', content: retryUser }
    ], retryParams);
    obj = tryParseJson(output);
    validation = validateAnswerJson(obj);
  }

  if (!validation.valid) {
    const fallback = {
      answer: "I don't know",
      citations: [],
      uncertainty: {
        isUncertain: true,
        reasons: validation.errors.slice(0, 3)
      }
    };
    return { json: fallback, raw: output, valid: false, errors: validation.errors };
  }

  // Clean the answer text to remove excess special characters
  if (obj && obj.answer && typeof obj.answer === 'string') {
    // Remove JSON artifacts and markdown code fences
    obj.answer = obj.answer.replace(/```json\s*/gi, '');
    obj.answer = obj.answer.replace(/```\s*/g, '');
    obj.answer = obj.answer.replace(/^\s*{\s*"answer":\s*"/gi, '');
    obj.answer = obj.answer.replace(/"\s*}\s*$/gi, '');
    
    // Remove excess backslashes (common in JSON escaping)
    obj.answer = obj.answer.replace(/\\"/g, '"');
    obj.answer = obj.answer.replace(/\\\\/g, '\\');
    
    // Remove excess special characters at the beginning/end
    obj.answer = obj.answer.replace(/^[*#`\-_=+~\[\]{}()]+\s*/g, '');
    obj.answer = obj.answer.replace(/\s*[*#`\-_=+~\[\]{}()]+$/g, '');
    
    // Clean up multiple consecutive special characters
    obj.answer = obj.answer.replace(/([*#`\-_=+~])\1{3,}/g, '$1$1');
    
    // Remove excess whitespace
    obj.answer = obj.answer.replace(/\n{3,}/g, '\n\n');
    obj.answer = obj.answer.replace(/[ \t]{3,}/g, '  ');
    
    // Trim whitespace
    obj.answer = obj.answer.trim();
  }

  return { json: obj, raw: output, valid: true, errors: [] };
}

module.exports = {
  buildContextBlock,
  validateAnswerJson,
  generateConstrainedAnswer
};


