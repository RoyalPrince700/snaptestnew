const StudySession = require('../models/StudySession');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');
const Feedback = require('../models/Feedback');
const fireworksService = require('../services/fireworksService');
const profileUpdateService = require('../services/profileUpdateService');
const { updateSummaryIfNeeded } = require('../services/summarize');
const { retrieveContext } = require('../services/retrieval');
const { buildContextBlock, generateConstrainedAnswer } = require('../services/llm');
const { verifySupport } = require('../services/verify');
const { embedTexts } = require('../services/embeddings');
const { 
  logRAGRetrieval, 
  logLLMGeneration, 
  logJSONValidation, 
  logCitationVerification, 
  logFeedbackSubmission,
  logError 
} = require('../middleware/logging');

// @desc    JSON-constrained answer generation with citations (RAG)
// @route   POST /api/ai/ask-question
// @access  Private
const askQuestion = async (req, res) => {
  const requestId = req.requestId;
  const startTime = Date.now();
  
  try {
    const { conversationId, question } = req.body || {};

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ success: false, message: 'conversationId is required' });
    }
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'question is required' });
    }

    // Verify conversation ownership
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user.userId,
      isActive: true
    }).lean();

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Helper: resolve target document id from question ONLY if explicitly referenced
    async function resolveDocIdFromQuestion(userId, text, fallbackActive) {
      try {
        if (fallbackActive) return fallbackActive;
        const Document = require('../models/Document');
        // ONLY try to extract explicitly quoted filename - don't fallback to recent documents
        const m = /\"([^\"]+\.pdf)\"/i.exec(text) || /'([^']+\.pdf)'/i.exec(text);
        if (m && m[1]) {
          const name = m[1].trim();
          console.log(`[AI Debug] Doc resolution: found explicitly quoted filename in question => ${name}`);
          const query = { userId, originalName: { $regex: name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } };
          const doc = await Document.findOne(query).sort({ uploadDate: -1 }).select('docId originalName uploadDate').lean();
          if (doc) {
            console.log(`[AI Debug] Doc resolution: using explicitly referenced docId=${doc.docId} name="${doc.originalName}"`);
            return doc.docId;
          } else {
            console.log(`[AI Debug] Doc resolution: quoted filename "${name}" not found in user's documents`);
          }
        } else {
          console.log(`[AI Debug] Doc resolution: no explicit document reference found in question - will not auto-select documents`);
        }
      } catch (e) {
        console.warn('[AI Debug] Doc resolution failed:', e?.message || e);
      }
      return null;
    }

    // Build retrieval context with timing
    console.log(`[AI Debug] Starting retrieval for user ${req.user.userId}, conversation ${conversationId}`);
    console.log(`[AI Debug] Query: "${question}"`);
    
    const ragStart = Date.now();
    const isSummaryIntent = /\b(summarize|overview|what is this (pdf|document)|key topics|main topics|table of contents|explain.*document|document.*about|content.*of.*pdf|comprehensive.*summary|what.*covered)\b/i.test(question);
    
    // Detect when user is accepting suggestions for enhanced responses
    const isLearningRoadmapRequest = /\b(create.*roadmap|learning.*roadmap|study.*plan|roadmap|plan.*study|step.*by.*step)\b/i.test(question);
    const isTeachingRequest = /\b(teach.*me|start.*teaching|explain.*detail|teach.*first|begin.*teaching|interactive.*teaching)\b/i.test(question);
    const isPracticeRequest = /\b(practice.*question|create.*question|quiz|test|exercise|flashcard|practice.*material)\b/i.test(question);
    const isDeepDiveRequest = /\b(deep.*dive|explore.*depth|detail.*about|more.*about|dive.*deeper)\b/i.test(question);
    const isConceptClarification = /\b(explain.*simpler|simpler.*terms|clarify|don't.*understand|confuse|unclear)\b/i.test(question);
    let ragContext;
    let resolvedDocId = conversation.activeDocId || null;
    // Only attempt to resolve documents if there's an explicit document reference in the question
    // This prevents automatic document retrieval in new conversations
    if (!resolvedDocId) {
      resolvedDocId = await resolveDocIdFromQuestion(req.user.userId, question, null);
    }
    console.log(`[AI Debug] SummaryIntent=${isSummaryIntent} activeDocId=${conversation.activeDocId || null} resolvedDocId=${resolvedDocId || null}`);

    if (isSummaryIntent && resolvedDocId) {
      const { retrieveDocOverview, retrieveContext } = require('../services/retrieval');
      const overviewChunks = await retrieveDocOverview({ userId: req.user.userId, docId: resolvedDocId, maxChunks: 30 });
      console.log(`[AI Debug] Overview sampling: chunks=${overviewChunks.length}`);
      if (overviewChunks.length > 0) {
        console.log(`[AI Debug] Overview sample[0]: page=${overviewChunks[0].page} textPreview=${String(overviewChunks[0].text||'').slice(0,120)}`);
      }
      // Also include standard retrieval for citations/context
      const base = await retrieveContext({
        userId: req.user.userId,
        conversationId,
        query: question,
        activeDocId: resolvedDocId,
        // Significantly increase kDocs for comprehensive coverage
        kDocs: 20
      });
      ragContext = {
        ...base,
        // Prepend overview chunks to docChunks (dedupe downstream in build)
        docChunks: [...overviewChunks, ...base.docChunks]
      };
    } else {
      // Use enhanced parameters for teaching, roadmap, and practice requests
      const enhancedParams = (isTeachingRequest || isLearningRoadmapRequest || isPracticeRequest || isDeepDiveRequest) ? {
        kDocs: 18,  // More chunks for comprehensive teaching content
        kMsgs: 3,
        kMems: 2,
        lastN: 8
      } : {
        kDocs: 12   // Still more than default for regular questions
      };
      
      ragContext = await retrieveContext({
        userId: req.user.userId,
        conversationId,
        query: question,
        activeDocId: resolvedDocId || conversation.activeDocId || null,
        ...enhancedParams
      });
    }
    const ragDuration = Date.now() - ragStart;

    // Debug log retrieval results
    console.log(`[AI Debug] Retrieval completed in ${ragDuration}ms`);
    console.log(`[AI Debug] Found ${ragContext.docChunks?.length || 0} document chunks`);
    console.log(`[AI Debug] Found ${ragContext.pastMessages?.length || 0} past messages`);
    console.log(`[AI Debug] Found ${ragContext.memories?.length || 0} memories`);
    console.log(`[AI Debug] Found ${ragContext.lastTurns?.length || 0} last turns`);
    
    if (ragContext.docChunks?.length > 0) {
      console.log(`[AI Debug] Document chunks details:`);
      ragContext.docChunks.forEach((chunk, idx) => {
        console.log(`  [${idx}] DocID: ${chunk.docId}, Score: ${chunk.score?.toFixed(3)}, Text preview: ${chunk.text?.slice(0, 100)}...`);
      });
    } else {
      console.log(`[AI Debug] ⚠️  NO DOCUMENT CHUNKS FOUND - This is likely why AI says "I don't know"`);
    }

    // Log RAG retrieval metrics
    logRAGRetrieval({
      requestId,
      userId: req.user.userId,
      conversationId,
      query: question,
      results: ragContext,
      duration: ragDuration,
      config: {
        kDocs: ragContext.kDocs,
        kMsgs: ragContext.kMsgs,
        kMems: ragContext.kMems,
        lastN: ragContext.lastN,
        relevanceThreshold: ragContext.relevanceThreshold
      }
    });

    // Build text CONTEXT block
    const contextBlock = buildContextBlock({
      sessionSummary: conversation.sessionSummary || '',
      docChunks: ragContext.docChunks,
      pastMessages: ragContext.pastMessages,
      memories: ragContext.memories,
      lastTurns: ragContext.lastTurns
    });

    // Generate JSON-constrained answer with timing
    const llmStart = Date.now();
    // Use document_summary task type for better token limits and temperature
    const taskType = isSummaryIntent ? 'document_summary' : 'teach';
    
    // Enhance the question based on intent type for better responses
    let enhancedQuestion = question.trim();
    let enhancedTaskType = taskType;
    
    if (isLearningRoadmapRequest) {
      enhancedQuestion = `${question.trim()}

Please create a comprehensive, step-by-step learning roadmap for studying this material. Structure it as:

## PERSONALIZED LEARNING ROADMAP

### PHASE 1: FOUNDATION (Week 1-2)
**Objectives**: [What student should achieve]
**Topics to Master**:
- [Specific topic with estimated time]
- [Specific topic with estimated time]
**Study Activities**: [Reading, exercises, practice]
**Assessment**: [How to check understanding]

### PHASE 2: BUILDING KNOWLEDGE (Week 3-4)
[Continue same structure...]

### PHASE 3: ADVANCED APPLICATION (Week 5-6)
[Continue same structure...]

## DAILY STUDY SCHEDULE
[Suggested daily routine and time allocation]

## PROGRESS CHECKPOINTS
[Milestones and self-assessment points]

## ADDITIONAL RESOURCES
[Supplementary materials and references]

End with: "Shall we start with Phase 1? I can guide you through each topic step by step!"`;
      enhancedTaskType = 'teach';
    } else if (isTeachingRequest) {
      enhancedQuestion = `${question.trim()}

Please start teaching the first or most fundamental topic from the document in an interactive, engaging way. Structure your teaching as:

## INTERACTIVE TEACHING SESSION

### TODAY'S TOPIC: [Topic Name]
**Learning Objective**: By the end of this session, you'll understand [specific goal]

### CONCEPT INTRODUCTION
[Clear, simple explanation of the main concept]

### KEY POINTS BREAKDOWN
1. **Point 1**: [Explanation with example]
2. **Point 2**: [Explanation with example] 
3. **Point 3**: [Explanation with example]

### REAL-WORLD EXAMPLES
[Practical examples and applications]

### UNDERSTANDING CHECK
Ask me: "Do you understand [specific concept]? Would you like me to explain any part differently?"

### NEXT STEPS
[What we'll cover in the next session]

Make it conversational and engaging, as if you're my personal tutor!`;
      enhancedTaskType = 'teach';
    } else if (isPracticeRequest) {
      enhancedQuestion = `${question.trim()}

Please create comprehensive practice materials for this subject. Structure as:

## PRACTICE MATERIALS COLLECTION

### QUICK REVIEW QUESTIONS (5-10 questions)
[Simple recall questions to test basic understanding]

### MULTIPLE CHOICE QUESTIONS (5-8 questions)
[Each with 4 options and explanations for correct answers]

### SHORT ANSWER QUESTIONS (3-5 questions)
[Questions requiring brief explanations]

### APPLICATION PROBLEMS (2-3 problems)
[Real-world scenarios to apply concepts]

### FLASHCARD SUGGESTIONS
[Key terms and definitions for memorization]

### SELF-ASSESSMENT RUBRIC
[How to evaluate your own understanding]

End with: "Would you like to start with any of these practice activities? I can provide immediate feedback!"`;
      enhancedTaskType = 'teach';
    } else if (isSummaryIntent) {
      enhancedQuestion = `${question.trim()}

Please provide a comprehensive, structured educational summary using this exact format:

## DOCUMENT OVERVIEW
[Brief 2-3 sentence summary]

## COURSE INFORMATION  
[Course details if available]

## QUICK SUMMARY
[Concise 3-4 sentence overview]

## LEARNING ROADMAP
### TOPIC 1: [Main Topic]
**Core Concept**: [Key idea]
**Key Subtopics**:
- **1.1 [Subtopic]**: [Explanation]
- **1.2 [Subtopic]**: [Explanation]

### TOPIC 2: [Main Topic]
[Continue pattern...]

## KEY DEFINITIONS & TERMS
[Important terms with definitions]

## IMPORTANT FORMULAS & METHODS
[Any formulas or methodologies]

## PRACTICAL APPLICATIONS
[Real-world applications]

## TEACHING PROGRESSION GUIDE
**Beginner Level**: [Starting topics]
**Intermediate Level**: [Progressive topics]  
**Advanced Level**: [Advanced topics]

This structure will serve as a learning roadmap for systematic teaching and easy reference.

After providing this summary, ALWAYS include proactive suggestions for next steps, such as:
- "Would you like me to create a detailed learning roadmap for us to study this material together?"
- "Should I start teaching you the first topic in detail?"
- "Would you like me to create practice questions on any specific topic?"
- "Should we dive deeper into any particular section that interests you?"
- "Would you like me to explain any of the key concepts in simpler terms?"

Choose 2-3 most relevant suggestions based on the content and present them in a friendly, encouraging way.`;
    }
    
    // Fetch user context for personalized AI responses
    const user = await User.findById(req.user.userId).select('profile courses onboardingCompleted courseFormUploaded onboardingState');
    const userContext = {
      studentName: user?.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : null,
      university: user?.profile?.university,
      year: user?.profile?.year,
      major: user?.profile?.major,
      courses: user?.courses || []
    };

    const llmResult = await generateConstrainedAnswer({ 
      question: enhancedQuestion, 
      context: contextBlock, 
      taskType: enhancedTaskType,
      temperature: isSummaryIntent ? 0.3 : 0.2,
      userContext
    });
    const llmDuration = Date.now() - llmStart;

    // Log LLM generation metrics
    logLLMGeneration({
      requestId,
      userId: req.user.userId,
      model: process.env.FIREWORKS_CHAT_MODEL || 'llama-v3p1-70b-instruct',
      promptSize: contextBlock.length + question.length,
      completion: llmResult.raw,
      temperature: 0.2,
      duration: llmDuration,
      retries: llmResult.valid ? 0 : 1,
      success: llmResult.valid
    });

    // Log JSON validation metrics
    logJSONValidation({
      requestId,
      userId: req.user.userId,
      rawOutput: llmResult.raw,
      validationResult: { valid: llmResult.valid, errors: llmResult.errors },
      retryAttempted: !llmResult.valid
    });

    // Guardrails verify: flag unsupported claims vs citations
    let verified = null;
    try {
      const verifyStart = Date.now();
      verified = await verifySupport(llmResult.json, ragContext);
      const verifyDuration = Date.now() - verifyStart;
      
      // Log citation verification metrics
      logCitationVerification({
        requestId,
        userId: req.user.userId,
        answer: llmResult.json.answer,
        citations: llmResult.json.citations,
        verificationResult: verified
      });
      
      if (verified && verified.json) {
        // Merge verified uncertainty back
        llmResult.json = verified.json;
      }
    } catch (verr) {
      console.warn('[AI] verifySupport failed:', verr && verr.message ? verr.message : verr);
      logError({
        requestId,
        userId: req.user.userId,
        operation: 'citation_verification',
        error: verr,
        context: { conversationId, questionLength: question.length }
      });
    }

    // Persist messages (user + assistant) with embeddings
    const [userEmbedding, assistantEmbedding] = await embedTexts([question.trim(), llmResult.json.answer || ''], requestId);

    // Store user message
    await Message.create({
      conversationId,
      role: 'user',
      content: question.trim(),
      tokens: 0,
      embedding: Array.isArray(userEmbedding) ? userEmbedding : [],
      sourceRefs: []
    });

    // Map citations to sourceRefs (type,id only in schema)
    const sourceRefs = Array.isArray(llmResult.json.citations)
      ? llmResult.json.citations
          .filter(c => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.type === 'string')
          .map(c => ({ type: c.type, id: c.id }))
      : [];

    await Message.create({
      conversationId,
      role: 'assistant',
      content: llmResult.json.answer || '',
      tokens: 0,
      embedding: Array.isArray(assistantEmbedding) ? assistantEmbedding : [],
      sourceRefs
    });

    // Update conversation timestamp and maybe summary
    try {
      await Conversation.updateOne({ _id: conversationId }, { $set: { lastMessageAt: new Date() } });
      await updateSummaryIfNeeded(conversationId, requestId);
    } catch (e) {
      console.warn('[AI] askQuestion: summary update skipped:', e.message || e);
    }

    // Return validated + verified JSON result
    return res.json({ success: true, data: llmResult.json, valid: llmResult.valid, errors: llmResult.errors || [], verified: verified ? { ok: verified.ok, reasons: verified.reasons, checkedCitations: verified.checkedCitations } : undefined });
  } catch (error) {
    console.error('[AI] askQuestion error:', error);
    logError({
      requestId,
      userId: req.user?.userId,
      operation: 'ask_question',
      error,
      context: { conversationId: req.body?.conversationId, questionLength: req.body?.question?.length || 0 }
    });
    return res.status(500).json({ success: false, message: 'Failed to generate answer', error: process.env.NODE_ENV === 'development' ? error.message : {} });
  }
};

// @desc    Chat with AI assistant
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = async (req, res) => {
  try {
    const { message, conversationId, context = '' } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    // Verify conversation belongs to user
    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: req.user.userId,
      isActive: true
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Fetch user context for personalized AI responses
    const user = await User.findById(req.user.userId).select('profile courses onboardingCompleted courseFormUploaded onboardingState');
    let userContext = {
      studentName: user?.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : null,
      university: user?.profile?.university,
      year: user?.profile?.year,
      major: user?.profile?.major,
      courses: user?.courses || [],
      // Onboarding state detection
      isNewUser: !user?.profile?.firstName && !user?.profile?.university && (!user?.courses || user.courses.length === 0),
      hasBasicInfo: !!(user?.profile?.firstName && user?.profile?.university),
      hasCourses: !!(user?.courses && user.courses.length > 0),
      onboardingCompleted: user?.onboardingCompleted || false,
      courseFormUploaded: user?.courseFormUploaded || false,
      onboardingState: user?.onboardingState || 'welcome'
    };

    // Use the Fireworks service for chat with user context
    const start = Date.now();
    console.log('[AI] → chatWithAI', {
      userId: req.user?.userId,
      conversationId,
      messagePreview: message.substring(0, 80),
      hasContext: !!context,
      hasUserContext: !!(userContext.studentName || userContext.courses.length > 0)
    });
    const result = await fireworksService.chat(message.trim(), userContext, {
      maxTokens: 1000,
      temperature: 0.7
    });

    console.log('[AI] ← chatWithAI result', {
      success: result.success,
      hasResponse: !!result.response,
      hasProfileUpdates: !!result.profileUpdates,
      onboardingCompleted: result.onboardingCompleted,
      onboardingState: result.onboardingState,
      durationMs: Date.now() - start
    });

    if (!result.success) {
      console.error('[AI] × Fireworks AI failed:', result.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI response',
        error: result.error
      });
    }

    // Handle profile updates if detected
    if (result.profileUpdates) {
      try {
        console.log('[AI] Profile updates detected, applying to user profile...');

        // Prepare updates for the AI profile update endpoint
        const profileUpdates = { ...result.profileUpdates };

        // Add onboarding completion/state if detected
        if (result.onboardingCompleted) {
          profileUpdates.onboardingCompleted = true;
        }
        if (result.onboardingState) {
          profileUpdates.onboardingState = result.onboardingState;
        }

        // Apply profile updates using the new endpoint
        const profileUpdateResponse = await profileUpdateService.updateProfile(
          req.user.userId,
          profileUpdates,
          conversationId
        );

        console.log('[AI] Profile updated successfully:', profileUpdateResponse.updatesApplied);

        // Refresh user context for future responses
        const updatedUser = await User.findById(req.user.userId).select('profile courses onboardingCompleted courseFormUploaded onboardingState');
        if (updatedUser) {
          userContext = {
            studentName: updatedUser?.profile?.firstName ? `${updatedUser.profile.firstName} ${updatedUser.profile.lastName || ''}`.trim() : null,
            university: updatedUser?.profile?.university,
            year: updatedUser?.profile?.year,
            major: updatedUser?.profile?.major,
            courses: updatedUser?.courses || [],
            hasBasicInfo: !!(updatedUser?.profile?.firstName && updatedUser?.profile?.university),
            hasCourses: !!(updatedUser?.courses && updatedUser.courses.length > 0),
            onboardingCompleted: updatedUser?.onboardingCompleted || false,
            courseFormUploaded: updatedUser?.courseFormUploaded || false,
            onboardingState: updatedUser?.onboardingState || 'welcome'
          };
        }
      } catch (profileUpdateError) {
        console.error('[AI] Failed to update profile:', profileUpdateError);
        // Don't fail the chat request if profile update fails
      }
    }

    // Add user message to conversation
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date()
    });

    // Add AI response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: result.response,
      timestamp: new Date()
    });

    // Update last message time
    conversation.lastMessageAt = new Date();

    // Update title if it's the first user message
    if (conversation.messages.filter(m => m.role === 'user').length === 1) {
      try {
        // Generate AI-powered title
        const aiTitle = await fireworksService.generateConversationTitle(message);
        conversation.title = aiTitle;
      } catch (titleError) {
        console.error('[AI] Failed to generate AI title, using fallback:', titleError);
        // Fallback to truncated message
        conversation.title = message.length > 50 ? message.substring(0, 50) + '...' : message;
      }
    }

    await conversation.save();

    // Update rolling session summary approximately every N turns
    try {
      await updateSummaryIfNeeded(conversation._id);
    } catch (summaryErr) {
      console.warn('[AI] Summary update skipped:', summaryErr.message || summaryErr);
    }

    res.json({
      success: true,
      data: {
        response: result.response,
        message: message.trim(),
        timestamp: result.timestamp,
        conversationId: conversation._id
      }
    });
  } catch (error) {
    console.error('[AI] chatWithAI error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI response',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Get AI study assistance (legacy endpoint)
// @route   POST /api/ai/study-help
// @access  Public
const getStudyHelp = async (req, res) => {
  try {
    const { question, subject, topic, context, difficulty = 'medium' } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    // Build context for the chat
    const chatContext = `Subject: ${subject || 'General'}
Topic: ${topic || 'General'}
Difficulty: ${difficulty}
${context ? `Additional context: ${context}` : ''}`;

    // Use the Fireworks service for chat
    const result = await fireworksService.chat(question, chatContext, {
      maxTokens: 1000,
      temperature: 0.7
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get AI assistance',
        error: result.error
      });
    }

    // Log AI interaction if user is authenticated
    if (req.user) {
      try {
        await StudySession.findOneAndUpdate(
          { user: req.user.userId },
          {
            $push: {
              aiInteractions: {
                question,
                aiResponse: result.response,
                timestamp: new Date()
              }
            }
          },
          { sort: { createdAt: -1 } }
        );
      } catch (logError) {
        console.error('Failed to log AI interaction:', logError);
        // Don't fail the request if logging fails
      }
    }

    res.json({
      success: true,
      data: {
        response: result.response,
        question,
        subject,
        topic,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    console.error('AI study help error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI assistance',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Generate study plan
// @route   POST /api/ai/study-plan
// @access  Private
const generateStudyPlan = async (req, res) => {
  try {
    const { subject, topic, duration, goals, currentLevel } = req.body;

    if (!subject || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Subject and topic are required'
      });
    }

    const systemPrompt = `You are a study planning expert. Create detailed, actionable study plans for undergraduate students.

Guidelines:
1. Break down topics into manageable study sessions (30-90 minutes each)
2. Include mix of reading, practice, and review activities
3. Suggest realistic timelines based on student's goals
4. Include assessment checkpoints
5. Recommend resources and study techniques
6. Consider the student's current knowledge level

Format the response as a structured study plan with clear steps and time estimates.`;

    const userPrompt = `Create a study plan for:
Subject: ${subject}
Topic: ${topic}
Available time: ${duration || 'Flexible'}
Goals: ${goals || 'Master the topic thoroughly'}
Current knowledge level: ${currentLevel || 'Beginner to intermediate'}

Please provide a comprehensive study plan.`;

    // Use the Fireworks service for study plan generation
    const result = await fireworksService.chat(userPrompt, systemPrompt, {
      maxTokens: 1500,
      temperature: 0.6
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate study plan',
        error: result.error
      });
    }

    const aiResponse = result.response;

    res.json({
      success: true,
      data: {
        studyPlan: aiResponse,
        subject,
        topic,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Study plan generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate study plan',
      error: process.env.NODE_ENV === 'development' ? error.message : {}
    });
  }
};

// @desc    Submit feedback on an assistant message (hallucination/good/bad)
// @route   POST /api/ai/feedback
// @access  Private
const submitFeedback = async (req, res) => {
  const requestId = req.requestId;
  
  try {
    const { conversationId, messageId, kind, comment = '' } = req.body || {};

    if (!conversationId || !messageId || !kind) {
      return res.status(400).json({ success: false, message: 'conversationId, messageId and kind are required' });
    }
    if (!['hallucination', 'good', 'bad'].includes(kind)) {
      return res.status(400).json({ success: false, message: 'Invalid kind. Allowed: hallucination | good | bad' });
    }

    // Verify conversation ownership
    const conversation = await Conversation.findOne({ _id: conversationId, userId: req.user.userId, isActive: true }).lean();
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Verify message belongs to conversation and is assistant message
    const message = await Message.findOne({ _id: messageId, conversationId }).lean();
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Persist feedback
    const saved = await Feedback.create({
      userId: req.user.userId,
      conversationId,
      messageId,
      kind,
      comment: typeof comment === 'string' ? comment.trim().slice(0, 1000) : ''
    });

    // Basic analytics: counts per kind for this message
    const countsAgg = await Feedback.aggregate([
      { $match: { messageId: saved.messageId } },
      { $group: { _id: '$kind', count: { $sum: 1 } } }
    ]);
    const counts = countsAgg.reduce((acc, cur) => { acc[cur._id] = cur.count; return acc; }, { hallucination: 0, good: 0, bad: 0 });

    // Log feedback submission
    logFeedbackSubmission({
      requestId,
      userId: req.user.userId,
      conversationId,
      messageId,
      feedbackType: kind,
      success: true
    });

    return res.json({ success: true, data: { _id: saved._id, counts } });
  } catch (error) {
    console.error('Feedback submission error:', error);
    logFeedbackSubmission({
      requestId,
      userId: req.user?.userId,
      conversationId: req.body?.conversationId,
      messageId: req.body?.messageId,
      feedbackType: req.body?.kind,
      success: false
    });
    logError({
      requestId,
      userId: req.user?.userId,
      operation: 'feedback_submission',
      error,
      context: { conversationId: req.body?.conversationId, messageId: req.body?.messageId, kind: req.body?.kind }
    });
    return res.status(500).json({ success: false, message: 'Failed to submit feedback', error: process.env.NODE_ENV === 'development' ? error.message : {} });
  }
};

module.exports = {
  chatWithAI,
  getStudyHelp,
  generateStudyPlan,
  submitFeedback,
  askQuestion
};
