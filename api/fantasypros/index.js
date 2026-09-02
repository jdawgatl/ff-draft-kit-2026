// Vercel serverless function: proxies the FantasyPros API
// (https://api.fantasypros.com/v2/docs) so the browser never needs CORS
// support from FantasyPros directly, and so the request is easy to cache /
// rate-limit centrally if you ever need to.
//
// The app uses ONE shared FantasyPros API key, baked in server-side as the
// FANTASYPROS_API_KEY environment variable, so individual users never need
// to request or paste in their own key. A client-supplied key is still
// honored as a fallback (useful for local dev without the env var set).
//
// IMPORTANT — FantasyPros' free tier is licensed for personal,
// non-commercial, non-production use. If this app is deployed for a wider
// audience than a private league, FantasyPros requires an active paid
// "Hall of Fame" subscription (their Premium API tier) or a separate
// commercial agreement. See README.md for details.

const BASE_URL = 'https://api.fantasypros.com/v2/json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { apiKey: clientKey, resource, sport = 'nfl', season, params = {} } = req.body || {};
  const apiKey = process.env.FANTASYPROS_API_KEY || clientKey;
  if (!apiKey) {
    res.status(400).json({ error: 'Missing FantasyPros API key.' });
    return;
  }
  if (!resource || !['rankings', 'projections', 'news'].includes(resource)) {
    res.status(400).json({ error: 'resource must be one of: rankings, projections, news' });
    return;
  }

  const year = season || new Date().getFullYear();
  let path;
  if (resource === 'rankings') path = `${sport}/${year}/consensus-rankings`;
  else if (resource === 'projections') path = `${sport}/${year}/projections`;
  else path = `${sport}/news`;

  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}/${path}${qs ? `?${qs}` : ''}`;

  try {
    const fpRes = await fetch(url, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
    if (!fpRes.ok) {
      const text = await fpRes.text();
      res.status(fpRes.status).json({ error: `FantasyPros API responded ${fpRes.status}: ${text.slice(0, 300)}` });
      return;
    }
    const data = await fpRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
