// Vercel serverless function: exchanges a Yahoo OAuth2 authorization code
// (or refreshes an existing token) for an access token. Holds
// YAHOO_CONSUMER_SECRET server-side only — never expose it in the
// extension or web client bundle.
//
// Required environment variables (set in Vercel Project Settings ->
// Environment Variables, or `netlify env:set` if deploying to Netlify):
//   YAHOO_CONSUMER_KEY
//   YAHOO_CONSUMER_SECRET
//   YAHOO_REDIRECT_URI   (must exactly match the Callback URL registered
//                          on developer.yahoo.com, e.g.
//                          https://your-app.vercel.app/api/yahoo/callback)
//
// Handles both grant_type=authorization_code (first login) and
// grant_type=refresh_token (keeping a live-draft sync session alive past
// the ~1hr access token lifetime without re-prompting the user to log in).

const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, refreshToken } = req.body || {};
  const { YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET, YAHOO_REDIRECT_URI } = process.env;

  if (!YAHOO_CONSUMER_KEY || !YAHOO_CONSUMER_SECRET) {
    res.status(501).json({
      error:
        'Yahoo OAuth is not configured on this deployment. Set YAHOO_CONSUMER_KEY / YAHOO_CONSUMER_SECRET / YAHOO_REDIRECT_URI, or skip Yahoo sync — the app works fully with the built-in league scoring.',
    });
    return;
  }
  if (!code && !refreshToken) {
    res.status(400).json({ error: 'Missing authorization code or refresh token' });
    return;
  }

  try {
    const basicAuth = Buffer.from(`${YAHOO_CONSUMER_KEY}:${YAHOO_CONSUMER_SECRET}`).toString('base64');
    const redirectUri = YAHOO_REDIRECT_URI || `${req.headers.origin}/api/yahoo/callback`;
    const body = refreshToken
      ? new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, redirect_uri: redirectUri })
      : new URLSearchParams({ grant_type: 'authorization_code', redirect_uri: redirectUri, code });

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      res.status(502).json({ error: `Yahoo token exchange failed: ${text}` });
      return;
    }

    const tokenJson = await tokenRes.json();
    res.status(200).json({
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_in: tokenJson.expires_in,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
