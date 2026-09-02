// Vercel serverless function: proxies the FantasyPros API
// (https://api.fantasypros.com/v2/docs) so the browser never needs CORS
// support from FantasyPros directly, and so the request is easy to cache /
// rate-limit centrally if you ever need to.
//
// The user supplies their OWN FantasyPros API key (requested free for
// personal, non-commercial use at https://secure.fantasypros.com/api-keys/request/
// — see README.md → "FantasyPros API Setup"). The key is sent from the
// client with each request and is simply forwarded here; it is never
// stored server-side, so this function needs no environment variables to
// work in the free tier.
//
// IMPORTANT — FantasyPros' free tier is licensed for personal,
// non-commercial, non-production use. If you deploy this app for other
// people to use with their own accounts, each person should supply their
// own key (client-side, in Settings) rather than sharing one — and if you
// want this feature live in a shared/production deployment, FantasyPros
// requires an active paid "Hall of Fame" subscription (their Premium API
// tier) or a separate commercial agreement. See README.md for details.

const BASE_URL = 'https://api.fantasypros.com/v2/json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { apiKey, resource, sport = 'nfl', season, params = {} } = req.body || {};
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
