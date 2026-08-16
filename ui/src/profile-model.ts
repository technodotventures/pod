export type ProfileFactCategory = 'identity' | 'preference' | 'instruction' | 'trait';

export interface ProfileFact {
  id: string;
  category: ProfileFactCategory;
  text: string;
  source_ids: string[];
  observed_at: string;
  scope: string;
  source_app?: string;
  origin: 'claim' | 'observation' | 'correction';
  confidence?: number;
}

export interface SelfProfileResponse {
  profile_id: 'self';
  summary: string;
  facts: ProfileFact[];
  created_at: string;
  updated_at: string;
  version: number;
  frontmatter: Record<string, string>;
  body: string;
}

export const PROFILE_CATEGORY_ORDER: ProfileFactCategory[] = [
  'identity',
  'preference',
  'instruction',
  'trait',
];

export const PROFILE_CATEGORY_LABELS: Record<ProfileFactCategory, string> = {
  identity: 'Identity',
  preference: 'Preferences',
  instruction: 'Instructions',
  trait: 'Traits',
};

export function groupProfileFacts(facts: ProfileFact[]): Array<{
  category: ProfileFactCategory;
  label: string;
  facts: ProfileFact[];
}> {
  return PROFILE_CATEGORY_ORDER
    .map(category => ({
      category,
      label: PROFILE_CATEGORY_LABELS[category],
      facts: facts.filter(fact => fact.category === category),
    }))
    .filter(group => group.facts.length > 0);
}

export function profileCorrectionContent(input: {
  action: 'add' | 'replace' | 'remove';
  category?: ProfileFactCategory;
  text?: string;
  targetFactId?: string;
}): Record<string, string> {
  return {
    kind: 'profile_correction',
    action: input.action,
    ...(input.category ? { category: input.category } : {}),
    ...(input.text?.trim() ? { text: input.text.trim() } : {}),
    ...(input.targetFactId ? { target_fact_id: input.targetFactId } : {}),
  };
}
