import type { ConnectorEnv } from '../config.js';
import { readIntegrationConfig, writeIntegrationConfig } from '../integration-config.js';
import { getIntegration } from '../integration-registry.js';

const REFRESH_SKEW_MS = 60_000;

interface ProviderTokenEndpoint {
  tokenUrl: string;
}

const TOKEN_ENDPOINTS: Record<string, ProviderTokenEndpoint> = {
  'google-drive': { tokenUrl: 'https://oauth2.googleapis.com/token' },
  'google-calendar': { tokenUrl: 'https://oauth2.googleapis.com/token' },
  gmail: { tokenUrl: 'https://oauth2.googleapis.com/token' },
  github: { tokenUrl: 'https://github.com/login/oauth/access_token' },
  slack: { tokenUrl: 'https://slack.com/api/oauth.v2.access' },
  notion: { tokenUrl: 'https://api.notion.com/v1/oauth/token' },
  linear: { tokenUrl: 'https://api.linear.app/oauth/token' },
};

export class TokenRefreshError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

/**
 * Register a custom token endpoint for a provider at runtime.
 * Useful for apps that add their own OAuth providers beyond the default set.
 */
export function registerTokenEndpoint(serviceId: string, tokenUrl: string): void {
  TOKEN_ENDPOINTS[serviceId] = { tokenUrl };
}

export async function getFreshAccessToken(env: ConnectorEnv, serviceId: string): Promise<string> {
  const config = await readIntegrationConfig(env, serviceId);
  const accessToken = typeof config.access_token === 'string' ? config.access_token : undefined;
  const refreshToken = typeof config.refresh_token === 'string' ? config.refresh_token : undefined;
  const clientId = typeof config.client_id === 'string' ? config.client_id : undefined;
  const clientSecret = typeof config.client_secret === 'string' ? config.client_secret : undefined;
  const expiresAt = typeof config.expires_at === 'number' ? config.expires_at : undefined;

  if (!accessToken && !refreshToken) {
    throw new TokenRefreshError(`Integration ${serviceId} has no stored credentials — connect it first`);
  }

  const expired = expiresAt !== undefined && Date.now() + REFRESH_SKEW_MS >= expiresAt;
  if (accessToken && !expired) return accessToken;

  if (!refreshToken) {
    throw new TokenRefreshError(`Access token for ${serviceId} is expired and no refresh_token is available — reconnect`);
  }
  if (!clientId || !clientSecret) {
    throw new TokenRefreshError(`Cannot refresh ${serviceId}: client_id/client_secret missing from config`);
  }

  const endpoint = TOKEN_ENDPOINTS[serviceId];
  const oauth = getIntegration(serviceId)?.oauth;
  const tokenUrl = endpoint?.tokenUrl ?? oauth?.tokenUrl;
  if (!tokenUrl) {
    throw new TokenRefreshError(`No token refresh endpoint known for ${serviceId}`);
  }

  const tokenBody: Record<string, string> = {
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  if (oauth?.tokenClientAuth !== 'basic') {
    tokenBody.client_id = clientId;
    tokenBody.client_secret = clientSecret;
  }
  const headers: Record<string, string> = {
    'content-type': oauth?.tokenRequestFormat === 'json'
      ? 'application/json'
      : 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
  if (oauth?.tokenClientAuth === 'basic') {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: oauth?.tokenRequestFormat === 'json'
      ? JSON.stringify(tokenBody)
      : new URLSearchParams(tokenBody),
  });

  const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || typeof payload.access_token !== 'string') {
    const detail = typeof payload.error_description === 'string' ? payload.error_description
      : typeof payload.error === 'string' ? payload.error
      : `HTTP ${res.status}`;
    throw new TokenRefreshError(`Failed to refresh ${serviceId} token: ${detail}`, res.status);
  }

  const freshAccessToken = payload.access_token;
  config.access_token = freshAccessToken;
  if (typeof payload.expires_in === 'number') {
    config.expires_at = Date.now() + payload.expires_in * 1000;
  }
  // Some providers (Google) only return a refresh_token on first consent.
  if (typeof payload.refresh_token === 'string') {
    config.refresh_token = payload.refresh_token;
  }
  await writeIntegrationConfig(env, serviceId, config);
  return freshAccessToken;
}
