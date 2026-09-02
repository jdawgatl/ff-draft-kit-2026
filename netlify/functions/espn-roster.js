// Netlify Functions equivalent of api/espn/roster.js (Vercel). See that
// file's comments — same unofficial-endpoint caveats and graceful-fallback
// contract apply here.

exports.handler = async (event) => {
  const teamId = String(event.queryStringParameters?.teamId || '').replace(/[^0-9]/g, '');
  if (!teamId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing teamId', athletes: [] }) };
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster`;

  try {
    const espnRes = await fetch(url);
    if (!espnRes.ok) throw new Error(`ESPN responded ${espnRes.status}`);
    const data = await espnRes.json();

    const groups = Array.isArray(data.athletes) ? data.athletes : [];
    const flat = [];
    for (const group of groups) {
      const items = Array.isArray(group?.items) ? group.items : Array.isArray(group) ? group : [];
      for (const item of items) flat.push(item);
    }
    if (flat.length === 0 && groups.length && groups[0]?.fullName) flat.push(...groups);

    const athletes = flat
      .filter((a) => a && (a.fullName || a.displayName))
      .map((a) => ({
        fullName: a.fullName || a.displayName,
        headshot: a.headshot?.href || null,
      }));

    return {
      statusCode: 200,
      headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' },
      body: JSON.stringify({ athletes }),
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: err.message, athletes: [] }) };
  }
};
