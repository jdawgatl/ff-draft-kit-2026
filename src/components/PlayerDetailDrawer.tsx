import { useEffect, useMemo, useState } from 'react';
import {
  X, Star, Flame, Newspaper, AlertTriangle, TrendingUp, Shield,
  Loader2, User, Moon, Link2,
} from 'lucide-react';
import { useDraftStore, selectCurrentPick, selectMockCurrentPick } from '../store/draftStore';
import type { Player } from '../types';
import { POSITION_COLORS, TIER_COLORS, formatPick, pct } from '../lib/format';
import { survivalProbability } from '../lib/normal';
import { getPlayerHeadshotUrl, getTeamLogoUrl } from '../lib/espnHeadshots';
import { isSleeper, buildHandcuffLeadNameMap } from '../lib/playerTags';

/** Turns a player's raw stat-line projection into a short, position-aware
 * list of human-readable stat bullets for the drawer's breakdown section. */
function statBreakdown(p: Player): { label: string; value: string }[] {
  const s = p.stats;
  const out: { label: string; value: string }[] = [];
  const n = (v: number | undefined) => Math.round(v ?? 0).toLocaleString();

  if (p.position === 'QB') {
    if (s.passYds) out.push({ label: 'Passing Yards', value: n(s.passYds) });
    if (s.passTd) out.push({ label: 'Passing TDs', value: n(s.passTd) });
    if (s.passInt) out.push({ label: 'Interceptions', value: n(s.passInt) });
    if (s.rushYds) out.push({ label: 'Rushing Yards', value: n(s.rushYds) });
    if (s.rushTd) out.push({ label: 'Rushing TDs', value: n(s.rushTd) });
  } else if (p.position === 'RB') {
    if (s.rushAtt) out.push({ label: 'Rush Attempts', value: n(s.rushAtt) });
    if (s.rushYds) out.push({ label: 'Rushing Yards', value: n(s.rushYds) });
    if (s.rushTd) out.push({ label: 'Rushing TDs', value: n(s.rushTd) });
    if (s.rec) out.push({ label: 'Receptions', value: n(s.rec) });
    if (s.recYds) out.push({ label: 'Receiving Yards', value: n(s.recYds) });
    if (s.recTd) out.push({ label: 'Receiving TDs', value: n(s.recTd) });
  } else if (p.position === 'WR' || p.position === 'TE') {
    if (s.targets) out.push({ label: 'Targets', value: n(s.targets) });
    if (s.rec) out.push({ label: 'Receptions', value: n(s.rec) });
    if (s.recYds) out.push({ label: 'Receiving Yards', value: n(s.recYds) });
    if (s.recTd) out.push({ label: 'Receiving TDs', value: n(s.recTd) });
    if (s.rushYds) out.push({ label: 'Rushing Yards', value: n(s.rushYds) });
  } else if (p.position === 'K') {
    const madeFg = (s.fg0_39 ?? 0) + (s.fg40_49 ?? 0) + (s.fg50plus ?? 0);
    if (madeFg) out.push({ label: 'Field Goals Made', value: n(madeFg) });
    if (s.fg50plus) out.push({ label: '50+ Yard FGs', value: n(s.fg50plus) });
    if (s.xpMade) out.push({ label: 'Extra Points', value: n(s.xpMade) });
  } else if (p.position === 'DEF') {
    if (s.defSacks) out.push({ label: 'Sacks', value: n(s.defSacks) });
    if (s.defInt) out.push({ label: 'Interceptions', value: n(s.defInt) });
    if (s.defFumRec) out.push({ label: 'Fumble Recoveries', value: n(s.defFumRec) });
    if (s.defTd) out.push({ label: 'Defensive/ST TDs', value: n(s.defTd) });
    if (s.pointsAllowedPerGame != null) {
      out.push({ label: 'Pts Allowed / Gm', value: s.pointsAllowedPerGame.toFixed(1) });
    }
  }
  return out;
}

function initials(name: string): string {
  const parts = name.replace(/[^a-zA-Z ]/g, '').trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export default function PlayerDetailDrawer() {
  const viewingPlayerId = useDraftStore((s) => s.viewingPlayerId);
  const viewingContext = useDraftStore((s) => s.viewingPlayerContext);
  const isMock = viewingContext === 'mock';
  const setViewingPlayer = useDraftStore((s) => s.setViewingPlayer);
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const handcuffLeadNameById = useMemo(() => buildHandcuffLeadNameMap(allPlayers), [allPlayers]);
  const draftedIds = useDraftStore((s) => (isMock ? s.mockDraftedPlayerIds : s.liveDraftedPlayerIds));
  const watchlist = useDraftStore((s) => s.watchlist);
  const toggleWatch = useDraftStore((s) => s.toggleWatch);
  const draftPlayer = useDraftStore((s) => (isMock ? s.mockDraftPlayer : s.liveDraftPlayer));
  const teams = useDraftStore((s) => s.settings.teams);
  const currentPick = useDraftStore(isMock ? selectMockCurrentPick : selectCurrentPick);

  const player = allPlayers.find((p) => p.id === viewingPlayerId) ?? null;

  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [headshotFailed, setHeadshotFailed] = useState(false);
  const [loadingHeadshot, setLoadingHeadshot] = useState(false);

  useEffect(() => {
    setHeadshotUrl(null);
    setHeadshotFailed(false);
    if (!player) return;

    if (player.position === 'DEF') {
      setHeadshotUrl(getTeamLogoUrl(player.team));
      return;
    }

    let cancelled = false;
    setLoadingHeadshot(true);
    getPlayerHeadshotUrl(player.name, player.team)
      .then((url) => {
        if (cancelled) return;
        if (url) setHeadshotUrl(url);
        else setHeadshotFailed(true);
      })
      .catch(() => {
        if (!cancelled) setHeadshotFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingHeadshot(false);
      });
    return () => {
      cancelled = true;
    };
  }, [player?.id, player?.name, player?.team, player?.position]);

  if (!player) return null;

  const isDrafted = draftedIds.includes(player.id);
  const isStarred = watchlist.includes(player.id);
  const stats = statBreakdown(player);
  const lowPick = Math.max(1, Math.round(player.adp - player.adpStdDev));
  const highPick = Math.round(player.adp + player.adpStdDev);
  const nextPickProb = currentPick
    ? survivalProbability(player.adp, player.adpStdDev, currentPick.pickNumber)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={() => setViewingPlayer(null)}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-800 bg-slate-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Player Detail{isMock && <span className="ml-1.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-300">Mock Draft</span>}
          </span>
          <button onClick={() => setViewingPlayer(null)} aria-label="Close" className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {/* Header: headshot + identity */}
          <div className="flex items-start gap-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              {headshotUrl && !headshotFailed ? (
                <img
                  src={headshotUrl}
                  alt={player.name}
                  className={player.position === 'DEF' ? 'h-full w-full object-contain p-2' : 'h-full w-full object-cover'}
                  onError={() => setHeadshotFailed(true)}
                />
              ) : loadingHeadshot ? (
                <div className="flex h-full w-full items-center justify-center">
                  <Loader2 size={18} className="animate-spin text-slate-600" />
                </div>
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-lg font-bold text-white ${
                    {
                      QB: 'from-rose-600 to-rose-800',
                      RB: 'from-emerald-600 to-emerald-800',
                      WR: 'from-sky-600 to-sky-800',
                      TE: 'from-amber-600 to-amber-800',
                      K: 'from-violet-600 to-violet-800',
                      DEF: 'from-slate-600 to-slate-800',
                    }[player.position]
                  }`}
                >
                  {player.position === 'DEF' ? <Shield size={26} /> : initials(player.name) || <User size={22} />}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold leading-tight text-slate-100">{player.name}</h2>
                <button onClick={() => toggleWatch(player.id)} title="Toggle watchlist" className="shrink-0">
                  <Star size={18} className={isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-600 hover:text-slate-400'} />
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${POSITION_COLORS[player.position]}`}>
                  {player.position}{player.positionRank}
                </span>
                <span className="text-xs text-slate-400">{player.team} · Bye {player.bye}</span>
                {player.injuryStatus && (
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                    {player.injuryStatus}
                  </span>
                )}
                {player.rookie && (
                  <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">Rookie</span>
                )}
                {player.trending === 'up' && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
                    <Flame size={9} /> Trending
                  </span>
                )}
                {isSleeper(player) && (
                  <span
                    title="Sleeper — our internal rank is well ahead of where he's actually being drafted (ADP), a likely value pick"
                    className="inline-flex items-center gap-0.5 rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold text-violet-300"
                  >
                    <Moon size={9} /> Sleeper
                  </span>
                )}
                {handcuffLeadNameById.get(player.id) && (
                  <span
                    title={`Handcuff for ${handcuffLeadNameById.get(player.id)} — the primary backup if he gets hurt`}
                    className="inline-flex items-center gap-0.5 rounded bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] font-bold text-fuchsia-300"
                  >
                    <Link2 size={9} /> Cuff for {handcuffLeadNameById.get(player.id)}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                <span>Rank <b className="text-slate-200">#{player.overallRank}</b></span>
                <span className={`font-semibold ${TIER_COLORS[player.tier]}`}>Tier {player.tier}</span>
                {player.expertRank != null && (
                  <span title="FantasyPros consensus expert rank">
                    ECR <b className="text-slate-200">#{player.expertRank}</b>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Key numbers */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Proj. Points</div>
              <div className="mt-0.5 text-base font-bold text-slate-100">{player.projectedPoints.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">VORP</div>
              <div className="mt-0.5 text-base font-bold text-slate-100">{player.vorp.toFixed(1)}</div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">ADP</div>
              <div className="mt-0.5 text-base font-bold text-slate-100">{formatPick(Math.round(player.adp), teams)}</div>
            </div>
          </div>

          {/* Draft range / availability */}
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/30 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <TrendingUp size={13} /> Estimated Draft Range
            </div>
            <p className="text-[11px] text-slate-500">
              Typically drafted between <b className="text-slate-300">{formatPick(lowPick, teams)}</b> and{' '}
              <b className="text-slate-300">{formatPick(highPick, teams)}</b>, based on consensus ADP ± spread.
            </p>
            {nextPickProb != null && currentPick && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                <b className="text-sky-300">{pct(nextPickProb)}</b> chance still available at the current pick
                ({formatPick(currentPick.pickNumber, teams)}).
              </p>
            )}
          </div>

          {/* Stat breakdown */}
          {stats.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-bold text-slate-300">Projected Stat Line</div>
              <div className="grid grid-cols-2 gap-1.5">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-2.5 py-1.5">
                    <span className="text-[10px] text-slate-500">{s.label}</span>
                    <span className="text-xs font-semibold tabular-nums text-slate-200">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* News */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Newspaper size={13} /> Recent News
            </div>
            {player.news?.length ? (
              <div className="space-y-1.5">
                {player.news.map((n, i) => (
                  <div key={i} className="rounded-md border border-slate-800 bg-slate-900/40 p-2.5">
                    <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-slate-500">
                      <span>{n.source}</span>
                      {n.category && <span>· {n.category}</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-300">{n.headline}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-600">
                No recent headlines. Use <b>Refresh Data</b> in the header to pull the latest injury reports and news.
              </p>
            )}
          </div>

          {player.tier <= 2 && (
            <div className="mt-4 flex items-center gap-1.5 rounded-md border border-red-800/30 bg-red-500/10 px-2.5 py-2 text-[11px] font-medium text-red-300">
              <AlertTriangle size={13} /> Elite tier — significant drop-off if this player is passed on.
            </div>
          )}

          {!isDrafted && (
            <button
              onClick={() => {
                draftPlayer(player.id);
                setViewingPlayer(null);
              }}
              className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Draft {player.name}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
