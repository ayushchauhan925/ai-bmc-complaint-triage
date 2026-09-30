// Language-agnostic lexical similarity (works for Latin and Devanagari text alike). Used as
// a cheap, deterministic complement to embedding similarity - and as the only signal when
// embeddings are unavailable (e.g. OpenAI outage).

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of', 'to', 'and', 'or', 'for',
  'near', 'this', 'that', 'it', 'has', 'have', 'been', 'there', 'with', 'from', 'by', 'very',
  'please', 'kindly', 'sir', 'madam', 'hai', 'hain', 'ka', 'ki', 'ke', 'me', 'mein', 'ko', 'se',
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function trigrams(tokens) {
  const grams = new Set();
  for (const t of tokens) {
    const padded = ` ${t} `;
    for (let i = 0; i <= padded.length - 3; i += 1) grams.add(padded.slice(i, i + 3));
  }
  return grams;
}

function dice(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return (2 * inter) / (a.size + b.size);
}

/**
 * 0..1 similarity: average of word-set Jaccard (shared vocabulary) and character-trigram
 * Dice (tolerant of spelling variants such as "pothole"/"pot hole"/"potholes").
 */
function textSimilarity(a, b) {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const word = jaccard(new Set(ta), new Set(tb));
  const tri = dice(trigrams(ta), trigrams(tb));
  return (word + tri) / 2;
}

module.exports = { textSimilarity, tokenize };
