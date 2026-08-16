# Spec v1.5.4.2 UI surfaces

This directory holds the React components added by the next-phase plan.
`ProfileView` is integrated into `ui/src/main.tsx`; the remaining views are
still reusable surfaces awaiting navigation decisions.

## Components

| Component | Spec ref | Backed by | What it does |
|---|---|---|---|
| `EndorsementModal` | B6 | `POST /pod/revise` two-phase flow | Cascade preview + confirm. Handles 428 / 410 / 404 with re-prompts. |
| `OnboardingWizard` | F1 fast-path | `POST /pod/observe`, env defaults | 4-step welcome → identity → integration → ready |
| `OnboardingWizardExpanded` | F1 full spec | + `POST /pod/reflect target=profile` | 8-step welcome → location → identity → LLM → defaults → integration → profile compile → ready |
| `ProfileView` | F2 | `GET /pod/wiki/profile` + structured correction observations | Inspect, add, correct, and remove facts from the source-backed Self profile |
| `SynthesisView` | F3 | `GET /pod/wiki/pages?category=synthesis&author=user` | Sidebar list of user-authored pages + viewer |
| `AgentPagesView` | F4 | `GET /pod/wiki/pages?category=...&author=agent` | Categorised list with Endorse button → opens `EndorsementModal` |
| `HistoryView` | F5 | `GET /pod/history` | Ops-log table with actor / op / artifact / time filters |

All re-exported from `./spec-views.ts`:

```tsx
import {
  EndorsementModal,
  OnboardingWizard,
  OnboardingWizardExpanded,
  ProfileView,
  SynthesisView,
  AgentPagesView,
  HistoryView,
} from './components/spec-views.js';
```

## Wiring (next browser session)

Add three things to `main.tsx`:

1. **A new top-level view type for each surface.** The existing app has a
   discriminated state for the active view. Extend it with
   `'your-profile' | 'your-writing' | 'whats-learned' | 'history'`.
2. **Nav entries.** Add buttons or sidebar entries that switch the
   active view to each new key.
3. **First-run gate.** Check `GET /pod/runtime` on app boot — when
   `owner_id` is missing / unset, render `OnboardingWizardExpanded`
   instead of the main UI. On `onComplete`, POST the chosen config to
   `/pod/settings` and refresh.

Sample render skeleton:

```tsx
{view === 'your-profile' && <ProfileView actorId={actorId} />}
{view === 'your-writing' && <SynthesisView />}
{view === 'whats-learned' && <AgentPagesView actorId={actorId} />}
{view === 'history' && <HistoryView />}
```

## Verification checklist

When wiring in a browser:

- [ ] Endorse button on an agent-authored page opens the modal
- [ ] Modal shows direct + shared claims correctly when shared-claim cascade present
- [ ] Modal handles 428 → re-confirm screen
- [x] Profile view loads `wiki/profiles/self.md` and renders structured facts
- [x] Profile corrections produce structured `profile_correction` observations
- [ ] Synthesis sidebar lists only user-authored pages
- [ ] History filters refresh the table on Apply
- [ ] Onboarding fast-path completes in ≤ 4 clicks
- [ ] Onboarding expanded covers all 8 steps and persists chosen defaults

## Styling note

`ProfileView` uses the shared tokens in `styles.css`; the remaining reusable
views retain their earlier inline styles until they are integrated.
