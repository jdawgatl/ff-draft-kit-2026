// Vercel serverless function: proxies ESPN's public (but unofficial /
// undocumented) team-roster endpoint, used to resolve player headshots for
// the player detail drawer. See api/espn/news.js for the general caveats —
// same unofficial-endpoint class, same graceful-degradation contract: if
// this fails or a player isn't found, the client falls back to a generated
// initials avatar rather than showing a broken image.
//
// Query params: teamId (ESPN's internal numeric team id — see
// src/lib/espnHeadshots.ts for the abbreviation -> id map).
//
// ESPN's roster response nests athletes under position groups
// (offense/defense/specialTeam), each with an `items` array, rather than a
// single flat list — this parses defensively so a shape change degrades to
// an empty roster (client falls back to avatars) instead of throwing.

export default async function handler(req, res) {
  const teamId = String(req.query?.teamId || '').replace(/[^0-9]/g, '');
  if (!teamId) {
    res.status(400).json({ error: 'Missing teamId', athletes: [] });
    return;
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
    // Some responses may already be a flat athlete list rather than grouped.
    if (flat.length === 0 && groups.length && groups[0]?.fullName) flat.push(...groups);

    const athletes = flat
      .filter((a) => a && (a.fullName || a.displayName))
      .map((a) => ({
        fullName: a.fullName || a.displayName,
        headshot: a.headshot?.href || null,
      }));

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({ athletes });
  } catch (err) {
    res.status(502).json({ error: err.message, athletes: [] });
  }
}
