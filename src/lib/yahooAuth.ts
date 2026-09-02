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

// ---------------------------------------------------------------------------
// Live draft sync via Yahoo login — lets you (or any of your league mates,
// each on their own device/browser) log into your own Yahoo account and
// have the app pull draft picks directly from Yahoo's Fantasy API, no
// Chrome extension required. This covers a real Yahoo league you belong
// to; Yahoo's public Mock Draft Lobby isn't exposed via their official API
// (see netlify/functions/yahoo-draft-picks.js for why), so it isn't
// covered by this path.

const TOKENS_KEY = 'ffdk-yahoo-tokens';

interface StoredYahooTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // ms epoch
}

function getStoredTokens(): StoredYahooTokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredYahooTokens) : null;
  } catch {
    return null;
  }
}

function storeTokens(tokens: StoredYahooTokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function clearYahooTokens(): void {
  localStorage.removeItem(TOKENS_KEY);
}

export function hasStoredYahooTokens(): boolean {
  return getStoredTokens() !== null;
}

/** Exchanges an auth code for an access+refresh token pair and persists them locally. */
export async function connectYahooAndStoreTokens(code: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/yahoo/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const json = await res.json();
  if (!res.ok) return { ok: false, error: json.error ?? `Token exchange responded ${res.status}` };
  storeTokens({
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 30_000, // 30s safety margin
  });
  return { ok: true };
}

/** Returns a valid access token, transparently refreshing it if it's expired
 * or about to expire. Returns null if there's no stored session or refresh
 * fails (e.g. the user revoked access) — callers should treat that as
 * "not connected" rather than throwing. */
export async function getValidYahooAccessToken(): Promise<string | null> {
  const tokens = getStoredTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expiresAt) return tokens.accessToken;
  if (!tokens.refreshToken) return null;

  try {
    const res = await fetch('/api/yahoo/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    const json = await res.json();
    if (!res.ok) return null;
    storeTokens({
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? tokens.refreshToken,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 - 30_000,
    });
    return json.access_token;
  } catch {
    return null;
  }
}

export interface YahooLeagueSummary {
  leagueKey: string;
  name: string;
  numTeams?: number;
  draftStatus?: string;
  myTeamKey?: string;
  myTeamName?: string;
}

/** Lists the NFL leagues the connected Yahoo account belongs to this season. */
export async function fetchMyYahooLeagues(accessToken: string): Promise<YahooLeagueSummary[]> {
  const res = await fetch('/api/yahoo/leagues', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Leagues lookup responded ${res.status}`);
  return json.leagues ?? [];
}

export interface YahooDraftPick {
  pickNumber: number;
  round: number;
  teamKey: string;
  playerKey: string;
  playerName: string;
  playerTeam: string | null;
  playerPosition: string | null;
}

/** Pulls the current draft results for one league — safe to call repeatedly
 * while a draft is in progress; returns whatever picks have happened so far. */
export async function fetchYahooDraftPicks(
  accessToken: string,
  leagueKey: string
): Promise<{ draftStatus: string; picks: YahooDraftPick[] }> {
  const res = await fetch('/api/yahoo/draft-picks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken, leagueKey }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Draft picks lookup responded ${res.status}`);
  return json;
}
