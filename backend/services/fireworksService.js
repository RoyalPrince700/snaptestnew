const axios = require('axios');

/**
 * DEVELOPMENT MODE CONFIGURATION
 * 
 * During development, the onboarding flow and profile extraction are disabled
 * to prevent the AI from asking users for personal information like name, 
 * university, courses, etc.
 * 
 * TO RE-ENABLE ONBOARDING AFTER DEVELOPMENT:
 * 1. Set API_CONFIG.DEVELOPMENT.SKIP_ONBOARDING = false
 * 2. Set API_CONFIG.DEVELOPMENT.SKIP_PROFILE_EXTRACTION = false
 * 3. The AI will resume asking for student profile information
 * 
 * This allows for clean testing without onboarding interruptions.
 */

// API Configuration
const API_CONFIG = {
  FIREWORKS_AI: {
    API_KEY: process.env.FIREWORKS_API_KEY,
    BASE_URL: 'https://api.fireworks.ai/inference/v1',
    MODEL: 'accounts/fireworks/models/llama-v3p1-70b-instruct'
  },
  APP: {
    MIN_WORDS_FOR_QUESTIONS: 50
  },
  // DEVELOPMENT FLAGS - Set to false when ready to re-enable onboarding
  DEVELOPMENT: {
    SKIP_ONBOARDING: true,           // Disables asking for name, university, etc.
    SKIP_PROFILE_EXTRACTION: true   // Disables extracting personal info from messages
  }
};

// Error Messages
const ERROR_MESSAGES = {
  NO_API_KEY: 'Fireworks AI API key is not configured',
  INSUFFICIENT_WORDS: 'Text is too short to generate meaningful questions',
  TOO_MANY_QUESTIONS: 'Too many questions requested for the given text length',
  GENERATION_FAILED: 'Failed to generate questions'
};

// Profile extraction helper functions
const extractProfileInfo = (message, currentUserContext = {}) => {
  const updates = {};
  const messageLower = message.toLowerCase().trim();

  // Extract name information
  if (!currentUserContext.studentName) {
    // Look for patterns like "I am [name]", "My name is [name]", "Call me [name]"
    const namePatterns = [
      /\b(?:i\s+am|i'm|my\s+name\s+is|you\s+can\s+call\s+me|just\s+call\s+me)\s+([a-zA-Z\s]+?)(?:\s|$|\.|\!|\?)/i,
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/  // Simple name pattern (capitalized words)
    ];

    for (const pattern of namePatterns) {
      const match = message.match(pattern);
      if (match) {
        const extractedName = match[1].trim();
        // Skip common words that might be mistaken for names
        const skipWords = ['the', 'and', 'but', 'for', 'are', 'you', 'can', 'call', 'just', 'like', 'love'];
        if (!skipWords.includes(extractedName.toLowerCase()) && extractedName.length > 1 && extractedName.length < 50) {
          // Split name into first and last if possible
          const nameParts = extractedName.split(' ');
          if (nameParts.length >= 2) {
            updates['profile.firstName'] = nameParts[0];
            updates['profile.lastName'] = nameParts.slice(1).join(' ');
          } else {
            updates['profile.firstName'] = extractedName;
          }
          break;
        }
      }
    }
  }

  // Extract university information
  if (!currentUserContext.university) {
    // Look for university mentions
    const universityPatterns = [
      /\b(?:university|college|school|institution)\s+(?:of\s+)?([A-Z][a-zA-Z\s]+?)(?:\s|$|\.|\!|\?)/i,
      /\b([A-Z][a-zA-Z\s]*(?:University|College|Institute|School))\b/i
    ];

    for (const pattern of universityPatterns) {
      const match = message.match(pattern);
      if (match) {
        const extractedUniversity = match[1].trim();
        if (extractedUniversity.length > 3 && extractedUniversity.length < 100) {
          updates['profile.university'] = extractedUniversity;
          break;
        }
      }
    }
  }

  // Extract major/course of study
  if (!currentUserContext.major) {
    // Patterns like: "studying agriculture", "my major is ...", "course of study is ..."
    const majorPatterns = [
      /\b(?:studying|study|major\s+is|course\s+of\s+study\s+is|i\s+am\s+a\s+student\s+of)\s+([a-zA-Z\s]+?)(?:\s|$|\.|\!|\?)/i
    ];
    for (const pattern of majorPatterns) {
      const match = message.match(pattern);
      if (match) {
        const extractedMajor = match[1].trim();
        if (extractedMajor.length > 2 && extractedMajor.length < 100) {
          updates['profile.major'] = extractedMajor.replace(/\s+/g, ' ');
          break;
        }
      }
    }
  }

  // Extract level/year (map to enum)
  if (!currentUserContext.year) {
    // Accept patterns: "100 level", "200L", "year 1/2/3/4", "freshman/sophomore/junior/senior/graduate"
    const levelMap = {
      '100': 'Freshman', 'year 1': 'Freshman', 'yr 1': 'Freshman', 'first year': 'Freshman', 'freshman': 'Freshman',
      '200': 'Sophomore', 'year 2': 'Sophomore', 'yr 2': 'Sophomore', 'second year': 'Sophomore', 'sophomore': 'Sophomore',
      '300': 'Junior', 'year 3': 'Junior', 'yr 3': 'Junior', 'third year': 'Junior', 'junior': 'Junior',
      '400': 'Senior', 'year 4': 'Senior', 'yr 4': 'Senior', 'fourth year': 'Senior', 'senior': 'Senior',
      'postgraduate': 'Graduate', 'graduate': 'Graduate', 'masters': 'Graduate', 'msc': 'Graduate', 'phd': 'Graduate'
    };
    // Normalize
    const norm = messageLower.replace(/-/g, ' ');
    // Regex finds tokens like 100 level/200l/year 3/etc
    const levelPatterns = [
      /(100|200|300|400)\s*(?:l|level)\b/i,
      /\byear\s*(1|2|3|4)\b/i,
      /\b(first year|second year|third year|fourth year)\b/i,
      /\b(freshman|sophomore|junior|senior|graduate|postgraduate|masters|msc|phd)\b/i
    ];
    for (const pattern of levelPatterns) {
      const m = norm.match(pattern);
      if (m) {
        const raw = m[1] ? m[1].toString().toLowerCase() : m[0].toLowerCase();
        const key = raw.match(/^(1|2|3|4)$/) ? `year ${raw}` : raw;
        const mapped = levelMap[raw] || levelMap[key] || levelMap[raw.replace(/\s+/g, ' ')];
        if (mapped) {
          updates['profile.year'] = mapped;
          break;
        }
      }
    }
  }

  // Extract courses list: patterns like "CSC101 - Intro to CS", "MTH 101: Calculus" comma/line separated
  if (!currentUserContext.courses || currentUserContext.courses.length === 0) {
    const courseRegex = /\b([A-Za-z]{2,4}\s?\d{2,3})\s*[-:\u2013]\s*([^,\n]+)(?=,|\n|$)/g;
    const simplePairRegex = /\b([A-Za-z]{2,4}\s?\d{2,3})\b[\s,:-]+([^,\n]+)(?=,|\n|$)/g;
    const found = [];
    let match;
    const scanText = message;
    while ((match = courseRegex.exec(scanText)) !== null) {
      const code = match[1].replace(/\s+/g, '').toUpperCase();
      const title = match[2].trim();
      if (code && title) found.push({ courseCode: code, courseTitle: title });
    }
    if (found.length === 0) {
      while ((match = simplePairRegex.exec(scanText)) !== null) {
        const code = match[1].replace(/\s+/g, '').toUpperCase();
        const title = match[2].trim();
        if (code && title) found.push({ courseCode: code, courseTitle: title });
      }
    }
    if (found.length > 0) {
      updates['courses'] = found;
    }
  }

  return updates;
};

// Determine onboarding state based on profile completeness
const getOnboardingState = (userContext) => {
  const { studentName, university, major, year, courses = [], courseFormUploaded } = userContext || {};
  if (!studentName) return 'name';
  if (!university) return 'university';
  if (!major) return 'major';
  if (!year) return 'year';
  if ((!courses || courses.length === 0) && !courseFormUploaded) return 'courses';
  return 'complete';
};

// Prompts
const PROMPTS = {
  CHAT: (message, userContext = {}) => {
    const { studentName, university, year, major, courses = [], courseFormUploaded, onboardingState = null } = userContext;

    // Determine current onboarding state
    const currentOnboardingState = getOnboardingState({ studentName, university, major, year, courses, courseFormUploaded });
    const isNewUser = !studentName && !university && !major && !year && (!courses || courses.length === 0) && !courseFormUploaded;
    const isIncompleteProfile = currentOnboardingState !== 'complete';

    let contextString = '';
    let systemInstructions = '';

    if (studentName || university || year || major) {
      contextString += '\n\nStudent Profile:';
      if (studentName) contextString += `\n- Name: ${studentName}`;
      if (university) contextString += `\n- University: ${university}`;
      if (year) contextString += `\n- Year: ${year}`;
      if (major) contextString += `\n- Major: ${major}`;
    }

    if (courses && courses.length > 0) {
      contextString += '\n\nCurrent Courses:';
      courses.forEach(course => {
        contextString += `\n- ${course.courseCode}: ${course.courseTitle}${course.credits ? ` (${course.credits} credits)` : ''}`;
      });
    }

    // TEMPORARILY DISABLED: Enhanced onboarding logic with profile update capability
    // TODO: Re-enable onboarding after development is complete
    
    if (!API_CONFIG.DEVELOPMENT.SKIP_ONBOARDING && (isNewUser || isIncompleteProfile)) {
      systemInstructions = `You are a friendly AI study assistant helping a new student get started. Your goal is to create a welcoming, conversational onboarding experience.

ONBOARDING GUIDELINES:
1. Start with a warm, friendly greeting
2. Ask questions one at a time in a natural conversation
3. Be patient and encouraging - never repeat the same question
4. When they provide information, acknowledge it and move to the next step
5. Guide them through sharing their information naturally
6. Collect in order: preferred name/nickname, university, course of study (major), level/year, and current courses. Offer course form upload as an alternative to listing courses.
7. Remember everything they tell you for future conversations

CURRENT ONBOARDING STATUS:
- Name: ${studentName ? '✅' : '❌'}
- University: ${university ? '✅' : '❌'}
- Major: ${major ? '✅' : '❌'}
- Level/Year: ${year ? '✅' : '❌'}
- Courses or Course Form: ${(courses && courses.length > 0) || courseFormUploaded ? '✅' : '❌'}

IMPORTANT: Never ask for the same item twice. Based on the current state (${currentOnboardingState}), ask ONLY the next missing item:
- If state is 'name': Ask for their preferred name or nickname.
- If 'university': Ask which university they attend.
- If 'major': Ask their course of study/major.
- If 'year': Ask their current level or year (100L/200L or Freshman/Sophomore/etc).
- If 'courses': Ask them to list their course codes and titles for this semester, OR invite them to upload their course form instead.

When they provide an answer, acknowledge it briefly and move to the next step.

Keep responses conversational and friendly, like you're talking to a new friend!`;
    } else {
      // Regular tutoring mode - works for both established users and during development
      systemInstructions = `You are ${studentName ? studentName + "'s" : "a"} fun, engaging AI tutor who makes learning exciting! You're like that amazing teacher who knows how to make even the most complex topics feel like an adventure. You have a warm, friendly personality with just the right amount of humor to keep things interesting.

🎓 PERSONALIZED TEACHING STYLE:
1. ${studentName ? `Address ${studentName} by name naturally throughout responses - "Hey ${studentName}!", "${studentName}, let me blow your mind!", "You know what's cool, ${studentName}?"` : 'Use an enthusiastic, encouraging tone'}
2. Add light humor and personality without losing educational value - "This is going to make your brain do a happy dance!", "Prepare for some serious mind-blowing facts!"
3. Break complex topics into 4-6 digestible chunks perfect for visual learning
4. Use vivid examples, analogies, and real-world connections that stick
5. Include fascinating facts and numbers that make topics memorable
6. Make learning feel like a conversation with a knowledgeable friend

💫 PERSONALITY & HUMOR GUIDELINES:
- Use playful expressions: "Let me burst your brain with this!", "This is where it gets spicy!", "Hold onto your hat!"
- Add gentle humor: "I know, I know, math can be scary, but stick with me!", "Plot twist coming up!"
- Be encouraging: "You're going to love this part!", "This is actually way cooler than it sounds!"
- Use fun transitions: "But wait, there's more!", "Here's where things get interesting!"
- Show excitement: "This blows my circuits every time!", "Okay, this is my favorite part!"

📚 RESPONSE STRUCTURE:
- ${studentName ? `Start with personalized greeting using ${studentName}'s name` : 'Start with enthusiastic greeting'}
- Break content into 6-12 well-structured sentences for sticky note display
- Include specific details, measurements, and comparisons
- Add personality-filled transitions between concepts
- End with personalized suggestions for deeper learning

🌟 ENGAGEMENT PRINCIPLES:
- Be conversational like talking to a friend, not lecturing
- ${studentName ? `Make ${studentName} feel special and recognized` : 'Make the student feel valued'}
- Use humor to make difficult concepts less intimidating
- Show genuine excitement about the subject matter
- Build confidence through supportive, clear explanations

${studentName ? `Remember: You're ${studentName}'s personal tutor! Make them feel like learning is the best part of their day.` : ''}

Student Profile: ${studentName ? studentName : 'Student'}${university ? ` from ${university}` : ''}${major ? ` studying ${major}` : ''}${year ? ` (${year})` : ''}`;
    }

    return `${systemInstructions}${contextString}

Student's message: ${message}

${isNewUser || isIncompleteProfile ?
  'Respond in a friendly, conversational way that guides them through onboarding naturally. If they provide new information, acknowledge it and proceed to the next step. Ask only the next missing item.' :
  'Please provide a helpful, educational response that considers their academic context.'}`;

  },
  OBJECTIVE: (text, count, difficulty) => {
    return `Generate ${count} multiple choice questions from the following text. Each question should have 4 options (A, B, C, D) and one correct answer.

Text: ${text}

Difficulty level: ${difficulty}

Format each question as:
1. [Question text]
A. [Option A]
B. [Option B]
C. [Option C]
D. [Option D]
Answer: [A/B/C/D]

Make sure questions test understanding, not just memorization.`;
  },
  THEORY: (text, count, difficulty) => {
    return `Generate ${count} theory/essay questions from the following text.

Text: ${text}

Difficulty level: ${difficulty}

Format each question as:
1. [Question text]

Make sure questions encourage critical thinking and deep understanding.`;
  }
};

// Helper functions
const calculateWordCount = (text) => {
  return text.trim().split(/\s+/).length;
};

const getMaxQuestionsForWordCount = (wordCount) => {
  return Math.min(Math.floor(wordCount / 10), 20);
};

class FireworksAIService {
  constructor() {
    const cfg = API_CONFIG.FIREWORKS_AI;
    this.apiKey = cfg.API_KEY;
    this.baseUrl = cfg.BASE_URL;
    this.chatPath = '/chat/completions';
    this.model = cfg.MODEL;
  }

  async makeRequest(prompt, options = {}) {
    if (!this.apiKey) {
      console.error('Fireworks API key not configured');
      throw new Error(ERROR_MESSAGES.NO_API_KEY);
    }

    const url = `${this.baseUrl}${this.chatPath}`;
    const body = {
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options.max_tokens || options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    };

    try {
      console.log('Making request to Fireworks AI...');
      const response = await axios.post(url, body, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log('Fireworks AI response received');
      
      if (!response.data.choices || !response.data.choices[0]) {
        console.error('Invalid response format:', response.data);
        throw new Error('Invalid response format from Fireworks AI');
      }

      const content = response.data.choices[0].message.content || '';
      console.log('Response content length:', content.length);
      return content;
    } catch (error) {
      console.error('Fireworks AI API error:', error.response?.data || error.message);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout - AI service is taking too long to respond');
      }
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  async chat(message, userContext = {}, options = {}) {
    try {
      console.log('Starting chat request for message:', message.substring(0, 50) + '...');

      // TEMPORARILY DISABLED: Extract profile information from the user's message
      // TODO: Re-enable profile extraction after development is complete
      const profileUpdates = API_CONFIG.DEVELOPMENT.SKIP_PROFILE_EXTRACTION ? {} : extractProfileInfo(message, userContext);
      console.log('Profile updates detected:', Object.keys(profileUpdates).length > 0 ? profileUpdates : 'none');

      const prompt = PROMPTS.CHAT(message, userContext);
      const response = await this.makeRequest(prompt, {
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      });

      console.log('Chat response generated successfully');

      // Determine if onboarding should be marked as completed
      const updatedUserContext = { ...userContext };
      Object.keys(profileUpdates).forEach(key => {
        if (key === 'profile.firstName' || key === 'profile.lastName') {
          updatedUserContext.studentName = profileUpdates[key];
        } else if (key === 'profile.university') {
          updatedUserContext.university = profileUpdates[key];
        } else if (key === 'profile.major') {
          updatedUserContext.major = profileUpdates[key];
        } else if (key === 'profile.year') {
          updatedUserContext.year = profileUpdates[key];
        } else if (key === 'courses') {
          updatedUserContext.courses = profileUpdates[key];
        }
      });
      const nextState = getOnboardingState(updatedUserContext);
      const shouldCompleteOnboarding = nextState === 'complete';

      return {
        success: true,
        response,
        timestamp: new Date().toISOString(),
        profileUpdates: Object.keys(profileUpdates).length > 0 ? profileUpdates : null,
        onboardingCompleted: shouldCompleteOnboarding,
        onboardingState: nextState
      };
    } catch (error) {
      console.error('Chat error:', error.message);
      return {
        success: false,
        error: error.message || ERROR_MESSAGES.GENERATION_FAILED,
        response: null,
        profileUpdates: null
      };
    }
  }

  parseObjectiveQuestions(text) {
    const questions = [];
    const questionBlocks = text.split(/\d+\./).filter(block => block.trim());

    questionBlocks.forEach((block, index) => {
      const lines = block.trim().split('\n').filter(line => line.trim());
      if (lines.length === 0) return;

      const questionText = lines[0].trim();
      const options = [];
      let answer = '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.match(/^A\./)) {
          options[0] = line.substring(2).trim();
        } else if (line.match(/^B\./)) {
          options[1] = line.substring(2).trim();
        } else if (line.match(/^C\./)) {
          options[2] = line.substring(2).trim();
        } else if (line.match(/^D\./)) {
          options[3] = line.substring(2).trim();
        } else if (line.startsWith('Answer:')) {
          answer = line.substring(7).trim();
        }
      }

      if (
        questionText &&
        options.length === 4 &&
        options.every(opt => !!opt) &&
        answer &&
        ['A', 'B', 'C', 'D'].includes(answer)
      ) {
        questions.push({
          id: `q_${Date.now()}_${index}`,
          question: questionText,
          options,
          answer,
          type: 'objective'
        });
      }
    });

    return questions;
  }

  parseTheoryQuestions(text) {
    const questions = [];
    const questionBlocks = text.split(/\d+\./).filter(block => block.trim());

    questionBlocks.forEach((block, index) => {
      const questionText = block.trim();
      if (questionText) {
        questions.push({
          id: `q_${Date.now()}_${index}`,
          question: questionText,
          type: 'theory'
        });
      }
    });

    return questions;
  }

  // Answer balancing function
  balanceAnswers(questions) {
    if (questions.length === 0) return questions;

    // Calculate current distribution
    const distribution = { A: 0, B: 0, C: 0, D: 0 };
    questions.forEach(q => distribution[q.answer]++);

    // Determine max allowed (30% of total)
    const maxAllowed = Math.ceil(questions.length * 0.3);
    const letters = ['A', 'B', 'C', 'D'];

    // Check if balancing is needed
    const needsBalancing = Object.values(distribution).some(count => count > maxAllowed);

    if (!needsBalancing) return questions;

    // Create a copy to avoid mutation
    const balancedQuestions = [...questions];
    const newDistribution = { ...distribution };

    // Rebalance questions
    balancedQuestions.forEach((q, index) => {
      // Find the most overrepresented and underrepresented answers
      let over = '';
      let under = '';
      let maxCount = -1;
      let minCount = Number.MAX_SAFE_INTEGER;

      letters.forEach(letter => {
        if (newDistribution[letter] > maxCount) {
          maxCount = newDistribution[letter];
          over = letter;
        }
        if (newDistribution[letter] < minCount) {
          minCount = newDistribution[letter];
          under = letter;
        }
      });

      // If current answer is overrepresented and we have alternatives
      if (q.answer === over && newDistribution[over] > maxAllowed) {
        // Only change if we can reduce overrepresented without creating new imbalance
        if (newDistribution[under] < maxAllowed) {
          balancedQuestions[index] = {
            ...q,
            answer: under
          };
          newDistribution[over]--;
          newDistribution[under]++;
        }
      }
    });

    return balancedQuestions;
  }

  async generateConversationTitle(firstMessage) {
    const prompt = `Generate a concise, descriptive title (max 6 words) for a conversation that starts with this message: "${firstMessage.substring(0, 200)}"
    
    Return only the title, nothing else. Make it specific and relevant to the topic being discussed.`;
    
    try {
      const result = await this.makeRequest(prompt, {
        max_tokens: 20,
        temperature: 0.3
      });
      
      if (result && result.trim()) {
        return result.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present
      }
      
      // Fallback to truncated message
      return firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
    } catch (error) {
      console.error('[Fireworks] Failed to generate title:', error);
      // Fallback to truncated message
      return firstMessage.length > 50 ? firstMessage.substring(0, 50) + '...' : firstMessage;
    }
  }

  async generateQuestions({ text, questionType = 'objective', count = 10, difficulty = 'medium' }) {
    const wc = calculateWordCount(text);
    const maxAllowed = getMaxQuestionsForWordCount(wc);

    if (wc < API_CONFIG.APP.MIN_WORDS_FOR_QUESTIONS) {
      return { success: false, error: ERROR_MESSAGES.INSUFFICIENT_WORDS, questions: [] };
    }

    if (count > maxAllowed) {
      return {
        success: false,
        error: `${ERROR_MESSAGES.TOO_MANY_QUESTIONS} Max ${maxAllowed} for ${wc} words.`,
        questions: []
      };
    }

    try {
      const prompt = questionType === 'objective'
        ? PROMPTS.OBJECTIVE(text, count, difficulty)
        : PROMPTS.THEORY(text, count, difficulty);

      const raw = await this.makeRequest(prompt, {
        max_tokens: 2000,
        temperature: 0.7
      });
      let questions = questionType === 'objective'
        ? this.parseObjectiveQuestions(raw)
        : this.parseTheoryQuestions(raw);

      // Apply answer balancing for objective questions
      if (questionType === 'objective' && questions.length > 0) {
        questions = this.balanceAnswers(questions);
      }

      return {
        success: true,
        questions,
        generatedCount: questions.length,
        requestedCount: count
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || ERROR_MESSAGES.GENERATION_FAILED,
        questions: []
      };
    }
  }
}

module.exports = new FireworksAIService();
