/**
 * Surfaces the MCP backend's health at a glance — whether Docker is
 * reachable and integration tools are available for agents.
 *
 * Containers start on-demand when an agent first calls a tool, so
 * there's nothing the user needs to "pre-warm" manually. This banner
 * only surfaces problems (Docker missing, MCP disabled) and confirms
 * readiness otherwise.
 *
 * Self-contained: just drop into ConnectionsView with <McpHealthBanner token={...} />.
 * Polls every 60s and refreshes on window focus.
 */

import * as React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { getJson } from './api';

interface McpProviderHealth {
  id: string;
  image_ref: string;
  image_present: boolean;
  container_running: boolean;
}

interface McpBackendHealth {
  mcp_enabled: boolean;
  docker_reachable: boolean;
  docker_error: string | null;
  providers: McpProviderHealth[];
}

export function McpHealthBanner({ token }: { token: string }) {
  const [health, setHealth] = React.useState<McpBackendHealth | null>(null);

  const load = React.useCallback(async () => {
    try {
      setHealth(await getJson<McpBackendHealth>('/pod/mcp/health', token));
    } catch {/* leave previous state */}
  }, [token]);

  React.useEffect(() => {
    void load();
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(load, 60_000);
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(id); };
  }, [load]);

  const openSettings = () => {
    window.dispatchEvent(new CustomEvent('pod:open-settings', { detail: { section: 'developers' } }));
  };

  if (!health) return null;

  // Off → amber notice
  if (!health.mcp_enabled) {
    return (
      <div className="mcp-health-banner mcp-health-banner-disabled">
        <AlertTriangle size={14} />
        <span><strong>MCP backend is off.</strong> Enable it in settings to allow agents to use integration tools.</span>
        <Button size="sm" variant="outline" onClick={openSettings} className="mcp-health-banner-action">
          <Settings size={12} /> Settings
        </Button>
      </div>
    );
  }

  // Docker unreachable → friendly error with action
  if (!health.docker_reachable) {
    return (
      <div className="mcp-health-banner mcp-health-banner-error">
        <AlertTriangle size={14} />
        <span><strong>Docker is not running.</strong> Start Docker or Colima to enable agent tool calls.</span>
        <Button size="sm" variant="outline" onClick={openSettings} className="mcp-health-banner-action">
          <Settings size={12} /> Settings
        </Button>
      </div>
    );
  }

  // Ready — simple confirmation, no container internals
  const total = health.providers.length;
  const active = health.providers.filter(p => p.container_running).length;

  return (
    <div className="mcp-health-banner mcp-health-banner-ready">
      <Activity size={14} className="mcp-health-banner-icon-ok" />
      <span>
        Agent tools ready
        {total > 0 && <span className="mcp-health-banner-hint"> · {total} integration{total === 1 ? '' : 's'} available</span>}
      </span>
      {active === total && total > 0 ? (
        <Badge variant="outline" className="mcp-health-banner-badge"><CheckCircle2 size={10} /> All active</Badge>
      ) : (
        <Badge variant="outline" className="mcp-health-banner-badge">
          {active > 0 ? `${active} active` : 'On standby'}
        </Badge>
      )}
      <button onClick={openSettings} className="mcp-health-banner-gear" title="Agent tool settings" aria-label="Agent tool settings">
        <Settings size={13} />
      </button>
    </div>
  );
}
