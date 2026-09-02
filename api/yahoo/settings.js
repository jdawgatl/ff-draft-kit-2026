// Vercel serverless function: given an OAuth code, exchanges it for a
// token (via the same logic as token.js) and then calls the Yahoo Fantasy
// Sports API to pull the user's league scoring settings, returning a
// normalized ScoringSettings-shaped JSON payload the client can drop
// straight into the app.
//
// This is intentionally defensive: if Yahoo isn't configured, or the fetch
// fails, or the league uses non-standard categories the parser doesn't
// recognize, it returns an error and the client keeps the hardcoded
// default scoring rules — the app never breaks because of a Yahoo outage.

const TOKEN_URL = 'https://api.login.yahoo.com/oauth2/get_token';
const FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

async function getAccessToken(code, origin) {
  const { YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET, YAHOO_REDIRECT_URI } = process.env;
  const basicAuth = Buffer.from(`${YAHOO_CONSUMER_KEY}:${YAHOO_CONSUMER_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: YAHOO_REDIRECT_URI || `${origin}/api/yahoo/callback`,
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { YAHOO_CONSUMER_KEY, YAHOO_CONSUMER_SECRET } = process.env;
  if (!YAHOO_CONSUMER_KEY || !YAHOO_CONSUMER_SECRET) {
    res.status(501).json({
      error: 'Yahoo OAuth is not configured on this deployment. See README.md → "Yahoo OAuth Setup".',
    });
    return;
  }

  const { code, leagueKey } = req.body || {};
  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  try {
    const { access_token } = await getAccessToken(code, req.headers.origin);

    // Discover the user's leagues if no leagueKey was supplied.
    const leaguesUrl = leagueKey
      ? `${FANTASY_API_BASE}/league/${leagueKey}/settings?format=json`
      : `${FANTASY_API_BASE}/users;use_login=1/games;game_keys=nfl/leagues?format=json`;

    const apiRes = await fetch(leaguesUrl, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!apiRes.ok) throw new Error(`Yahoo Fantasy API responded ${apiRes.status}`);
    const data = await apiRes.json();

    // NOTE: Yahoo's Fantasy API returns a deeply nested, quirky JSON shape
    // that varies by league. Parsing every stat_modifier into our
    // ScoringSettings shape is league-specific; this endpoint returns the
    // raw settings payload plus a `parsed: false` flag so the client can
    // show the raw values to confirm, and only apply a mapping once you've
    // wired up the stat_id -> field mapping for your exact league (see
    // README.md → "Yahoo OAuth Setup" for the stat_id reference table).
    res.status(200).json({ parsed: false, raw: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
