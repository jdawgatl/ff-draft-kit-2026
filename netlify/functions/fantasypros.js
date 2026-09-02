// Netlify Functions equivalent of api/fantasypros/index.js (Vercel). See
// that file for full comments on licensing/setup — same behavior here.
const BASE_URL = 'https://api.fantasypros.com/v2/json';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { apiKey: clientKey, resource, sport = 'nfl', season, params = {} } = JSON.parse(event.body || '{}');
  // Prefer the shared server-side key (baked in via Netlify env var) so
  // individual users don't need to obtain their own FantasyPros key. A
  // client-supplied key is still honored as a fallback/override.
  const apiKey = process.env.FANTASYPROS_API_KEY || clientKey;
  if (!apiKey) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing FantasyPros API key.' }) };
  }
  if (!resource || !['rankings', 'projections', 'news'].includes(resource)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'resource must be one of: rankings, projections, news' }) };
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
      return {
        statusCode: fpRes.status,
        body: JSON.stringify({ error: `FantasyPros API responded ${fpRes.status}: ${text.slice(0, 300)}` }),
      };
    }
    const data = await fpRes.json();
    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
