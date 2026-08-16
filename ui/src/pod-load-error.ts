export function podLoadErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);

  if (/\b401\b|unauthori[sz]ed|session expired|token required/i.test(detail)) {
    return 'The web app reached a Pod service, but it rejected the connection. Your stored data has not been removed.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(detail)) {
    return 'The Pod data service is unavailable. Start the web API and try again.';
  }
  return 'Pod could not load your data. Your stored data has not been removed.';
}
