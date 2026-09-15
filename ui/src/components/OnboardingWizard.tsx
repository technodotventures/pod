// First-run onboarding wizard (PR-13 / F1). [WRITTEN-BUT-UNVERIFIED.]
//
// Compiles but has not been opened in a browser this session. Per the
// pod-onboarding-flow-v0_1.md spec, this is the 8-step first-run flow.
// Built as the "fast path" first: Welcome → Identity → first integration
// → Pod ready. The expanded steps (Pod location chooser, LLM provider,
// operational defaults sliders, profile compile orchestration) are
// scaffolded with TODO markers so a follow-up session can flesh them out.
//
// Wiring: import OnboardingWizard into ui/src/main.tsx where the app
// boots; show it when GET /pod/runtime indicates no identity is set.

import React, { useState } from 'react';
import { createOperationId } from '../operation-id.js';

type Step = 'welcome' | 'identity' | 'integration' | 'ready';

export interface OnboardingWizardProps {
  /** Called once onboarding finishes; receives the chosen identity slug. */
  onComplete: (identity: { user_slug: string }) => void;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function OnboardingWizard({
  onComplete,
  fetchImpl,
}: OnboardingWizardProps): React.ReactElement {
  const f = fetchImpl ?? fetch;
  const [step, setStep] = useState<Step>('welcome');
  const [identity, setIdentity] = useState<string>('');
  const [integrationConnected, setIntegrationConnected] = useState<string | null>(null);

  function next() {
    if (step === 'welcome') setStep('identity');
    else if (step === 'identity') setStep('integration');
    else if (step === 'integration') setStep('ready');
    else if (step === 'ready') onComplete({ user_slug: identity });
  }

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: 24, background: 'white', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <StepIndicator current={step} />
      {step === 'welcome' && <WelcomeStep onNext={next} />}
      {step === 'identity' && <IdentityStep value={identity} onChange={setIdentity} onNext={next} />}
      {step === 'integration' && (
        <IntegrationStep
          connected={integrationConnected}
          onConnect={setIntegrationConnected}
          onNext={next}
          fetchImpl={f}
        />
      )}
      {step === 'ready' && <ReadyStep identity={identity} onClose={() => onComplete({ user_slug: identity })} />}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ['welcome', 'identity', 'integration', 'ready'];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {steps.map((s) => (
        <div
          key={s}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: steps.indexOf(s) <= steps.indexOf(current) ? '#2563eb' : '#e5e7eb',
          }}
        />
      ))}
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div>
      <h2>Welcome to Pod</h2>
      <p>
        Your personal memory companion, built on Smartware. Your Pod lives where you choose;
        you own every observation and every compiled understanding.
      </p>
      <p>This setup takes ~2 minutes.</p>
      {/* TODO(F1.5): Pod location chooser — beta is local-only, but surface
          the option honestly with Cloud/VPS disabled behind "post-beta". */}
      <button onClick={onNext} style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 4 }}>
        Get started
      </button>
    </div>
  );
}

function IdentityStep({ value, onChange, onNext }: { value: string; onChange: (v: string) => void; onNext: () => void }) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const isValid = slug.length > 0;
  return (
    <div>
      <h2>What should we call you?</h2>
      <p>This becomes your actor id: <code>user:{slug || '...'}</code></p>
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="alex"
        style={{ width: '100%', padding: 8, fontSize: 16, marginBottom: 16, border: '1px solid #d1d5db', borderRadius: 4 }}
      />
      {/* TODO(F1.5): LLM provider selector here once cadence + capacity
          sliders are surfaced. For now we accept env defaults. */}
      <button onClick={onNext} disabled={!isValid} style={{ background: isValid ? '#2563eb' : '#9ca3af', color: 'white', padding: '8px 16px', borderRadius: 4 }}>
        Continue
      </button>
    </div>
  );
}

function IntegrationStep({
  connected,
  onConnect,
  onNext,
  fetchImpl,
}: {
  connected: string | null;
  onConnect: (provider: string | null) => void;
  onNext: () => void;
  fetchImpl: typeof fetch;
}) {
  const providers = [
    { id: 'google-calendar', label: 'Google Calendar', description: 'Meetings shape what you’re working on.' },
    { id: 'google-drive', label: 'Google Drive', description: 'Documents are context-rich.' },
    { id: 'slack', label: 'Slack', description: 'Conversations reveal preferences.', stub: true },
    { id: 'github', label: 'GitHub', description: 'Code activity shapes the engineering profile.', stub: true },
  ];
  return (
    <div>
      <h2>Connect your first integration</h2>
      <p>The substrate gets better when it sees more of you. Pick one to start (you can add more later).</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={async () => {
              // TODO(F1): kick the existing per-integration ConnectionWizard
              // instead of inline stubbing. For now, mark as "noted" and
              // proceed — operator finishes OAuth from Settings.
              await fetchImpl('/pod/observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actor_id: 'substrate:coffee',
                  operation_id: createOperationId(),
                  content: `onboarding: chose ${p.id} as first integration`,
                  scope_alias: 'personal',
                  type: 'preference',
                }),
              }).catch(() => undefined);
              onConnect(p.id);
            }}
            style={{
              textAlign: 'left',
              padding: 12,
              border: connected === p.id ? '2px solid #2563eb' : '1px solid #d1d5db',
              borderRadius: 4,
              background: 'white',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 'bold' }}>
              {p.label} {p.stub ? <span style={{ fontSize: '0.8em', color: '#666' }}>(coming soon)</span> : null}
            </div>
            <div style={{ fontSize: '0.9em', color: '#666' }}>{p.description}</div>
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={onNext} style={{ background: '#6b7280', color: 'white', padding: '8px 16px', borderRadius: 4 }}>
          Skip for now
        </button>
        <button onClick={onNext} disabled={!connected} style={{ background: connected ? '#2563eb' : '#9ca3af', color: 'white', padding: '8px 16px', borderRadius: 4 }}>
          Continue
        </button>
      </div>
    </div>
  );
}

function ReadyStep({ identity, onClose }: { identity: string; onClose: () => void }) {
  return (
    <div>
      <h2>Your Pod is ready.</h2>
      <p>
        Welcome, <strong>{identity}</strong>. Your Pod is set up. The substrate will start
        compiling understanding as you use connected tools. Visit <code>Your Profile</code>
        after a few days to see what it’s learned.
      </p>
      {/* TODO(F2): trigger an initial profile REFLECT in the background so
          the user sees a non-empty profile on first visit. */}
      <button onClick={onClose} style={{ background: '#2563eb', color: 'white', padding: '8px 16px', borderRadius: 4 }}>
        Open Pod
      </button>
    </div>
  );
}
