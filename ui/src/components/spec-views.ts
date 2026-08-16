// Barrel export for Spec v1.5.4.2 UI surfaces (PR-26).
//
// Every UI component added by this plan's PR-8 / PR-13 / PR-16 / PR-19 /
// PR-23 work is re-exported here so main.tsx can wire them with a single
// import. None of these have been verified in a browser; treat the
// visual layout as a draft to be reviewed during the wiring session.

export { EndorsementModal } from './EndorsementModal.js';
export type { EndorsementModalProps } from './EndorsementModal.js';

export { OnboardingWizard } from './OnboardingWizard.js';
export type { OnboardingWizardProps } from './OnboardingWizard.js';

export { OnboardingWizardExpanded } from './OnboardingWizardExpanded.js';
export type {
  OnboardingWizardExpandedProps,
  ExpandedConfig,
  ExpandedStep,
} from './OnboardingWizardExpanded.js';

export { ProfileView, SynthesisView, AgentPagesView } from './WikiViews.js';

export { HistoryView } from './HistoryView.js';
