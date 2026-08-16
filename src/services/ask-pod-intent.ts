export type AskPodIntent = 'conflict_status' | 'expertise' | 'profile' | 'general';

const CONFLICT_PATTERN = /\b(?:conflicts?|conflicting|contradictions?|contradict(?:s|ed|ing|ory)?)\b/i;
const EXPERTISE_PATTERN = /\b(?:who\s+(?:knows|worked|owns|understands|can\s+help)|experts?|expertise|best\s+person)\b/i;
const PROFILE_PATTERN = /\b(?:what\s+(?:should|do)\s+(?:i|you)\s+call\s+(?:me|you|the\s+owner)|preferred\s+name|my\s+(?:preferences?|timezone|identity|profile)|what\s+do\s+you\s+know\s+about\s+me)\b/i;

/** Route narrow question classes before broad evidence retrieval. */
export function classifyAskPodIntent(query: string): AskPodIntent {
  if (CONFLICT_PATTERN.test(query)) return 'conflict_status';
  if (EXPERTISE_PATTERN.test(query)) return 'expertise';
  if (PROFILE_PATTERN.test(query)) return 'profile';
  return 'general';
}
