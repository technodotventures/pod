import type {
  AIModelMode,
  AIProviderFailureReason,
  ActiveAIProvider,
} from './ai-provider.js';
import { requestProviderText, resolveActiveAIProvider } from './ai-provider.js';
import type { CoffeePodEnv } from '../config/env.js';
import type { PodQueryContext, PodQueryTurn } from '../pod/types.js';
import { meaningfulSearchTerms } from './ask-pod-search.js';
import {
  normalizeRetrievalEvidence,
  type RetrievalEvidence,
  type RetrievalEvidenceCandidate,
} from './retrieval-evidence.js';

export interface AskPodEvidenceSource extends RetrievalEvidence {
  marker: string;
  /** Backwards-compatible flat fields retained for current UI consumers. */
  snippet?: string;
  claim_id?: string;
  observation_id?: string;
  observation_ids?: string[];
  object_id?: string;
  entity_id?: string;
  profile_id?: 'self';
  source_app?: string;
  source_external_id?: string;
  source_id?: string;
  observed_at?: string;
  server_name?: string;
  tool_name?: string;
  url?: string;
}

export function numberEvidenceSources(
  sources: RetrievalEvidenceCandidate[],
): AskPodEvidenceSource[] {
  return sources.map((source, index) => ({
    ...source,
    ...normalizeRetrievalEvidence(source),
    marker: `S${index + 1}`,
  })) as AskPodEvidenceSource[];
}

export function citedEvidenceSources(
  answer: string,
  sources: AskPodEvidenceSource[],
): AskPodEvidenceSource[] {
  const byMarker = new Map(sources.map(source => [source.marker, source]));
  const cited: AskPodEvidenceSource[] = [];
  const seen = new Set<string>();
  for (const match of answer.matchAll(/\[(S\d+)\]/g)) {
    const source = byMarker.get(match[1]!);
    if (!source || seen.has(source.id)) continue;
    seen.add(source.id);
    cited.push(source);
  }
  return cited;
}

export type AskPodFallbackKind =
  | 'profile'
  | 'evidence'
  | 'no_evidence'
  | 'synthesis_unavailable'
  | 'conflict';

export interface AskPodFallback {
  answer: string;
  kind: AskPodFallbackKind;
}

function canonicalMatchTerm(term: string): string {
  const aliases: Record<string, string> = {
    color: 'colour',
    colors: 'colour',
    colours: 'colour',
    favorite: 'favourite',
    favorites: 'favourite',
    favourites: 'favourite',
  };
  return aliases[term] ?? term;
}

function matchTerms(text: string): string[] {
  return meaningfulSearchTerms(text).map(canonicalMatchTerm);
}

function sentence(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function profileFactText(line: string): string {
  return line.replace(/^[A-Z][A-Z _-]{1,30}:\s*/, '').trim();
}

function profileFactAnswer(fact: string): string {
  const callMe = fact.match(/^(?:always\s+)?call me\s+(.+?)[.!?]?$/i);
  if (callMe) return sentence(`You've asked me to call you ${callMe[1]}`);

  const possessive = fact.match(/^my\s+(.+?)[.!?]?$/i);
  if (possessive) return sentence(`Your ${possessive[1]}`);

  const identity = fact.match(/^i(?:'m| am)\s+(.+?)[.!?]?$/i);
  if (identity) return sentence(`You're ${identity[1]}`);

  const firstPerson = fact.match(/^i\s+(prefer|like|love|want|need|use|have|work|live)\s+(.+?)[.!?]?$/i);
  if (firstPerson) return sentence(`You ${firstPerson[1].toLowerCase()} ${firstPerson[2]}`);

  return `I found this in your profile: "${sentence(fact)}"`;
}

function bestProfileFact(
  query: string,
  source: AskPodEvidenceSource,
): string | null {
  const queryTerms = [...new Set(matchTerms(query))];
  if (queryTerms.length === 0) return null;

  const candidates = source.text
    .split(/\n+/)
    .map(profileFactText)
    .filter(Boolean)
    .map(fact => {
      const factTerms = new Set(matchTerms(fact));
      const matches = queryTerms.filter(term => factTerms.has(term)).length;
      const direct = /^(?:my\b|i\b|always call me\b|call me\b)/i.test(fact) ? 8 : 0;
      return {
        fact,
        matches,
        score: matches * 100
          + (matches / queryTerms.length) * 20
          + direct
          - Math.min(fact.length, 500) / 100,
      };
    })
    .filter(candidate => candidate.matches >= Math.min(2, queryTerms.length))
    .sort((left, right) => right.score - left.score || left.fact.length - right.fact.length);

  return candidates[0]?.fact ?? null;
}

function sourceRelevance(
  query: string,
  source: AskPodEvidenceSource,
  temporalLabel?: string | null,
  hasSelectedContext?: boolean,
): number {
  if (source.type === 'profile') return 0;
  const queryTerms = [...new Set(matchTerms(query))];
  const sourceTerms = new Set(matchTerms(`${source.title} ${source.text}`));
  const lexicalMatches = queryTerms.filter(term => sourceTerms.has(term)).length;
  const selectedContext = source.ranking.retrievers.includes('selected_context')
    ? hasSelectedContext ? 8 : 4
    : 0;
  const temporal = temporalLabel
    && ['object', 'observation', 'conversation'].includes(source.type)
    ? 1
    : 0;
  return lexicalMatches * 10 + selectedContext + temporal;
}

function evidenceSummary(source: AskPodEvidenceSource): string {
  const text = source.text.replace(/\s+/g, ' ').trim();
  if (!text || text.toLowerCase() === source.title.toLowerCase()) return '';
  if (text.length <= 180) return text;
  const clipped = text.slice(0, 177).replace(/\s+\S*$/, '').trimEnd();
  return `${clipped}...`;
}

function asksForSynthesis(query: string): boolean {
  return /\b(?:main themes?|summari[sz]e|summary|patterns?|trends?|throughline|clusters?|synthesi[sz]e)\b/i.test(query)
    || /\bthinking about most\b/i.test(query)
    || /\bthemes? seem to be growing\b/i.test(query);
}

function synthesisUnavailableAnswer(input: {
  sourceCount: number;
  providerStatus: 'unavailable' | 'error';
  providerFailureReason?: AIProviderFailureReason;
}): string {
  const subject = input.sourceCount === 1 ? 'memory' : 'memories';
  const pronoun = input.sourceCount === 1 ? 'it' : 'them';
  let reason = 'no AI model is connected.';
  let nextStep = 'Connect a model in Connections → Models, then try again.';

  if (input.providerStatus === 'error') {
    if (input.providerFailureReason === 'model_unavailable') {
      reason = 'the selected AI model is no longer available.';
      nextStep = 'Open Connections → Models and choose another model, then try again.';
    } else if (input.providerFailureReason === 'authentication_failed') {
      reason = 'the selected AI model connection was rejected.';
      nextStep = 'Open Connections → Models and reconnect it, then try again.';
    } else if (input.providerFailureReason === 'rate_limited') {
      reason = 'the selected AI model is temporarily rate-limited.';
      nextStep = 'Try again in a moment, or choose another model in Connections → Models.';
    } else {
      reason = 'the connected AI model failed before it could finish.';
      nextStep = 'Check the model connection in Connections → Models, then try again.';
    }
  }

  return [
    `I found ${input.sourceCount} candidate ${subject} for this question, but I couldn't summarize ${pronoun} because ${reason}`,
    '',
    nextStep,
  ].join('\n');
}

/**
 * Give Ask Pod an honest local answer when model synthesis is unavailable.
 * This is deliberately extractive: it may quote or lightly rephrase retrieved
 * evidence, but it never invents a fact to make the response feel complete.
 */
export function buildAskPodFallback(input: {
  query: string;
  sources: AskPodEvidenceSource[];
  scopeIsAll: boolean;
  temporalLabel?: string | null;
  hasSelectedContext?: boolean;
  providerStatus: 'unavailable' | 'error';
  providerFailureReason?: AIProviderFailureReason;
}): AskPodFallback {
  const profileSource = input.sources.find(source => source.type === 'profile');
  if (profileSource) {
    const fact = bestProfileFact(input.query, profileSource);
    if (fact) {
      return {
        kind: 'profile',
        answer: `${profileFactAnswer(fact)} [${profileSource.marker}]`,
      };
    }
  }

  if (input.sources.length > 0 && asksForSynthesis(input.query)) {
    return {
      kind: 'synthesis_unavailable',
      answer: synthesisUnavailableAnswer({
        sourceCount: input.sources.length,
        providerStatus: input.providerStatus,
        providerFailureReason: input.providerFailureReason,
      }),
    };
  }

  const relevant = input.sources
    .map(source => ({
      source,
      relevance: sourceRelevance(
        input.query,
        source,
        input.temporalLabel,
        input.hasSelectedContext,
      ),
    }))
    .filter(candidate => candidate.relevance > 0)
    .sort((left, right) =>
      right.relevance - left.relevance
      || (right.source.ranking.score ?? 0) - (left.source.ranking.score ?? 0))
    .slice(0, 4);

  if (relevant.length > 0) {
    return {
      kind: 'evidence',
      answer: [
        'I found a few memories that look relevant:',
        '',
        ...relevant.map(({ source }) => {
          const detail = evidenceSummary(source);
          return `- **${source.title}**${detail ? ` - ${detail}` : ''} [${source.marker}]`;
        }),
      ].join('\n'),
    };
  }

  const nextSteps: string[] = [];
  if (input.temporalLabel) nextSteps.push('try a wider timeframe');
  if (!input.scopeIsAll) nextSteps.push('switch to All memories');
  const searchSuggestion = nextSteps.length > 0
    ? `You could ${nextSteps.join(' or ')}. `
    : '';
  const providerNote = input.providerStatus === 'error'
    ? ' I also couldn\'t reach the connected AI model, so I kept this to what Pod could verify locally.'
    : '';

  return {
    kind: 'no_evidence',
    answer: [
      `I don't have anything in Pod that answers that yet.${providerNote}`,
      '',
      `${searchSuggestion}If you already know the answer, tell me directly - for example, "Remember that ..." - and I'll keep it for next time.`,
    ].join('\n'),
  };
}

function formatSelectedContext(context?: PodQueryContext): string {
  if (!context) return '';
  const labels = (context.labels ?? []).slice(0, 12).join(', ');
  const edges = (context.edges ?? [])
    .slice(0, 20)
    .map((edge) => `${edge.source} ${edge.label ? `--${edge.label}--` : '--'} ${edge.target}`)
    .join('\n');
  return [
    `Kind: ${context.kind}`,
    labels ? `Selected labels: ${labels}` : '',
    edges ? `Selected relationships:\n${edges}` : '',
  ].filter(Boolean).join('\n');
}

function formatConversationHistory(history?: PodQueryTurn[]): string {
  return (history ?? [])
    .slice(-6)
    .map(turn => {
      const speaker = turn.role === 'user' ? 'User' : 'Pod';
      const content = turn.content.trim().replace(/\s+/g, ' ').slice(0, 600);
      return content ? `${speaker}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

export interface AskPodAnswer {
  answer: string;
  provider: ActiveAIProvider['id'];
  model: string;
}

function formatEvidence(source: AskPodEvidenceSource): string {
  const metadata = [
    source.type,
    source.source.app,
    source.source.observed_at,
  ].filter(Boolean).join(', ');
  const snippet = source.text.trim().slice(0, 1200);
  return `[${source.marker}] ${source.title}${metadata ? ` (${metadata})` : ''}${snippet ? `\n${snippet}` : ''}`;
}

export async function generateAskPodAnswer(
  env: CoffeePodEnv,
  input: {
    query: string;
    history?: PodQueryTurn[];
    sources: AskPodEvidenceSource[];
    selectedContext?: PodQueryContext;
    /** Human-readable temporal phrase that was detected (e.g. "yesterday")
     *  so the LLM can ground its answer in the same time window the user
     *  asked about. */
    temporalLabel?: string | null;
    mode?: AIModelMode;
  },
): Promise<AskPodAnswer | null> {
  const provider = await resolveActiveAIProvider(env, input.mode ?? 'auto');
  if (!provider) return null;

  const selectedContext = formatSelectedContext(input.selectedContext);
  const conversationHistory = formatConversationHistory(input.history);
  const evidence = input.sources.map(formatEvidence).join('\n\n');
  const hasProfile = input.sources.some(source => source.type === 'profile');
  const prompt = [
    `User question: ${input.query}`,
    input.temporalLabel ? `Detected time window: ${input.temporalLabel}` : '',
    '',
    'Recent conversation (context only, not evidence):',
    conversationHistory || 'None',
    '',
    'Selected context:',
    selectedContext || 'None',
    '',
    'Evidence:',
    evidence || 'None',
    '',
    'Answer the user directly using only the Pod memory and external MCP context shown above.',
    'Lead with the answer. Include only evidence that actually helps with the question; do not dump loosely related memories.',
    hasProfile
      ? 'Treat Your profile as stable background grounding. Apply relevant preferences and instructions naturally without announcing that a profile exists.'
      : '',
    selectedContext
      ? 'The selected context is the primary scope. Use broader Pod memory only when it clarifies the selected items.'
      : '',
    input.temporalLabel
      ? `When the user asks about "${input.temporalLabel}", ground the answer in items whose dates fall in that window.`
      : '',
    'Cite each factual statement with one or more exact evidence markers such as [S1].',
    'Use only markers shown in the current Evidence section. Never reuse a marker from Recent conversation. If the evidence is insufficient, say so without inventing a citation.',
    'If Pod does not contain the answer, say what is missing and offer one concrete next step, such as changing an active filter or telling Pod what to remember. Do not fall back to stock wording about rephrasing or broadening a search.',
    'Sound like a warm, thoughtful collaborator. Use natural sentences, avoid canned support language, and keep the response concise.',
    'Distinguish live external context from durable Pod memory when it matters.',
  ].filter((line) => line !== '').join('\n');

  const answer = await requestProviderText(provider, {
    system: 'You are Pod, a memory companion. Answer from the provided memory context only.',
    prompt,
    maxTokens: 700,
  });

  return {
    answer: answer.trim(),
    provider: provider.id,
    model: provider.model,
  };
}
