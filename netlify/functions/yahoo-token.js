// Netlify Functions equivalent of api/yahoo/token.js (Vercel). Same
// environment variables required: YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET,
// YAHOO_REDIRECT_URI. Set via `netlify env:set NAME value` or the Netlify
// dashboard (Site configuration -> Environment variables).
//
// Handles both the initial code exchange (grant_type=authorization_code)
// and refreshing an expired access token (grant_type=refresh_token) — a
// live draft can run well past a token's ~1hr lifetime, so the client
// calls back here with the refresh_token to keep syncing without asking
// the user to log in again.
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { code, refreshToken } = JSON.parse(event.body || '{}');
  const { YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET, YAHOO_REDIRECT_URI } = process.env;

  if (!YAHOO_CONSUMER_KEY || !YAHOO_CONSUMER_SECRET) {
    return {
      statusCode: 501,
      body: JSON.stringify({
        error:
          'Yahoo OAuth is not configured on this deployment. Set YAHOO_CONSUMER_KEY / YAHOO_CONSUMER_SECRET / YAHOO_REDIRECT_URI, or skip Yahoo sync — the app works fully with the built-in league scoring.',
      }),
    };
  }
  if (!code && !refreshToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing authorization code or refresh token' }) };
  }

  try {
    const basicAuth = Buffer.from(`${YAHOO_CONSUMER_KEY}:${YAHOO_CONSUMER_SECRET}`).toString('base64');
    const redirectUri = YAHOO_REDIRECT_URI || `https://${event.headers.host}/api/yahoo/callback`;
    const body = refreshToken
      ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, redirect_uri: redirectUri })
      : new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: redirectUri, code });

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: `Yahoo token exchange failed: ${text}` }) };
    }

    const tokenJson = await tokenRes.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        expires_in: tokenJson.expires_in,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
