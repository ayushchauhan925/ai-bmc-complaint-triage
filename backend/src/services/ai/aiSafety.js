// Guards around the LLM boundary. Complaint text is untrusted user input that is placed
// inside a prompt, and model output is untrusted data that ends up in the database and UI.
// Neither may ever directly control a sensitive operation: the model only proposes signals,
// deterministic services decide (see decisionEngine.service.js).

const MAX_COMPLAINT_CHARS = 2000;

// Phrases typical of prompt-injection attempts. A match never blocks the complaint (a real
// citizen may quote odd text) - it flags the complaint for human review and the text is
// still passed to the model as clearly delimited data.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|your)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your)\s+(above|instructions?|rules?)/i,
  /\byou\s+are\s+now\b/i,
  /\b(system|developer)\s+(prompt|message|instructions?)\b/i,
  /\b(reveal|show|print|leak)\b.{0,40}\b(prompt|instructions?|api[\s_-]?key|secret|password)\b/i,
  /^\s*(system|assistant)\s*:/im,
  /<\|[a-z_]+\|>/i,
  /\bjailbreak\b|\bdeveloper\s+mode\b|\bDAN\s+mode\b/i,
  /\b(set|change|mark|make)\s+(the\s+)?(priority|category|department|severity|sla)\s+(to|as)\b/i,
  /\boverride\b.{0,30}\b(priority|classification|routing|rules?)\b/i,
];

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalises complaint text before it goes into a prompt: removes control characters,
 * neutralises the delimiter the prompt uses so the text cannot "close" its own quoting,
 * bounds the length, and reports suspected injection.
 */
function sanitizeComplaintText(raw) {
  const original = String(raw ?? '');
  let text = original.replace(CONTROL_CHARS, ' ').replace(/"{3,}/g, '"').replace(/`{3,}/g, "'");
  text = text.trim();
  const truncated = text.length > MAX_COMPLAINT_CHARS;
  if (truncated) text = text.slice(0, MAX_COMPLAINT_CHARS);

  const matched = INJECTION_PATTERNS.filter((re) => re.test(original)).map((re) => re.source.slice(0, 40));
  return { text, truncated, injectionSuspected: matched.length > 0, matchedPatterns: matched };
}

/** Cleans a model-produced string before it is stored/displayed: no markup, bounded size. */
function cleanModelText(value, maxLength = 500) {
  if (value === null || value === undefined) return value;
  return String(value)
    .replace(CONTROL_CHARS, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

module.exports = { sanitizeComplaintText, cleanModelText, MAX_COMPLAINT_CHARS, INJECTION_PATTERNS };
