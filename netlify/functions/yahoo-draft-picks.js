// Polled by the client every few seconds while "Sync my live Yahoo draft"
// is on. Pulls the current draft results for one league (works whether the
// draft is in progress or finished — Yahoo's draftresults resource returns
// whatever picks have been made so far) and resolves each pick's
// player_key into a name/team/position the app's local player pool can
// match against, via league_key/draftresults, since Yahoo doesn't inline
// player names into draft picks by default.
//
// NOTE: this covers a real Yahoo league you're a member of. Yahoo's public
// "Mock Draft Lobby" (the anonymous practice-draft tool at
// football.fantasysports.yahoo.com/f1/mock_lobby) is a separate product
// that isn't exposed through the documented Fantasy Sports API — there's
// no league_key for it, so this endpoint can't reach it. If mock-lobby
// sync is wanted, the actual page's DOM would need to be watched instead
// (the same approach the Chrome extension already uses for a live draft
// room), not the official API.
const FANTASY_API_BASE = 'https://fantasysports.yahooapis.com/fantasy/v2';

function deepFindAll(node, pred, out = []) {
  if (node == null || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  for (const v of Object.values(node)) deepFindAll(v, pred, out);
  return out;
}
function deepFind(node, pred) {
  return deepFindAll(node, pred)[0];
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const { accessToken, leagueKey } = JSON.parse(event.body || '{}');
  if (!accessToken || !leagueKey) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken or leagueKey' }) };
  }

  try {
    const draftUrl = `${FANTASY_API_BASE}/league/${leagueKey}/draftresults?format=json`;
    const draftRes = await fetch(draftUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!draftRes.ok) {
      const text = await draftRes.text();
      return { statusCode: draftRes.status, body: JSON.stringify({ error: `Yahoo Fantasy API responded ${draftRes.status}: ${text.slice(0, 300)}` }) };
    }
    const draftData = await draftRes.json();

    const draftStatusNode = deepFind(draftData, (n) => typeof n.draft_status === 'string');
    const draftStatus = draftStatusNode?.draft_status ?? 'unknown';

    const pickNodes = deepFindAll(
      draftData,
      (n) => typeof n.pick === 'number' && typeof n.player_key === 'string' && typeof n.team_key === 'string'
    );

    if (pickNodes.length === 0) {
      return { statusCode: 200, body: JSON.stringify({ draftStatus, picks: [], raw: draftData }) };
    }

    // Resolve player names for every picked player_key in one batched call.
    const playerKeys = [...new Set(pickNodes.map((p) => p.player_key))];
    const playersUrl = `${FANTASY_API_BASE}/league/${leagueKey}/players;player_keys=${playerKeys.join(',')}?format=json`;
    const playersRes = await fetch(playersUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const playerByKey = new Map();
    if (playersRes.ok) {
      const playersData = await playersRes.json();
      const playerNodes = deepFindAll(playersData, (n) => typeof n.player_key === 'string' && n.name);
      for (const p of playerNodes) {
        playerByKey.set(p.player_key, {
          name: p.name?.full,
          team: p.editorial_team_abbr,
          position: p.display_position,
        });
      }
    }

    const picks = pickNodes
      .map((p) => {
        const info = playerByKey.get(p.player_key) ?? {};
        return {
          pickNumber: p.pick,
          round: p.round,
          teamKey: p.team_key,
          playerKey: p.player_key,
          playerName: info.name ?? null,
          playerTeam: info.team ?? null,
          playerPosition: info.position ?? null,
        };
      })
      .filter((p) => p.playerName)
      .sort((a, b) => a.pickNumber - b.pickNumber);

    return { statusCode: 200, body: JSON.stringify({ draftStatus, picks }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
