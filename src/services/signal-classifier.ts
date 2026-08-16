/**
 * Signal classifier for high-volume data sources.
 *
 * Assigns a signal tier ('high' | 'medium' | 'low') to incoming items
 * using lightweight rule-based heuristics — no LLM calls.  The tier
 * determines how much content is stored at observe time:
 *
 *   high   — full body stored, LLM summary generated, entities extracted
 *   medium — metadata + first N chars of body, no LLM
 *   low    — metadata only (subject, sender, date), body discarded
 *
 * The classifier is source-agnostic by design: each source maps its raw
 * data into a `ClassifiableItem`, then calls `classifySignal()`.
 */

/* ── Types ── */

export type SignalTier = 'high' | 'medium' | 'low';

export interface ClassifiableItem {
  /** Sender / author identifier (email, username, etc.) */
  sender: string;
  /** Recipients (To, CC, channel members mentioned, etc.) */
  recipients?: string[];
  /** Subject / title */
  subject: string;
  /** Raw body text (may be empty for metadata-only classification) */
  body: string;
  /** Source-specific labels / tags / categories */
  labels?: string[];
  /** Thread depth — how many messages are in this thread */
  threadDepth?: number;
  /** Whether the user has replied to this thread */
  userReplied?: boolean;
  /** Whether the item is addressed directly to the user (To vs CC) */
  directlyAddressed?: boolean;
  /** Source app ('gmail', 'slack', 'github', etc.) */
  source: string;
  /** Optional headers map for email-specific checks */
  headers?: Record<string, string>;
}

export interface ClassificationResult {
  tier: SignalTier;
  /** Which rules fired (for debugging / transparency) */
  rules: string[];
  /** Numeric score (higher = more signal). Range: 0-100 */
  score: number;
}

/* ── Known-contact registry ── */

/**
 * A set of known contact identifiers (emails, usernames) that
 * the user has interacted with. Items from known contacts score higher.
 * This is populated at sync time from the Pod's existing objects.
 */
let knownContacts: Set<string> = new Set();

export function setKnownContacts(contacts: Iterable<string>): void {
  knownContacts = new Set(
    [...contacts].map(c => c.toLowerCase().trim()),
  );
}

export function getKnownContacts(): ReadonlySet<string> {
  return knownContacts;
}

/* ── Rule functions ── */

/** Extract the bare email address from a "Name <email>" string. */
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).toLowerCase().trim();
}

function isNoReply(sender: string): boolean {
  const email = extractEmail(sender);
  return /^(no[-_]?reply|noreply|donotreply|mailer-daemon|postmaster)@/i.test(email);
}

function isNewsletter(headers: Record<string, string>): boolean {
  // RFC 2369: List-Unsubscribe header is a strong newsletter signal
  if (headers['list-unsubscribe']) return true;
  if (headers['list-id']) return true;
  // Bulk precedence header
  if (headers['precedence']?.toLowerCase() === 'bulk') return true;
  return false;
}

function isAutomated(sender: string, headers: Record<string, string>): boolean {
  if (isNoReply(sender)) return true;
  const auto = headers['auto-submitted'] ?? '';
  if (auto && auto !== 'no') return true;
  // GitHub, Jira, Linear, etc. notification patterns
  const email = extractEmail(sender);
  if (/notifications?@|notify@|alert@|digest@/.test(email)) return true;
  return false;
}

function isFromKnownContact(sender: string): boolean {
  const email = extractEmail(sender);
  return knownContacts.has(email);
}

function isMarketingSubject(subject: string): boolean {
  const lower = subject.toLowerCase();
  const patterns = [
    /\bunsubscribe\b/, /\bfree trial\b/, /\b\d+% off\b/,
    /\blimited time\b/, /\bdon'?t miss\b/, /\bspecial offer\b/,
    /\bact now\b/, /\bexclusive\b/, /\bflash sale\b/,
  ];
  return patterns.some(p => p.test(lower));
}

/* ── Gmail-specific rules ── */

function classifyGmail(item: ClassifiableItem): ClassificationResult {
  const rules: string[] = [];
  let score = 50; // start neutral

  const headers = item.headers ?? {};

  // Strong low-signal indicators
  if (isNewsletter(headers))                 { score -= 40; rules.push('newsletter'); }
  if (isAutomated(item.sender, headers))     { score -= 30; rules.push('automated'); }
  if (isMarketingSubject(item.subject))      { score -= 20; rules.push('marketing-subject'); }

  // Strong high-signal indicators
  if (item.userReplied)                      { score += 30; rules.push('user-replied'); }
  if (isFromKnownContact(item.sender))       { score += 25; rules.push('known-contact'); }
  if (item.directlyAddressed)                { score += 15; rules.push('directly-addressed'); }
  if ((item.threadDepth ?? 1) > 2)           { score += 15; rules.push('active-thread'); }

  // Moderate signals
  if (item.labels?.includes('STARRED'))      { score += 20; rules.push('starred'); }
  if (item.labels?.includes('IMPORTANT'))    { score += 10; rules.push('important'); }
  if (item.labels?.includes('INBOX'))        { score += 5;  rules.push('inbox'); }
  if (item.labels?.includes('SPAM'))         { score -= 50; rules.push('spam'); }
  if (item.labels?.includes('TRASH'))        { score -= 50; rules.push('trash'); }

  // Body length heuristic: very short bodies are often notifications
  if (item.body.length < 50)                 { score -= 10; rules.push('very-short-body'); }
  if (item.body.length > 2000)               { score += 5;  rules.push('substantive-body'); }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  const tier: SignalTier = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { tier, rules, score };
}

/* ── Slack-specific rules ── */

function classifySlack(item: ClassifiableItem): ClassificationResult {
  const rules: string[] = [];
  let score = 50;

  if (item.directlyAddressed)                { score += 30; rules.push('mentioned'); }
  if (isFromKnownContact(item.sender))       { score += 15; rules.push('known-contact'); }
  if (item.labels?.includes('dm'))           { score += 25; rules.push('direct-message'); }
  if (item.body.length < 20)                 { score -= 15; rules.push('very-short'); }

  // Bot messages
  if (item.headers?.['bot_id'])              { score -= 25; rules.push('bot-message'); }

  score = Math.max(0, Math.min(100, score));
  const tier: SignalTier = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { tier, rules, score };
}

/* ── GitHub-specific rules ── */

function classifyGitHub(item: ClassifiableItem): ClassificationResult {
  const rules: string[] = [];
  let score = 50;

  const reason = item.headers?.['reason'] ?? '';
  if (reason === 'assign')                   { score += 30; rules.push('assigned'); }
  if (reason === 'mention')                  { score += 25; rules.push('mentioned'); }
  if (reason === 'review_requested')         { score += 25; rules.push('review-requested'); }
  if (reason === 'author')                   { score += 20; rules.push('author'); }
  if (reason === 'subscribed')               { score -= 10; rules.push('subscribed'); }
  if (reason === 'ci_activity')              { score -= 30; rules.push('ci-activity'); }

  // Dependabot / renovate
  const sender = item.sender.toLowerCase();
  if (/dependabot|renovate|snyk/.test(sender)) { score -= 30; rules.push('automated-dep'); }

  score = Math.max(0, Math.min(100, score));
  const tier: SignalTier = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  return { tier, rules, score };
}

/* ── User-defined overrides ── */

export interface UserSignalOverrides {
  /** Senders always classified as high signal. */
  vip_senders?: string[];
  /** Senders always classified as low signal. */
  mute_senders?: string[];
  /** Subject keywords to auto-low (case-insensitive, plain text). */
  mute_keywords?: string[];
  /** Score thresholds for tier assignment. */
  tier_thresholds?: { high: number; low: number };
}

function applyUserOverrides(
  result: ClassificationResult,
  item: ClassifiableItem,
  overrides: UserSignalOverrides,
): ClassificationResult {
  const email = extractEmail(item.sender);
  const rules = [...result.rules];
  let score = result.score;

  // VIP sender override — force high
  if (overrides.vip_senders?.some(v => email.includes(v.toLowerCase()))) {
    score = 100;
    rules.push('user:vip-sender');
  }

  // Muted sender override — force low
  if (overrides.mute_senders?.some(m => email.includes(m.toLowerCase()))) {
    score = 0;
    rules.push('user:muted-sender');
  }

  // Muted keyword check — lower score
  if (overrides.mute_keywords?.length) {
    const subjectLower = item.subject.toLowerCase();
    for (const kw of overrides.mute_keywords) {
      if (subjectLower.includes(kw.toLowerCase())) {
        score = Math.min(score, 10);
        rules.push(`user:muted-keyword(${kw})`);
        break;
      }
    }
  }

  score = Math.max(0, Math.min(100, score));

  // Apply custom or default thresholds
  const highThreshold = overrides.tier_thresholds?.high ?? 60;
  const lowThreshold = overrides.tier_thresholds?.low ?? 30;
  const tier: SignalTier = score >= highThreshold ? 'high' : score >= lowThreshold ? 'medium' : 'low';

  return { tier, rules, score };
}

/* ── Main entry point ── */

export function classifySignal(
  item: ClassifiableItem,
  overrides?: UserSignalOverrides,
): ClassificationResult {
  let result: ClassificationResult;
  switch (item.source) {
    case 'gmail':
    case 'email':  result = classifyGmail(item); break;
    case 'slack':  result = classifySlack(item); break;
    case 'github': result = classifyGitHub(item); break;
    default:       result = { tier: 'medium', rules: ['unknown-source'], score: 50 };
  }

  // Apply user overrides if provided
  if (overrides && (
    overrides.vip_senders?.length ||
    overrides.mute_senders?.length ||
    overrides.mute_keywords?.length ||
    overrides.tier_thresholds
  )) {
    return applyUserOverrides(result, item, overrides);
  }

  return result;
}

/* ── Content tiering helpers ── */

/** Maximum body chars to store for medium-tier items. */
const MEDIUM_TIER_BODY_LIMIT = 500;

/**
 * Given a classification result and full body text, return the content
 * that should be stored at observe time.
 *
 *   high   → full body
 *   medium → first MEDIUM_TIER_BODY_LIMIT chars + truncation marker
 *   low    → empty (metadata only)
 */
export function tierContent(tier: SignalTier, fullBody: string): string {
  switch (tier) {
    case 'high':
      return fullBody;
    case 'medium':
      if (fullBody.length <= MEDIUM_TIER_BODY_LIMIT) return fullBody;
      return fullBody.slice(0, MEDIUM_TIER_BODY_LIMIT) + '\n\n[…truncated — full content available on demand]';
    case 'low':
      return '';
  }
}

/**
 * Build a metadata-only summary line for low-tier items.
 * Stored instead of the body so recall can still mention the item exists.
 */
export function metadataOnlySummary(item: { subject: string; sender: string; date: string }): string {
  return `[Email] ${item.subject} — from ${item.sender} on ${item.date}`;
}
