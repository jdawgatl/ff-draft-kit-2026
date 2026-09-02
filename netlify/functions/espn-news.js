// Netlify Functions equivalent of api/espn/news.js (Vercel). See that
// file's comments — same unofficial-endpoint caveats apply here.
const NEWS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50';

exports.handler = async () => {
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

    return {
      statusCode: 200,
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
      body: JSON.stringify({ articles }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message, articles: [] }) };
  }
};
