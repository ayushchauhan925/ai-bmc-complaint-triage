/**
 * A quick, transparent completeness check for a draft complaint. It is NOT an AI judgement and
 * never blocks submission - it only points out details that help crews find and fix the issue.
 * Kept deliberately simple so the citizen can see exactly why a suggestion appears.
 */

export type QualityLevel = 'LOW' | 'FAIR' | 'GOOD' | 'GREAT';

export interface QualityInput {
  description: string;
  address: string;
  hasLocation: boolean;
  photoCount: number;
}

export interface QualityResult {
  level: QualityLevel;
  score: number; // 0-100
  /** Translation keys (quality.s.*), resolved by the UI so hints can appear in any language. */
  suggestions: string[];
}

// Words that show the writer said *how bad / how long / who is affected* (English + common Hinglish/Hindi/Marathi).
const IMPACT = /\b(days?|weeks?|months?|since|daily|every|night|morning|school|hospital|children|kids|elderly|traffic|accident|danger|dangerous|blocked|overflow\w*|smell|stink\w*|flood\w*|leak\w*|broken|not working|no water|din|hafte|mahine|bachche|khatra|badbu|gaadi)\b|दिन|हफ्ते|महीने|बच्चे|खतरा|दुर्गंध|अपघात|धोका|दिवस|आठवडे/i;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function assessQuality({ description, address, hasLocation, photoCount }: QualityInput): QualityResult {
  const n = words(description);
  let score = 0;
  const suggestions: string[] = [];

  // Description detail (40)
  if (n >= 20) score += 40;
  else if (n >= 10) score += 28;
  else if (n >= 5) score += 15;
  else if (n > 0) score += 6;
  if (n > 0 && n < 10) suggestions.push('quality.s.detail');

  // Impact / duration (15)
  if (IMPACT.test(description)) score += 15;
  else if (n >= 5) suggestions.push('quality.s.impact');

  // Location (25): pin is required to submit, a typed landmark makes it far easier to find
  if (hasLocation) score += 15;
  else suggestions.push('quality.s.pin');
  if (address.trim().length >= 6) score += 10;
  else if (hasLocation) suggestions.push('quality.s.landmark');

  // Photo (20)
  if (photoCount >= 1) score += 20;
  else suggestions.push('quality.s.photo');

  score = Math.min(100, score);
  const level: QualityLevel = score >= 85 ? 'GREAT' : score >= 65 ? 'GOOD' : score >= 40 ? 'FAIR' : 'LOW';
  return { level, score, suggestions };
}
