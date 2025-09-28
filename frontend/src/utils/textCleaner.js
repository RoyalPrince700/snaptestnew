// Utility functions to clean AI response text from excess special characters

/**
 * Clean AI response text by removing excess special characters and formatting artifacts
 * @param {string} text - The raw AI response text
 * @returns {string} - Cleaned text
 */
export const cleanAIResponse = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // Remove JSON artifacts and markdown code fences
  cleaned = cleaned.replace(/```json\s*/gi, '');
  cleaned = cleaned.replace(/```\s*/g, '');
  cleaned = cleaned.replace(/^\s*{\s*"answer":\s*"/gi, '');
  cleaned = cleaned.replace(/"\s*}\s*$/gi, '');
  
  // Remove excess backslashes (common in JSON escaping)
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\\\/g, '\\');
  
  // Remove excess special characters at the beginning/end
  cleaned = cleaned.replace(/^[*#`\-_=+~\[\]{}()]+\s*/g, '');
  cleaned = cleaned.replace(/\s*[*#`\-_=+~\[\]{}()]+$/g, '');
  
  // Clean up multiple consecutive special characters (but preserve emojis and intentional formatting)
  cleaned = cleaned.replace(/([*#`\-_=+~])\1{3,}/g, '$1$1'); // Reduce 4+ consecutive to 2
  
  // Remove excess whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
  cleaned = cleaned.replace(/[ \t]{3,}/g, '  '); // Max 2 consecutive spaces
  
  // Remove leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
};

/**
 * Clean text specifically for emoji processing - removes malformed emoji sequences
 * @param {string} text - Text that may contain malformed emojis
 * @returns {string} - Text with cleaned emoji sequences
 */
export const cleanEmojiSequences = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = text;
  
  // Remove malformed emoji sequences like :emoji_name: that didn't convert
  cleaned = cleaned.replace(/:[\w_]+:/g, '');
  
  // Remove Unicode escape sequences that didn't render properly
  cleaned = cleaned.replace(/\\u[\da-fA-F]{4}/g, '');
  
  // Remove excessive emoji repetition (more than 3 of the same emoji in a row)
  cleaned = cleaned.replace(/([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])\1{3,}/gu, '$1$1$1');
  
  return cleaned;
};

/**
 * Clean text for display in sticky notes (shorter, more concise)
 * @param {string} text - Text to clean for sticky note display
 * @returns {string} - Cleaned text suitable for sticky notes
 */
export const cleanForStickyNote = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let cleaned = cleanAIResponse(text);
  
  // Remove citations and references that are too verbose for sticky notes
  cleaned = cleaned.replace(/\(.*?\)/g, ''); // Remove parenthetical citations
  cleaned = cleaned.replace(/\[.*?\]/g, ''); // Remove bracketed references
  
  // Simplify complex punctuation
  cleaned = cleaned.replace(/[.]{2,}/g, '...'); // Multiple periods to ellipsis
  cleaned = cleaned.replace(/[!]{2,}/g, '!'); // Multiple exclamations to single
  cleaned = cleaned.replace(/[?]{2,}/g, '?'); // Multiple questions to single
  
  // Remove excess formatting for sticky notes
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markdown
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1'); // Remove italic markdown
  
  return cleaned.trim();
};

/**
 * Extract and clean fun facts from text
 * @param {string} text - Text to extract fun facts from
 * @returns {Array<string>} - Array of cleaned fun facts
 */
export const extractCleanFunFacts = (text) => {
  if (!text || typeof text !== 'string') return [];
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  const funFacts = sentences.filter(sentence => {
    const s = sentence.trim();
    return s.length > 20 && (
      /\d+/.test(s) || // contains numbers
      /(largest|smallest|biggest|oldest|youngest|fastest|slowest|hottest|coldest|most|least)/i.test(s) || // superlatives
      /(amazing|incredible|fascinating|remarkable|interesting|fun fact|did you know)/i.test(s) // exciting words
    );
  }).slice(0, 2); // max 2 fun facts
  
  return funFacts.map(fact => cleanForStickyNote(fact));
};

export default {
  cleanAIResponse,
  cleanEmojiSequences,
  cleanForStickyNote,
  extractCleanFunFacts
};
