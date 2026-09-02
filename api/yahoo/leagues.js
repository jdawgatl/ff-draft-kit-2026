// Vercel serverless function equivalent of netlify/functions/yahoo-leagues.js.
// See that file for full comments — same behavior here.
const FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

function deepFindAll(node, pred, out = []) {
  if (node == null || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  for (const v of Object.values(node)) deepFindAll(v, pred, out);
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { accessToken } = req.body || {};
  if (!accessToken) {
    res.status(400).json({ error: 'Missing accessToken' });
    return;
  }

  try {
    const url = `${FANTASY_API_BASE}/users;use_login=1/games;game_keys=nfl/leagues/teams?format=json`;
    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!apiRes.ok) {
      const text = await apiRes.text();
      res.status(apiRes.status).json({ error: `Yahoo Fantasy API responded ${apiRes.status}: ${text.slice(0, 300)}` });
      return;
    }
    const data = await apiRes.json();

    const leagueNodes = deepFindAll(data, (n) => typeof n.league_key === 'string' && typeof n.name === 'string');
    const seen = new Set();
    const leagues = [];
    for (const node of leagueNodes) {
      if (seen.has(node.league_key)) continue;
      seen.add(node.league_key);
      const myTeam = deepFindAll(node, (n) => typeof n.team_key === 'string' && n.team_key.startsWith(node.league_key))[0];
      leagues.push({
        leagueKey: node.league_key,
        name: node.name,
        numTeams: node.num_teams != null ? Number(node.num_teams) : undefined,
        draftStatus: node.draft_status,
        myTeamKey: myTeam?.team_key,
        myTeamName: myTeam?.name,
      });
    }

    res.status(200).json({ leagues, raw: leagues.length === 0 ? data : undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
