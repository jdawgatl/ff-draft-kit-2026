// Netlify Functions equivalent of api/yahoo/token.js (Vercel). Same
// environment variables required: YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET,
// YAHOO_REDIRECT_URI. Set via `netlify env:set NAME value` or the Netlify
// dashboard (Site configuration -> Environment variables).
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { code } = JSON.parse(event.body || '{}');
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
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing authorization code' }) };
  }

  try {
    const basicAuth = Buffer.from(`${YAHOO_CONSUMER_KEY}:${YAHOO_CONSUMER_SECRET}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      redirect_uri: YAHOO_REDIRECT_URI || `https://${event.headers.host}/api/yahoo/callback`,
      code,
    });

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
      body: JSON.stringify({ access_token: tokenJson.access_token, expires_in: tokenJson.expires_in }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
