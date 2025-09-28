// Lightweight guardrails verifier for citation support
// Checks whether answer sentences are supported by cited sources in the provided context

const aiConfig = require('../config/ai');

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitIntoSentences(text) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const parts = raw
    .replace(/\n+/g, ' ')
    .split(/(?<=[\.!\?])\s+/);
  return parts
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(s => s.endsWith('.') || s.endsWith('!') || s.endsWith('?') ? s : s + '.');
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','if','then','else','for','to','of','in','on','at','by','with','as','is','are','was','were','be','been','being','it','this','that','these','those','from','into','about','over','after','before','under','above','between','so','such','than','too','very','can','could','should','would','may','might','do','does','did','done','have','has','had','will','just','not','no','yes','you','your','yours','we','our','ours','they','them','their','theirs','he','him','his','she','her','hers','i','me','my','mine'
]);

function tokenize(text) {
  const norm = normalizeText(text);
  return norm
    .split(' ')
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

function overlapScore(sentence, sourceText) {
  const sTokens = tokenize(sentence);
  if (sTokens.length === 0) return 0;
  const srcTokens = new Set(tokenize(sourceText));
  let overlap = 0;
  for (const t of sTokens) {
    if (srcTokens.has(t)) overlap += 1;
  }
  return overlap / Math.max(1, sTokens.length);
}

function buildLookups(context) {
  const lookups = {
    pdf: new Map(),
    chat: new Map(),
    profile: new Map()
  };

  const docChunks = Array.isArray(context?.docChunks) ? context.docChunks : [];
  for (const c of docChunks) {
    if (c && (c._id || c.id)) {
      lookups.pdf.set(String(c._id || c.id), String(c.text || ''));
    }
  }

  const pastMessages = Array.isArray(context?.pastMessages) ? context.pastMessages : [];
  const lastTurns = Array.isArray(context?.lastTurns) ? context.lastTurns : [];
  for (const m of [...pastMessages, ...lastTurns]) {
    if (m && (m._id || m.id)) {
      lookups.chat.set(String(m._id || m.id), String(m.content || ''));
    }
  }

  const memories = Array.isArray(context?.memories) ? context.memories : [];
  for (const mem of memories) {
    if (mem && (mem._id || mem.id)) {
      lookups.profile.set(String(mem._id || mem.id), String(mem.content || ''));
    }
  }

  return lookups;
}

async function verifySupport(answerJson, context, options = {}) {
  const cfg = {
    minOverlapRatio: typeof options.minOverlapRatio === 'number' ? options.minOverlapRatio : aiConfig.MIN_SUPPORT_SCORE,
    minOverlapCount: typeof options.minOverlapCount === 'number' ? options.minOverlapCount : 3,
    maxReasons: typeof options.maxReasons === 'number' ? options.maxReasons : 6
  };

  const json = answerJson && typeof answerJson === 'object' ? { ...answerJson } : { answer: '', citations: [], uncertainty: { isUncertain: true, reasons: ['Invalid answer JSON'] } };
  if (!json.uncertainty || typeof json.uncertainty !== 'object') {
    json.uncertainty = { isUncertain: false, reasons: [] };
  }
  if (!Array.isArray(json.citations)) json.citations = [];

  const lookups = buildLookups(context || {});
  const sentences = splitIntoSentences(json.answer || '');

  const citationTexts = [];
  const citationIssues = [];
  for (const c of json.citations) {
    if (!c || typeof c !== 'object') continue;
    const type = c.type;
    const id = String(c.id || '');
    let src = '';
    if (type === 'pdf') src = lookups.pdf.get(id) || '';
    else if (type === 'chat') src = lookups.chat.get(id) || '';
    else if (type === 'profile') src = lookups.profile.get(id) || '';

    if (src) {
      citationTexts.push({ type, id, text: src, quote: c.quote });
      if (c.quote && !normalizeText(src).includes(normalizeText(c.quote))) {
        citationIssues.push(`Citation quote not found for ${type}:${id}`);
      }
    } else {
      citationIssues.push(`Citation source missing for ${type}:${id}`);
    }
  }

  const unsupportedClaims = [];
  for (const sent of sentences) {
    let supported = false;
    for (const ct of citationTexts) {
      const ratio = overlapScore(sent, ct.text);
      const countOverlap = Math.round(ratio * tokenize(sent).length);
      if (ratio >= cfg.minOverlapRatio || countOverlap >= cfg.minOverlapCount) {
        supported = true;
        break;
      }
      if (ct.quote && normalizeText(sent).includes(normalizeText(ct.quote))) {
        supported = true;
        break;
      }
    }
    if (!supported) {
      unsupportedClaims.push(sent);
    }
  }

  const reasons = [];
  if (json.citations.length === 0) {
    reasons.push('Answer has no citations; claims are not grounded.');
  }
  for (const u of unsupportedClaims) {
    reasons.push(`Unsupported claim: "${u.slice(0, 160)}"`);
  }
  for (const issue of citationIssues) {
    reasons.push(issue);
  }

  if (reasons.length > 0) {
    json.uncertainty.isUncertain = true;
    const prior = Array.isArray(json.uncertainty.reasons) ? json.uncertainty.reasons : [];
    json.uncertainty.reasons = [...prior, ...reasons].slice(0, cfg.maxReasons);
  }

  return {
    ok: reasons.length === 0,
    json,
    unsupportedClaims,
    reasons,
    checkedCitations: citationTexts.length
  };
}

module.exports = {
  verifySupport
};


