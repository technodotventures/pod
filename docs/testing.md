# Testing

Two layers, one command set. Everything below is free tooling — no paid services.

## Unit + integration (node:test)

- `npm test` — builds, then runs `dist/test/**/*.test.js` on Node's built-in runner.
- `npm run lint:design` — the design-system lint (`@shadcn/lint` via oxlint; rules + allowlist in `.oxlintrc.json`). Part of `npm run lint` and the beta gate.
- `npm run beta:gate` — the full gate: typecheck + design lint + unit tests + UI build + acceptance script.

## E2E (Playwright, chromium)

Runs the real dev stack (`npm run dev:all`) against an **isolated data directory**
(`.e2e-data/`, deleted before every run) on dedicated ports — API `8907`, UI `5273`
(`COFFEE_POD_PORT` / `COFFEE_POD_UI_PORT` to override). The suite never touches
`./data/` or any other Pod instance.

```bash
npm run test:e2e            # full suite (first-run onboarding is part of it)
npm run test:e2e:update     # refresh visual baselines (intentional changes only)
E2E_VIDEO=1 npm run test:e2e  # record every test (evidence runs)
```

What runs:

| Project | File | Covers |
|---|---|---|
| setup | `e2e/onboarding.setup.ts` | first-run onboarding → "Set up later" → cockpit |
| cockpit | `e2e/cockpit.spec.ts` | all six nav surfaces render; Ask Pod panel toggles + accepts input |
| a11y | `e2e/a11y.spec.ts` | axe-core (WCAG 2.0/2.1 A+AA) — zero critical violations |
| visual | `e2e/visual.spec.ts` | committed screenshot baselines for stable surfaces |

Artifacts: `playwright-report/` (HTML report), `test-results/` (traces and videos
retained on failure). Visual baselines live in `e2e/visual.spec.ts-snapshots/`.

## CI

`.github/workflows/e2e.yml` (ubuntu) — unit tests + E2E with report artifacts.
The beta gate (`.github/workflows/beta-gate.yml`) stays macOS-only (desktop packaging).
