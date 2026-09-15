/**
 * ConnectionWizard — shared six-step shell used by every integration
 * connection modal. The integration-specific modals (Calendar, Drive)
 * pass in a steps array and the wizard handles stepper UI, progress,
 * back/next/exit navigation, and the commit-on-final-step handoff.
 */

import * as React from 'react';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';

export interface WizardStep<TState> {
  id: string;
  title: string;
  subtitle?: string;
  /** Render the step body. Receives the current state and a setter. */
  render: (ctx: {
    state: TState;
    setState: (patch: Partial<TState> | ((prev: TState) => TState)) => void;
  }) => React.ReactNode;
  /** Whether the user can advance past this step. Defaults to true. */
  canAdvance?: (state: TState) => boolean;
  /** Optional text shown for the advance button (default "Continue"). */
  advanceLabel?: string;
}

interface WizardProps<TState> {
  open: boolean;
  title: string;
  subtitle?: string;
  steps: WizardStep<TState>[];
  initialState: TState;
  initialStepIndex?: number;
  /** Label for the final commit button (default "Connect"). */
  commitLabel?: string;
  commitBusyLabel?: string;
  /** Called when the user advances past the final step. */
  onCommit: (state: TState) => Promise<void>;
  onClose: () => void;
  /** Optional icon shown in the header. */
  headerIcon?: React.ReactNode;
}

export function ConnectionWizard<TState>({
  open,
  title,
  subtitle,
  steps,
  initialState,
  initialStepIndex = 0,
  commitLabel = 'Connect',
  commitBusyLabel = 'Connecting…',
  onCommit,
  onClose,
  headerIcon,
}: WizardProps<TState>) {
  const [stepIndex, setStepIndex] = React.useState(initialStepIndex);
  const [state, setStateRaw] = React.useState<TState>(initialState);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setState = React.useCallback((patch: Partial<TState> | ((prev: TState) => TState)) => {
    setStateRaw(prev => typeof patch === 'function' ? (patch as (p: TState) => TState)(prev) : { ...prev, ...patch });
  }, []);

  const step = steps[stepIndex]!;
  const isLast = stepIndex === steps.length - 1;
  const canAdvance = step.canAdvance ? step.canAdvance(state) : true;

  async function handleAdvance() {
    if (!canAdvance) return;
    setError(null);
    if (isLast) {
      setBusy(true);
      try {
        await onCommit(state);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Commit failed');
      } finally {
        setBusy(false);
      }
      return;
    }
    setStepIndex(stepIndex + 1);
  }

  function handleBack() {
    setError(null);
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="conn-wizard p-0 gap-0 sm:max-w-4xl">
        <header className="conn-wizard-header">
          <div className="conn-wizard-header-titleblock">
            {headerIcon && <div className="conn-wizard-header-icon">{headerIcon}</div>}
            <div>
              <DialogTitle className="conn-wizard-title">{title}</DialogTitle>
              {subtitle && <DialogDescription className="conn-wizard-subtitle">{subtitle}</DialogDescription>}
            </div>
          </div>
          <button className="conn-wizard-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <ol className="conn-wizard-progress" aria-label="Steps">
          {steps.map((s, i) => {
            const status = i < stepIndex ? 'done' : i === stepIndex ? 'current' : 'upcoming';
            return (
              <li key={s.id} className={`conn-wizard-progress-step ${status === 'upcoming' ? '' : status}`}>
                <span className="conn-wizard-progress-dot">{status === 'done' ? <Check size={12} /> : i + 1}</span>
                <span >{s.title}</span>
              </li>
            );
          })}
        </ol>

        <section className="conn-wizard-step">
          {step.subtitle && <p className="conn-wizard-step-subtitle">{step.subtitle}</p>}
          {step.render({ state, setState })}
          {error && <div className="conn-wizard-error">{error}</div>}
        </section>

        <footer className="conn-wizard-footer">
          <Button className="conn-wizard-footer-button" variant="outline" onClick={handleBack} disabled={stepIndex === 0 || busy}>
            <ArrowLeft size={14} /> Back
          </Button>
          <Button className="conn-wizard-footer-button" variant="outline" onClick={onClose} disabled={busy}>Exit setup</Button>
          <Button className="conn-wizard-footer-button conn-wizard-footer-primary" onClick={handleAdvance} disabled={!canAdvance || busy}>
            {busy
              ? (isLast ? commitBusyLabel : 'Working…')
              : (isLast ? commitLabel : (step.advanceLabel ?? 'Continue'))}
            {!isLast && !busy && <ArrowRight size={14} />}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
