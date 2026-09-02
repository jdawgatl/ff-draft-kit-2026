// Vercel serverless function equivalent of netlify/functions/yahoo-draft-picks.js.
// See that file for full comments (including the mock-lobby caveat) —
// same behavior here.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { accessToken, leagueKey } = req.body || {};
  if (!accessToken || !leagueKey) {
    res.status(400).json({ error: 'Missing accessToken or leagueKey' });
    return;
  }

  try {
    const draftUrl = `${FANTASY_API_BASE}/league/${leagueKey}/draftresults?format=json`;
    const draftRes = await fetch(draftUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!draftRes.ok) {
      const text = await draftRes.text();
      res.status(draftRes.status).json({ error: `Yahoo Fantasy API responded ${draftRes.status}: ${text.slice(0, 300)}` });
      return;
    }
    const draftData = await draftRes.json();

    const draftStatusNode = deepFind(draftData, (n) => typeof n.draft_status === 'string');
    const draftStatus = draftStatusNode?.draft_status ?? 'unknown';

    const pickNodes = deepFindAll(
      draftData,
      (n) => typeof n.pick === 'number' && typeof n.player_key === 'string' && typeof n.team_key === 'string'
    );

    if (pickNodes.length === 0) {
      res.status(200).json({ draftStatus, picks: [], raw: draftData });
      return;
    }

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

    res.status(200).json({ draftStatus, picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
