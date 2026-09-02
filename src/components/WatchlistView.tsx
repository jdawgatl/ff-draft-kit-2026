import { useMemo } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useDraftStore, selectCurrentPick, selectMyFuturePickNumbers } from '../store/draftStore';
import type { Player } from '../types';
import { POSITION_COLORS, pct } from '../lib/format';
import { survivalProbability } from '../lib/normal';

export default function WatchlistView() {
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const watchlist = useDraftStore((s) => s.watchlist);
  const draftedIds = useDraftStore((s) => s.liveDraftedPlayerIds);
  const toggleWatch = useDraftStore((s) => s.toggleWatch);
  const draftPlayer = useDraftStore((s) => s.liveDraftPlayer);
  const setViewingPlayer = useDraftStore((s) => s.setViewingPlayer);
  const currentPick = useDraftStore(selectCurrentPick);
  const futurePicks = useDraftStore(useShallow(selectMyFuturePickNumbers));
  const nextPick = futurePicks[0] ?? null;

  const players = useMemo(
    () =>
      (watchlist
        .map((id) => allPlayers.find((p) => p.id === id))
        .filter((p): p is Player => Boolean(p)))
        .sort((a, b) => a.overallRank - b.overallRank),
    [watchlist, allPlayers]
  );

  const draftedSet = new Set(draftedIds);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <Star size={15} className="fill-amber-400 text-amber-400" />
        Watchlist ({players.length})
      </div>
      <div className="space-y-1.5">
        {players.map((p) => {
          const drafted = draftedSet.has(p.id);
          const prob = nextPick != null ? survivalProbability(p.adp, p.adpStdDev, nextPick) : null;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2 ${drafted ? 'opacity-40' : ''}`}
            >
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${POSITION_COLORS[p.position]}`}>
                {p.position}{p.positionRank}
              </span>
              <button
                onClick={() => setViewingPlayer(p.id)}
                className="flex-1 truncate text-left text-sm font-medium text-slate-100 hover:text-emerald-300 hover:underline"
              >
                {p.name}
              </button>
              <span className="text-[10px] text-slate-500">{p.team} · Bye {p.bye}</span>
              <span className="w-16 text-right text-xs tabular-nums text-slate-300">{p.projectedPoints.toFixed(1)} pts</span>
              {prob != null && !drafted && (
                <span className="w-14 text-right text-[10px] tabular-nums text-sky-300">{pct(prob)} avail</span>
              )}
              {!drafted && currentPick?.isMyPick && (
                <button
                  onClick={() => draftPlayer(p.id)}
                  className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                >
                  Draft
                </button>
              )}
              <button onClick={() => toggleWatch(p.id)} title="Remove from watchlist">
                <Trash2 size={13} className="text-slate-600 hover:text-red-400" />
              </button>
            </div>
          );
        })}
        {players.length === 0 && (
          <p className="text-xs text-slate-500">
            Star players from the Draft Board to track them here during fast clock situations.
          </p>
        )}
      </div>
    </div>
  );
}
