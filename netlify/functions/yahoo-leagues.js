// Lists the NFL fantasy leagues the logged-in Yahoo user belongs to this
// season, plus which team is theirs in each — so the app can offer a
// league picker for live draft sync instead of requiring a hand-typed
// league key.
//
// Yahoo's Fantasy API returns a deeply nested, XML-derived JSON shape that
// isn't consistent enough to index positionally (array indices and key
// names shift by league/response). Rather than hardcode a path, this walks
// the whole response looking for objects that carry the fields we need.
const FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

function deepFindAll(node, pred, out = []) {
  if (node == null || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  for (const v of Object.values(node)) deepFindAll(v, pred, out);
  return out;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { accessToken } = JSON.parse(event.body || '{}');
  if (!accessToken) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken' }) };
  }

  try {
    // `users;use_login=1` scopes everything under it to the authenticated
    // user's own leagues/teams — any team_key found here is theirs.
    const url = `${FANTASY_API_BASE}/users;use_login=1/games;game_keys=nfl/leagues/teams?format=json`;
    const apiRes = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!apiRes.ok) {
      const text = await apiRes.text();
      return { statusCode: apiRes.status, body: JSON.stringify({ error: `Yahoo Fantasy API responded ${apiRes.status}: ${text.slice(0, 300)}` }) };
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

    return { statusCode: 200, body: JSON.stringify({ leagues, raw: leagues.length === 0 ? data : undefined }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
