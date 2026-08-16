import * as React from 'react';
import { Check, ExternalLink, Mail, ShieldCheck } from 'lucide-react';

import { ConnectionWizard, type WizardStep } from './ConnectionWizard';
import { ServiceLogo, type ServiceLogoId } from './ServiceLogo';
import { deleteJson, getJson, postJson } from './api';
import {
  DEFAULT_CADENCE_GMAIL,
  DEFAULT_GMAIL_FILTERS,
  DEFAULT_GMAIL_SIGNAL_CONFIG,
  DEFAULT_SCOPE_ROUTING,
  type Cadence,
  type GmailFilters,
  type GmailSignalConfig,
  type ScopeRouting,
} from './types';

type EmailProvider = 'google' | 'icloud';
type EmailProviderId = EmailProvider | 'outlook' | 'yahoo';

const EMAIL_PROVIDERS: ReadonlyArray<{
  id: EmailProviderId;
  name: string;
  detail: string;
  available: boolean;
}> = [
  { id: 'google', name: 'Gmail', detail: 'Google Workspace and personal Gmail accounts.', available: true },
  { id: 'outlook', name: 'Outlook', detail: 'Microsoft 365 and Outlook.com accounts.', available: false },
  { id: 'icloud', name: 'iCloud Mail', detail: 'Email accounts hosted by Apple iCloud.', available: true },
  { id: 'yahoo', name: 'Yahoo Mail', detail: 'Personal and business Yahoo Mail accounts.', available: false },
];

function isAvailableEmailProvider(provider: EmailProviderId): provider is EmailProvider {
  return provider === 'google' || provider === 'icloud';
}

function emailConnectionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.includes('401 session expired')) {
    return 'Your Pod session expired. Reload the page, then try connecting again.';
  }
  return error instanceof Error ? error.message : fallback;
}

interface EmailProviderStatus {
  status: string;
  connected_at?: string;
  account_email?: string;
}

interface EmailStatusResponse {
  status: string;
  email_providers?: {
    google?: EmailProviderStatus;
    icloud?: EmailProviderStatus;
  };
}

interface EmailWizardState {
  provider: EmailProvider | null;
  google_connected: boolean;
  icloud_connected: boolean;
  icloud_reconnect: boolean;
  google_client_id: string;
  google_client_secret: string;
  icloud_email: string;
  icloud_username: string;
  icloud_app_password: string;
  filters: GmailFilters & { include_inbox: boolean; include_sent: boolean };
  signal_config: GmailSignalConfig;
  cadence: Cadence;
  scope_routing: ScopeRouting;
}

interface Props {
  token: string;
  open: boolean;
  providers?: EmailStatusResponse['email_providers'];
  onClose: () => void;
  onCommitted: () => void;
  onProvidersChanged: () => void;
}

function ProviderMark({ provider }: { provider: EmailProviderId }) {
  const logo: Record<EmailProviderId, ServiceLogoId> = {
    google: 'gmail',
    outlook: 'outlook',
    icloud: 'icloud-mail',
    yahoo: 'yahoo-mail',
  };
  return (
    <span className={`email-provider-mark ${provider}`}>
      <ServiceLogo service={logo[provider]} size={23} />
    </span>
  );
}

function ProviderStep({ state, setState }: {
  state: EmailWizardState;
  setState: (patch: Partial<EmailWizardState>) => void;
}) {
  return (
    <div className="email-provider-picker">
      {EMAIL_PROVIDERS.map(provider => {
        const selected = state.provider === provider.id;
        return (
          <button
            type="button"
            key={provider.id}
            className={`email-provider-option${selected ? ' selected' : ''}`}
            disabled={!provider.available}
            onClick={() => {
              if (isAvailableEmailProvider(provider.id)) setState({ provider: provider.id });
            }}
          >
            <ProviderMark provider={provider.id} />
            <span className="email-provider-copy">
              <span className="email-provider-title">
                <strong>{provider.name}</strong>
                {!provider.available && <span className="email-provider-badge">Coming soon</span>}
              </span>
              <span>{provider.detail}</span>
            </span>
            {provider.available && <span className="email-provider-check">{selected && <Check size={14} />}</span>}
          </button>
        );
      })}
      <div className="email-provider-note">
        <Mail size={15} />
        <span>Pod connects directly to the service you choose with read-only access. Each account stays in its own private memory space.</span>
      </div>
    </div>
  );
}

function AccountStep({ state, setState, token, onProvidersChanged }: {
  state: EmailWizardState;
  setState: (patch: Partial<EmailWizardState>) => void;
  token: string;
  onProvidersChanged: () => void;
}) {
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [message, setMessage] = React.useState('');

  async function disconnect(provider: EmailProvider) {
    setDisconnecting(true);
    setMessage('');
    try {
      await deleteJson(`/integrations/${provider === 'google' ? 'gmail' : 'icloud-mail'}`, token);
      setState(provider === 'google'
        ? { google_connected: false }
        : { icloud_connected: false, icloud_reconnect: false, icloud_app_password: '' });
      onProvidersChanged();
      setMessage(`${provider === 'google' ? 'Google' : 'iCloud'} email disconnected.`);
    } catch (error) {
      setMessage(emailConnectionError(error, 'Could not disconnect email.'));
    } finally {
      setDisconnecting(false);
    }
  }

  async function connectGoogle() {
    setConnecting(true);
    setMessage('');
    try {
      if (state.google_client_id.trim() || state.google_client_secret.trim()) {
        await postJson('/integrations/gmail/configure', token, {
          client_id: state.google_client_id.trim(),
          client_secret: state.google_client_secret.trim(),
        });
      }
      const auth = await getJson<{ url: string }>('/integrations/gmail/auth-url?actor_id=person-local', token);
      window.open(auth.url, '_blank', 'noopener,noreferrer');
      setMessage('Finish signing in with Google, then return here.');
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise(resolve => window.setTimeout(resolve, 2_000));
        const status = await getJson<EmailStatusResponse>('/integrations/gmail/status', token);
        if (status.email_providers?.google?.status === 'active') {
          setState({ google_connected: true });
          onProvidersChanged();
          setMessage('Google email connected.');
          return;
        }
      }
      setMessage('Sign-in is still waiting. You can try again without losing these settings.');
    } catch (error) {
      setMessage(emailConnectionError(error, 'Could not start Google sign-in.'));
    } finally {
      setConnecting(false);
    }
  }

  if (!state.provider) {
    return <p className="email-connection-message">Choose an email service to continue.</p>;
  }

  if (state.provider === 'google') {
    return (
      <div className="email-account-step">
        {state.google_connected ? (
          <>
            <div className="email-connected-banner"><Check size={16} /> Google email is connected</div>
            <button type="button" className="connection-link-danger" onClick={() => void disconnect('google')} disabled={disconnecting}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect Google email'}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="service-auth-button" onClick={connectGoogle} disabled={connecting}>
              <span className="service-auth-button-logo"><ServiceLogo service="google" size={22} /></span>
              <span>{connecting
                ? 'Waiting for Google…'
                : state.google_client_id.trim() || state.google_client_secret.trim()
                  ? 'Save credentials and sign in with Google'
                  : 'Sign in with Google'}</span>
            </button>
            <details className="email-oauth-details">
              <summary>Use your own Google OAuth credentials</summary>
              <label>
                <span>Client ID</span>
                <input value={state.google_client_id} onChange={event => setState({ google_client_id: event.target.value })} />
              </label>
              <label>
                <span>Client secret</span>
                <input type="password" value={state.google_client_secret} onChange={event => setState({ google_client_secret: event.target.value })} />
              </label>
            </details>
            <div className="email-auth-requirement">
              <ShieldCheck size={15} />
              <span>Finish Google sign-in to grant read-only access. OAuth credentials configure sign-in, but do not connect the account by themselves.</span>
            </div>
          </>
        )}
        {message && <p className="email-connection-message" aria-live="polite">{message}</p>}
      </div>
    );
  }

  if (state.icloud_connected && !state.icloud_reconnect) {
    return (
      <div className="email-account-step">
        <div className="email-connected-banner"><Check size={16} /> iCloud email is connected</div>
        <p className="email-connection-message">{state.icloud_email}</p>
        <button type="button" className="connection-btn" onClick={() => setState({ icloud_reconnect: true })}>
          Update account or password
        </button>
        <button type="button" className="connection-link-danger" onClick={() => void disconnect('icloud')} disabled={disconnecting}>
          {disconnecting ? 'Disconnecting…' : 'Disconnect iCloud email'}
        </button>
        {message && <p className="email-connection-message">{message}</p>}
      </div>
    );
  }

  return (
    <div className="email-account-step">
      <label className="email-account-field">
        <span>iCloud email</span>
        <input
          type="email"
          placeholder="you@icloud.com"
          value={state.icloud_email}
          onChange={event => setState({ icloud_email: event.target.value })}
        />
      </label>
      <label className="email-account-field">
        <span>IMAP username <small>Usually the same email</small></span>
        <input
          placeholder={state.icloud_email || 'you@icloud.com'}
          value={state.icloud_username}
          onChange={event => setState({ icloud_username: event.target.value })}
        />
      </label>
      <label className="email-account-field">
        <span>App-specific password</span>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="xxxx-xxxx-xxxx-xxxx"
          value={state.icloud_app_password}
          onChange={event => setState({ icloud_app_password: event.target.value })}
        />
      </label>
      <a className="email-password-help" href="https://account.apple.com" target="_blank" rel="noreferrer">
        Create an app-specific password at account.apple.com <ExternalLink size={12} />
      </a>
      <div className="email-keychain-note">
        <ShieldCheck size={16} />
        <span>The password goes directly to macOS Keychain. Pod’s config, logs, and backups never contain it.</span>
      </div>
    </div>
  );
}

function MailboxStep({ state, setState }: {
  state: EmailWizardState;
  setState: (patch: Partial<EmailWizardState>) => void;
}) {
  const updateFilters = (patch: Partial<EmailWizardState['filters']>) =>
    setState({ filters: { ...state.filters, ...patch } });
  return (
    <div className="email-preferences-step">
      <label className="email-preference-row featured">
        <input type="checkbox" checked={state.filters.include_sent} onChange={event => updateFilters({ include_sent: event.target.checked })} />
        <span><strong>Learn from Sent mail</strong><small>Your replies reveal decisions, corrections, commitments, and writing style.</small></span>
      </label>
      <label className="email-preference-row">
        <input type="checkbox" checked={state.filters.include_inbox} onChange={event => updateFilters({ include_inbox: event.target.checked })} />
        <span><strong>Include Inbox context</strong><small>Prioritise threads you replied to and messages addressed directly to you.</small></span>
      </label>
      {state.provider === 'google' && (
        <>
          <label className="email-preference-row compact">
            <input type="checkbox" checked={state.filters.exclude_promotions} onChange={event => updateFilters({ exclude_promotions: event.target.checked })} />
            <span>Exclude Promotions</span>
          </label>
          <label className="email-preference-row compact">
            <input type="checkbox" checked={state.filters.exclude_social} onChange={event => updateFilters({ exclude_social: event.target.checked })} />
            <span>Exclude Social</span>
          </label>
        </>
      )}
      <label className="email-account-field">
        <span>Initial history</span>
        <select value={state.filters.max_age_days} onChange={event => updateFilters({ max_age_days: Number(event.target.value) })}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </label>
    </div>
  );
}

function PriorityStep({ state, setState }: {
  state: EmailWizardState;
  setState: (patch: Partial<EmailWizardState>) => void;
}) {
  const config = state.signal_config;
  return (
    <div className="email-priority-step">
      <div className="email-priority-band high"><strong>High signal</strong><span>Sent replies, active threads, VIPs, and starred mail · full context</span></div>
      <div className="email-priority-band medium"><strong>Useful context</strong><span>Direct mail and known contacts · concise excerpt</span></div>
      <div className="email-priority-band low"><strong>Background</strong><span>Newsletters and automation · metadata only</span></div>
      <label className="email-preference-row compact">
        <input
          type="checkbox"
          checked={config.skip_observe_low}
          onChange={event => setState({ signal_config: { ...config, skip_observe_low: event.target.checked } })}
        />
        <span>Do not teach Dream from low-signal email</span>
      </label>
    </div>
  );
}

function CadenceStep({ state, setState }: {
  state: EmailWizardState;
  setState: (patch: Partial<EmailWizardState>) => void;
}) {
  return (
    <div className="email-radio-list">
      {([
        ['poll_5m', 'Every 5 minutes'],
        ['poll_hour', 'Every hour'],
        ['manual', 'Manual only'],
      ] as const).map(([mode, label]) => (
        <label key={mode}>
          <input type="radio" name="email-cadence" checked={state.cadence.mode === mode} onChange={() => setState({ cadence: { ...state.cadence, mode } })} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function ScopeStep() {
  return (
    <div className="email-private-space">
      <ShieldCheck size={19} />
      <div><strong>Private provider space</strong><span>Email stays isolated from general workspace memory. Agents see it only if you explicitly grant this Email space.</span></div>
    </div>
  );
}

export function EmailConnectionModal({ token, open, providers, onClose, onCommitted, onProvidersChanged }: Props) {
  const googleConnected = providers?.google?.status === 'active';
  const icloudConnected = providers?.icloud?.status === 'active';
  const initialState: EmailWizardState = {
    provider: googleConnected ? 'google' : icloudConnected ? 'icloud' : null,
    google_connected: googleConnected,
    icloud_connected: icloudConnected,
    icloud_reconnect: false,
    google_client_id: '',
    google_client_secret: '',
    icloud_email: providers?.icloud?.account_email ?? '',
    icloud_username: '',
    icloud_app_password: '',
    filters: { ...DEFAULT_GMAIL_FILTERS, include_inbox: true, include_sent: true },
    signal_config: { ...DEFAULT_GMAIL_SIGNAL_CONFIG },
    cadence: { ...DEFAULT_CADENCE_GMAIL },
    scope_routing: { ...DEFAULT_SCOPE_ROUTING },
  };

  const steps: WizardStep<EmailWizardState>[] = [
    {
      id: 'provider',
      title: 'Service',
      subtitle: 'Choose the service that hosts your email.',
      render: ({ state, setState }) => <ProviderStep state={state} setState={setState} />,
      canAdvance: state => state.provider !== null,
    },
    {
      id: 'account',
      title: 'Account',
      subtitle: 'Sign in directly with your email service.',
      render: ({ state, setState }) => (
        <AccountStep state={state} setState={setState} token={token} onProvidersChanged={onProvidersChanged} />
      ),
      canAdvance: state => state.provider === 'google'
        ? state.google_connected
        : (state.icloud_connected && !state.icloud_reconnect)
          || (state.icloud_email.includes('@') && state.icloud_app_password.trim().length >= 8),
    },
    {
      id: 'mailboxes',
      title: 'Learning',
      subtitle: 'Sent mail carries your strongest personal signal.',
      render: ({ state, setState }) => <MailboxStep state={state} setState={setState} />,
      canAdvance: state => state.filters.include_inbox || state.filters.include_sent,
    },
    {
      id: 'priority',
      title: 'Signal',
      subtitle: 'Keep useful conversations rich and routine mail lightweight.',
      render: ({ state, setState }) => <PriorityStep state={state} setState={setState} />,
    },
    {
      id: 'cadence',
      title: 'Cadence',
      subtitle: 'How often should Pod look for new mail?',
      render: ({ state, setState }) => <CadenceStep state={state} setState={setState} />,
    },
    {
      id: 'confirm',
      title: 'Review',
      subtitle: 'Pod will learn from conversations, not copy your whole inbox into memory.',
      render: ({ state }) => (
        <div className="email-review-step">
          <ScopeStep />
          <dl className="wizard-confirm-grid">
            <div className="wizard-confirm-row"><dt>Email service</dt><dd>{state.provider === 'google' ? 'Gmail' : 'iCloud Mail'}</dd></div>
            <div className="wizard-confirm-row"><dt>Learning</dt><dd>{[state.filters.include_sent && 'Sent', state.filters.include_inbox && 'Inbox'].filter(Boolean).join(' + ')}</dd></div>
            <div className="wizard-confirm-row"><dt>History</dt><dd>Last {state.filters.max_age_days} days</dd></div>
            <div className="wizard-confirm-row"><dt>Storage</dt><dd>Private provider space</dd></div>
          </dl>
        </div>
      ),
    },
  ];

  return (
    <ConnectionWizard
      open={open}
      title="Connect Email"
      subtitle="Choose your email service to start a private, read-only connection."
      headerIcon={<Mail size={20} />}
      steps={steps}
      initialState={initialState}
      commitLabel="Connect Email"
      commitBusyLabel="Checking account…"
      onCommit={async state => {
        if (!state.provider) throw new Error('Choose an email service.');
        const policy = {
          filters: state.filters,
          cadence: state.cadence,
          scope_routing: state.scope_routing,
          signal_config: state.signal_config,
        };
        const service = state.provider === 'google' ? 'gmail' : 'icloud-mail';
        await postJson(`/integrations/${service}/configure`, token, state.provider === 'google'
          ? policy
          : {
              ...policy,
              account_email: state.icloud_email.trim(),
              username: state.icloud_username.trim() || state.icloud_email.trim(),
              app_password: state.icloud_app_password,
            });
        void postJson('/pod/sync', token, { services: [service] }).catch(() => undefined);
        onCommitted();
      }}
      onClose={onClose}
    />
  );
}
