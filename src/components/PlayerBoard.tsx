import { useMemo, useState } from 'react';
import { Star, Search, AlertTriangle, TrendingDown, TrendingUp, Flame, Newspaper } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useDraftStore, selectAvailablePlayers, selectCurrentPick } from '../store/draftStore';
import type { Player, Position } from '../types';
import { POSITION_COLORS, TIER_COLORS, formatPick } from '../lib/format';

type PosFilter = 'ALL' | Position | 'STARRED';
type SortKey = 'rank' | 'adp' | 'points' | 'vorp' | 'ecr';

const TABS: { id: PosFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'QB', label: 'QB' },
  { id: 'RB', label: 'RB' },
  { id: 'WR', label: 'WR' },
  { id: 'TE', label: 'TE' },
  { id: 'K', label: 'K' },
  { id: 'DEF', label: 'DEF' },
  { id: 'STARRED', label: 'Starred' },
];

export default function PlayerBoard() {
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const draftedIds = useDraftStore((s) => s.draftedPlayerIds);
  const watchlist = useDraftStore((s) => s.watchlist);
  const teams = useDraftStore((s) => s.settings.teams);
  const toggleWatch = useDraftStore((s) => s.toggleWatch);
  const draftPlayer = useDraftStore((s) => s.draftPlayer);
  const setViewingPlayer = useDraftStore((s) => s.setViewingPlayer);
  const currentPick = useDraftStore(selectCurrentPick);
  const available = useDraftStore(useShallow(selectAvailablePlayers));

  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [showDraftedToo, setShowDraftedToo] = useState(false);

  const draftedSet = useMemo(() => new Set(draftedIds), [draftedIds]);
  const watchSet = useMemo(() => new Set(watchlist), [watchlist]);

  const rows = useMemo(() => {
    let list = showDraftedToo ? allPlayers : available;
    if (posFilter === 'STARRED') {
      list = list.filter((p) => watchSet.has(p.id));
    } else if (posFilter !== 'ALL') {
      list = list.filter((p) => p.position === posFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortKey) {
      case 'adp':
        sorted.sort((a, b) => a.adp - b.adp);
        break;
      case 'points':
        sorted.sort((a, b) => b.projectedPoints - a.projectedPoints);
        break;
      case 'vorp':
        sorted.sort((a, b) => b.vorp - a.vorp);
        break;
      case 'ecr':
        sorted.sort((a, b) => (a.expertRank ?? 9999) - (b.expertRank ?? 9999));
        break;
      default:
        sorted.sort((a, b) => a.overallRank - b.overallRank);
    }
    return sorted;
  }, [allPlayers, available, showDraftedToo, posFilter, query, sortKey, watchSet]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-3 py-2">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setPosFilter(t.id)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${
                posFilter === t.id
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player or team…"
              className="w-44 rounded-md border border-slate-700 bg-slate-900 py-1.5 pl-7 pr-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="rank">Sort: Custom Rank</option>
            <option value="adp">Sort: ADP</option>
            <option value="points">Sort: Proj. Points</option>
            <option value="vorp">Sort: VORP</option>
            <option value="ecr">Sort: Expert Rank (ECR)</option>
          </select>
          <label className="flex items-center gap-1 text-[11px] text-slate-400">
            <input type="checkbox" checked={showDraftedToo} onChange={(e) => setShowDraftedToo(e.target.checked)} />
            Show drafted
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-slate-950">
            <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wide text-slate-500">
              <th className="w-8 px-2 py-2"></th>
              <th className="px-2 py-2">Rk</th>
              <th className="px-2 py-2" title="FantasyPros consensus expert rank (needs API key in Settings)">ECR</th>
              <th className="px-2 py-2">Player</th>
              <th className="px-2 py-2">Pos</th>
              <th className="px-2 py-2">Team</th>
              <th className="px-2 py-2">Bye</th>
              <th className="px-2 py-2">Tier</th>
              <th className="px-2 py-2 text-right">Proj Pts</th>
              <th className="px-2 py-2 text-right">VORP</th>
              <th className="px-2 py-2 text-right">ADP</th>
              <th className="px-2 py-2">Flags</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <PlayerRow
                key={p.id}
                player={p}
                isDrafted={draftedSet.has(p.id)}
                isStarred={watchSet.has(p.id)}
                onToggleWatch={() => toggleWatch(p.id)}
                onDraft={() => draftPlayer(p.id)}
                onView={() => setViewingPlayer(p.id)}
                currentPickNumber={currentPick?.pickNumber ?? 1}
                teams={teams}
              />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-slate-500">
                  No players match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  isDrafted,
  isStarred,
  onToggleWatch,
  onDraft,
  onView,
  currentPickNumber,
  teams,
}: {
  player: Player;
  isDrafted: boolean;
  isStarred: boolean;
  onToggleWatch: () => void;
  onDraft: () => void;
  onView: () => void;
  currentPickNumber: number;
  teams: number;
}) {
  const reachDiff = player.adp - currentPickNumber;
  const isValue = -reachDiff >= 8;
  const isReach = reachDiff >= 8;

  return (
    <tr
      className={`border-b border-slate-900 hover:bg-slate-900/60 ${isDrafted ? 'opacity-40' : ''}`}
    >
      <td className="px-2 py-1.5">
        <button onClick={onToggleWatch} title="Toggle watchlist">
          <Star
            size={14}
            className={isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-600 hover:text-slate-400'}
          />
        </button>
      </td>
      <td className="px-2 py-1.5 tabular-nums text-slate-400">{player.overallRank}</td>
      <td className="px-2 py-1.5 tabular-nums text-slate-500">
        {player.expertRank != null ? (
          <span
            title={`FantasyPros consensus rank #${player.expertRank}${player.expertTier ? ` (Tier ${player.expertTier})` : ''}`}
            className={
              player.overallRank - player.expertRank <= -10
                ? 'text-orange-300'
                : player.overallRank - player.expertRank >= 10
                ? 'text-emerald-300'
                : 'text-slate-500'
            }
          >
            #{player.expertRank}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className="px-2 py-1.5 font-medium text-slate-100">
        <button onClick={onView} className="text-left hover:text-emerald-300 hover:underline">
          {player.name}
        </button>
        {player.injuryStatus && (
          <span className="ml-1.5 rounded bg-red-500/20 px-1 text-[9px] font-bold text-red-300">
            {player.injuryStatus}
          </span>
        )}
        {player.rookie && (
          <span className="ml-1.5 rounded bg-cyan-500/20 px-1 text-[9px] font-bold text-cyan-300">R</span>
        )}
        {player.trending === 'up' && (
          <span title={`Trending up on Sleeper waivers (${player.trendingCount ?? ''} adds, 24h)`}>
            <Flame size={11} className="ml-1 inline text-orange-400" />
          </span>
        )}
        {player.news?.[0] && (
          <span title={player.news.map((n) => `[${n.source}] ${n.headline}`).join('\n')}>
            <Newspaper size={11} className="ml-1 inline text-sky-400" />
          </span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${POSITION_COLORS[player.position]}`}>
          {player.position}{player.positionRank}
        </span>
      </td>
      <td className="px-2 py-1.5 text-slate-400">{player.team}</td>
      <td className="px-2 py-1.5 tabular-nums text-slate-400">{player.bye}</td>
      <td className={`px-2 py-1.5 font-semibold tabular-nums ${TIER_COLORS[player.tier]}`}>T{player.tier}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-200">{player.projectedPoints.toFixed(1)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-300">{player.vorp.toFixed(1)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-400">
        {formatPick(Math.round(player.adp), teams)}
      </td>
      <td className="px-2 py-1.5">
        {isValue && (
          <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
            <TrendingUp size={9} /> Value
          </span>
        )}
        {isReach && (
          <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
            <TrendingDown size={9} /> Reach
          </span>
        )}
        {player.tier <= 2 && (
          <span className="ml-1 inline-flex items-center gap-0.5 rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
            <AlertTriangle size={9} /> Elite
          </span>
        )}
      </td>
      <td className="px-2 py-1.5">
        {!isDrafted && (
          <button
            onClick={onDraft}
            className="rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
          >
            Draft
          </button>
        )}
      </td>
    </tr>
  );
}
