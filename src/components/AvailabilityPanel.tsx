import { useMemo } from 'react';
import { Radar } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import {
  useDraftStore,
  selectAvailablePlayers,
  selectCurrentPick,
  selectMyFuturePickNumbers,
  selectMockAvailablePlayers,
  selectMockCurrentPick,
  selectMockMyFuturePickNumbers,
} from '../store/draftStore';
import { survivalProbability } from '../lib/normal';
import { pct } from '../lib/format';

function labelFor(p: number): { text: string; cls: string; dot: string } {
  if (p > 0.7) return { text: 'Likely', cls: 'text-emerald-300', dot: 'bg-emerald-400' };
  if (p >= 0.4) return { text: 'Toss-up', cls: 'text-amber-300', dot: 'bg-amber-400' };
  return { text: 'Unlikely', cls: 'text-red-300', dot: 'bg-red-400' };
}

interface Props {
  mode?: 'live' | 'mock';
}

export default function AvailabilityPanel({ mode = 'live' }: Props) {
  const isMock = mode === 'mock';
  const watchlist = useDraftStore((s) => s.watchlist);
  const available = useDraftStore(useShallow(isMock ? selectMockAvailablePlayers : selectAvailablePlayers));
  const currentPick = useDraftStore(isMock ? selectMockCurrentPick : selectCurrentPick);
  const futurePicks = useDraftStore(useShallow(isMock ? selectMockMyFuturePickNumbers : selectMyFuturePickNumbers));

  const nextPick = futurePicks[1] ?? futurePicks[0] ?? null;

  const targets = useMemo(() => {
    const starred = available.filter((p) => watchlist.includes(p.id));
    const pool = starred.length
      ? starred
      : [...available].sort((a, b) => b.vorp - a.vorp).slice(0, 6);
    return pool.slice(0, 8);
  }, [available, watchlist]);

  if (!currentPick || nextPick == null) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <Radar size={15} className="text-sky-400" />
        Availability Forecaster
      </div>
      <p className="mb-2 text-[11px] text-slate-500">
        Odds each target survives to your next pick (#{nextPick}).
      </p>
      <div className="space-y-1.5">
        {targets.map((p) => {
          const prob = survivalProbability(p.adp, p.adpStdDev, nextPick);
          const lbl = labelFor(prob);
          return (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lbl.dot}`} />
              <span className="flex-1 truncate text-slate-200">{p.name}</span>
              <span className="w-16 text-right tabular-nums text-slate-400">{p.position}{p.positionRank}</span>
              <span className={`w-12 text-right font-semibold tabular-nums ${lbl.cls}`}>{pct(prob)}</span>
            </div>
          );
        })}
        {targets.length === 0 && <p className="text-xs text-slate-500">Star players to track them here.</p>}
      </div>
    </div>
  );
}
