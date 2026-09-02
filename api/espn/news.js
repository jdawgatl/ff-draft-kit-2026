// Vercel serverless function: proxies ESPN's public (but unofficial /
// undocumented) NFL news feed. No key required. Routed through our own
// serverless function rather than called directly from the browser so a
// CORS failure or an ESPN outage never surfaces as a broken fetch in the
// UI, and so it's easy to swap the upstream URL in one place if ESPN
// changes something.
//
// NOTE: this endpoint is not an officially published/supported ESPN API —
// it's the same internal endpoint espn.com's own website calls, widely
// used by the hobbyist fantasy-sports community, but it can change or stop
// working at any time with no notice. This feature degrades gracefully:
// if the fetch fails, the client just shows no ESPN headlines and
// continues working normally otherwise.

const NEWS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50';

export default async function handler(req, res) {
  try {
    const espnRes = await fetch(NEWS_URL);
    if (!espnRes.ok) throw new Error(`ESPN responded ${espnRes.status}`);
    const data = await espnRes.json();

    const articles = (data.articles || []).map((a) => ({
      headline: a.headline,
      description: a.description,
      published: a.published,
      links: a.links?.web?.href,
      categories: (a.categories || []).map((c) => c.description || c.type).filter(Boolean),
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ articles });
  } catch (err) {
    res.status(502).json({ error: err.message, articles: [] });
  }
}
