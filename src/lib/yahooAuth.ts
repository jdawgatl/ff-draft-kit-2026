// Yahoo Fantasy Sports OAuth2 helper.
//
// SECURITY NOTE: Yahoo's OAuth2 token exchange requires a Consumer Secret,
// which must never be shipped in client-side (extension or web) code. This
// module only builds the authorization URL and hands the returned `code`
// to a small serverless token-exchange endpoint (see /api/yahoo/token.ts)
// that holds the secret server-side as an environment variable. If that
// endpoint isn't deployed/configured, the app simply falls back to the
// hardcoded league scoring rules — nothing here is required for the app
// to function.

declare const chrome: any;

export interface YahooOAuthConfig {
  consumerKey: string;
  redirectUri?: string; // web app only; extension uses chrome.identity's redirect URL
}

const YAHOO_AUTH_BASE = 'https://api.login.yahoo.com/oauth2/request_auth';

export function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome?.identity;
}

export function buildAuthUrl(config: YahooOAuthConfig, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.consumerKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    language: 'en-us',
  });
  return `${YAHOO_AUTH_BASE}?${params.toString()}`;
}

export interface YahooAuthResult {
  ok: boolean;
  code?: string;
  error?: string;
}

/**
 * Launches the Yahoo consent screen. In the Chrome extension, this uses
 * chrome.identity.launchWebAuthFlow (no popup blockers, no redirect page
 * needed). In the standalone web app, it opens a popup pointed at your
 * deployed /api/yahoo/callback route, which should postMessage the code
 * back to window.opener.
 */
export async function startYahooOAuth(config: YahooOAuthConfig): Promise<YahooAuthResult> {
  if (!config.consumerKey) {
    return { ok: false, error: 'Missing Yahoo Consumer Key. Add it in Settings first.' };
  }

  if (isExtensionContext()) {
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = buildAuthUrl(config, redirectUri);
    return new Promise((resolve) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (responseUrl?: string) => {
        if (chrome.runtime.lastError || !responseUrl) {
          resolve({ ok: false, error: chrome.runtime.lastError?.message ?? 'OAuth flow was cancelled.' });
          return;
        }
        const url = new URL(responseUrl);
        const code = url.searchParams.get('code');
        if (!code) {
          resolve({ ok: false, error: 'No authorization code returned by Yahoo.' });
          return;
        }
        resolve({ ok: true, code });
      });
    });
  }

  // Web app fallback: popup + postMessage handshake with /api/yahoo/callback.
  const redirectUri = config.redirectUri ?? `${window.location.origin}/api/yahoo/callback`;
  const authUrl = buildAuthUrl(config, redirectUri);

  return new Promise((resolve) => {
    const popup = window.open(authUrl, 'yahoo-oauth', 'width=520,height=680');
    if (!popup) {
      resolve({ ok: false, error: 'Popup blocked — please allow popups for this site.' });
      return;
    }
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.source !== 'yahoo-oauth') return;
      window.removeEventListener('message', onMessage);
      popup?.close();
      if (e.data.code) resolve({ ok: true, code: e.data.code });
      else resolve({ ok: false, error: e.data.error ?? 'Authorization failed.' });
    }
    window.addEventListener('message', onMessage);
    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        window.removeEventListener('message', onMessage);
        resolve({ ok: false, error: 'Popup closed before completing sign-in.' });
      }
    }, 800);
  });
}

/** Exchanges an auth code for league settings via the server-side proxy. */
export async function fetchLeagueSettingsViaProxy(code: string, leagueKey?: string) {
  const res = await fetch('/api/yahoo/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, leagueKey }),
  });
  if (!res.ok) throw new Error(`Settings proxy responded ${res.status}`);
  return res.json();
}
