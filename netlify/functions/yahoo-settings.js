// Netlify Functions equivalent of api/yahoo/settings.js (Vercel). See that
// file's comments for the full explanation — this pulls the raw league
// settings JSON from Yahoo's Fantasy API after a server-side token exchange.
const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

async function getAccessToken(code, host) {
  const { YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET, YAHOO_REDIRECT_URI } = process.env;
  const basicAuth = Buffer.from(`${YAHOO_CONSUMER_KEY}:${YAHOO_CONSUMER_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: YAHOO_REDIRECT_URI || `https://${host}/api/yahoo/callback`,
    code,
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed (${tokenRes.status})`);
  return tokenRes.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET } = process.env;
  if (!YAHOO_CONSUMER_KEY || !YAHOO_CONSUMER_SECRET) {
    return {
      statusCode: 501,
      body: JSON.stringify({ error: 'Yahoo OAuth is not configured on this deployment. See README.md → "Yahoo OAuth Setup".' }),
    };
  }

  const { code, leagueKey } = JSON.parse(event.body || '{}');
  if (!code) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing authorization code' }) };
  }

  try {
    const { access_token } = await getAccessToken(code, event.headers.host);
    const leaguesUrl = leagueKey
      ? `${FANTASY_API_BASE}/league/${leagueKey}/settings?format=json`
      : `${FANTASY_API_BASE}/users;use_login=1/games;game_keys=nfl/leagues?format=json`;

    const apiRes = await fetch(leaguesUrl, { headers: { Authorization: `Bearer ${access_token}` } });
    if (!apiRes.ok) throw new Error(`Yahoo Fantasy API responded ${apiRes.status}`);
    const data = await apiRes.json();

    return { statusCode: 200, body: JSON.stringify({ parsed: false, raw: data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
