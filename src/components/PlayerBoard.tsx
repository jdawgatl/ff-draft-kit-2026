import { useMemo, useState } from 'react';
import { Star, Search, AlertTriangle, TrendingDown, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import {
  useDraftStore,
  selectAvailablePlayers,
  selectCurrentPick,
  selectMockAvailablePlayers,
  selectMockCurrentPick,
} from '../store/draftStore';
import type { Player, Position } from '../types';
import { POSITION_COLORS, TIER_COLORS, formatPick } from '../lib/format';
import { buildHandcuffLeadNameMap } from '../lib/playerTags';
import PlayerTags from './PlayerTags';

type PosFilter = 'ALL' | Position | 'STARRED';
type SortKey = 'rank' | 'ecr' | 'points' | 'vorp' | 'adp';

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

// Sensible default sort direction per column: rank/ecr/adp are "lower is
// better" (ascending), points/vorp are "higher is better" (descending).
const DEFAULT_DIR: Record<SortKey, 'asc' | 'desc'> = {
  rank: 'asc',
  ecr: 'asc',
  points: 'desc',
  vorp: 'desc',
  adp: 'asc',
};

interface Props {
  /** 'live' (default) tracks your real draft. 'mock' is the separate practice-draft tool. */
  mode?: 'live' | 'mock';
}

export default function PlayerBoard({ mode = 'live' }: Props) {
  const isMock = mode === 'mock';
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const handcuffLeadNameById = useMemo(() => buildHandcuffLeadNameMap(allPlayers), [allPlayers]);
  const draftedIds = useDraftStore((s) => (isMock ? s.mockDraftedPlayerIds : s.liveDraftedPlayerIds));
  const watchlist = useDraftStore((s) => s.watchlist);
  const teams = useDraftStore((s) => s.settings.teams);
  const toggleWatch = useDraftStore((s) => s.toggleWatch);
  const draftPlayer = useDraftStore((s) => (isMock ? s.mockDraftPlayer : s.liveDraftPlayer));
  const setViewingPlayer = useDraftStore((s) => s.setViewingPlayer);
  const currentPick = useDraftStore(isMock ? selectMockCurrentPick : selectCurrentPick);
  const available = useDraftStore(useShallow(isMock ? selectMockAvailablePlayers : selectAvailablePlayers));

  const [posFilter, setPosFilter] = useState<PosFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showDraftedToo, setShowDraftedToo] = useState(false);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(DEFAULT_DIR[key]);
    }
  }

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
    const dirMul = sortDir === 'asc' ? 1 : -1;
    switch (sortKey) {
      case 'adp':
        sorted.sort((a, b) => dirMul * (a.adp - b.adp));
        break;
      case 'points':
        sorted.sort((a, b) => dirMul * (a.projectedPoints - b.projectedPoints));
        break;
      case 'vorp':
        sorted.sort((a, b) => dirMul * (a.vorp - b.vorp));
        break;
      case 'ecr':
        sorted.sort((a, b) => dirMul * ((a.expertRank ?? 9999) - (b.expertRank ?? 9999)));
        break;
      default:
        sorted.sort((a, b) => dirMul * (a.overallRank - b.overallRank));
    }
    return sorted;
  }, [allPlayers, available, showDraftedToo, posFilter, query, sortKey, sortDir, watchSet]);

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
              <SortableHeader label="Rk" sortKey="rank" active={sortKey} dir={sortDir} onSort={handleSort} title="Custom rank from this app's projection model" />
              <SortableHeader
                label="ECR"
                sortKey="ecr"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
                title="FantasyPros consensus expert rank (needs API key in Settings)"
              />
              <th className="px-2 py-2">Player</th>
              <th className="px-2 py-2">Pos</th>
              <th className="px-2 py-2">Team</th>
              <th className="px-2 py-2">Bye</th>
              <th className="px-2 py-2">Tier</th>
              <SortableHeader label="Proj Pts" sortKey="points" active={sortKey} dir={sortDir} onSort={handleSort} align="right" title="Projected fantasy points for the full season under your league's scoring" />
              <SortableHeader
                label="VORP"
                sortKey="vorp"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
                align="right"
                title="Value Over Replacement Player: projected points above a freely-available replacement at the same position. Higher = more valuable relative to your other draft options, not just in raw points."
              />
              <SortableHeader label="ADP" sortKey="adp" active={sortKey} dir={sortDir} onSort={handleSort} align="right" title="Consensus average draft position" />
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
                onView={() => setViewingPlayer(p.id, mode)}
                currentPickNumber={currentPick?.pickNumber ?? 1}
                teams={teams}
                handcuffLeadName={handcuffLeadNameById.get(p.id)}
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

function SortableHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align = 'left',
  title,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
  title?: string;
}) {
  const isActive = active === sortKey;
  return (
    <th className={`px-2 py-2 ${align === 'right' ? 'text-right' : 'text-left'}`} title={title}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-0.5 whitespace-nowrap hover:text-slate-200 ${
          isActive ? 'text-emerald-300' : 'text-slate-500'
        }`}
      >
        {align === 'right' && isActive && (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
        {label}
        {align === 'left' && isActive && (dir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    </th>
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
  handcuffLeadName,
}: {
  player: Player;
  isDrafted: boolean;
  isStarred: boolean;
  onToggleWatch: () => void;
  onDraft: () => void;
  onView: () => void;
  currentPickNumber: number;
  teams: number;
  handcuffLeadName?: string;
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
        <PlayerTags player={player} handcuffLeadName={handcuffLeadName} />
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
      <td className="px-2 py-1.5 text-right tabular-nums text-slate-300" title="Value Over Replacement Player">
        {player.vorp.toFixed(1)}
      </td>
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
