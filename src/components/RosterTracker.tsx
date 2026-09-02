import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useDraftStore, selectMyRoster } from '../store/draftStore';
import type { Player, Position } from '../types';
import { POSITION_COLORS } from '../lib/format';

const STARTER_ORDER: { slot: string; positions: Position[] }[] = [
  { slot: 'QB', positions: ['QB'] },
  { slot: 'RB', positions: ['RB'] },
  { slot: 'RB', positions: ['RB'] },
  { slot: 'WR', positions: ['WR'] },
  { slot: 'WR', positions: ['WR'] },
  { slot: 'TE', positions: ['TE'] },
  { slot: 'FLEX', positions: ['RB', 'WR', 'TE'] },
  { slot: 'FLEX', positions: ['RB', 'WR', 'TE'] },
  { slot: 'K', positions: ['K'] },
  { slot: 'DEF', positions: ['DEF'] },
];

export default function RosterTracker() {
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const myRosterIds = useDraftStore(useShallow(selectMyRoster));
  const setViewingPlayer = useDraftStore((s) => s.setViewingPlayer);

  const roster = useMemo(
    () => myRosterIds.map((id) => allPlayers.find((p) => p.id === id)).filter(Boolean) as Player[],
    [myRosterIds, allPlayers]
  );

  const { starters, bench } = useMemo(() => {
    const pool = [...roster].sort((a, b) => b.projectedPoints - a.projectedPoints);
    const used = new Set<string>();
    const starters: (Player | null)[] = [];
    for (const slot of STARTER_ORDER) {
      const pick = pool.find((p) => !used.has(p.id) && slot.positions.includes(p.position));
      if (pick) used.add(pick.id);
      starters.push(pick ?? null);
    }
    const bench = pool.filter((p) => !used.has(p.id));
    return { starters, bench };
  }, [roster]);

  const strengthByPosition = useMemo(() => {
    const totals: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DEF: 0 };
    for (const p of roster) totals[p.position] += p.vorp;
    return totals;
  }, [roster]);

  const byeConflicts = useMemo(() => {
    const map = new Map<number, Player[]>();
    for (const p of starters) {
      if (!p) continue;
      const list = map.get(p.bye) ?? [];
      list.push(p);
      map.set(p.bye, list);
    }
    return [...map.entries()].filter(([, list]) => list.length > 1);
  }, [starters]);

  const totalProjected = roster.reduce((sum, p) => sum + p.projectedPoints, 0);

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h2 className="mb-2 text-sm font-bold text-slate-100">Starting Lineup</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {STARTER_ORDER.map((slot, i) => {
            const p = starters[i];
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/40 px-3 py-2"
              >
                <span className="w-12 text-[10px] font-bold uppercase text-slate-500">{slot.slot}</span>
                {p ? (
                  <>
                    <button
                      onClick={() => setViewingPlayer(p.id)}
                      className="flex-1 truncate px-2 text-left text-sm text-slate-100 hover:text-emerald-300 hover:underline"
                    >
                      {p.name}
                    </button>
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${POSITION_COLORS[p.position]}`}>
                      {p.team} · Bye {p.bye}
                    </span>
                  </>
                ) : (
                  <span className="flex-1 px-2 text-sm italic text-slate-600">Empty</span>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="mb-2 mt-5 text-sm font-bold text-slate-100">Bench ({bench.length}/8)</h2>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {bench.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900/20 px-3 py-2">
              <button
                onClick={() => setViewingPlayer(p.id)}
                className="truncate text-left text-sm text-slate-200 hover:text-emerald-300 hover:underline"
              >
                {p.name}
              </button>
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${POSITION_COLORS[p.position]}`}>
                {p.position} · {p.team}
              </span>
            </div>
          ))}
          {bench.length === 0 && <p className="text-xs text-slate-500">No bench players yet.</p>}
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">Projected Season Points</div>
          <div className="text-2xl font-bold text-emerald-300">{totalProjected.toFixed(1)}</div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Positional Strength (VORP)</div>
          <div className="space-y-1.5">
            {(Object.keys(strengthByPosition) as Position[]).map((pos) => {
              const v = strengthByPosition[pos];
              const width = Math.max(2, Math.min(100, 50 + v / 2));
              return (
                <div key={pos} className="flex items-center gap-2 text-xs">
                  <span className="w-8 font-semibold text-slate-400">{pos}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full ${v >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <span className="w-10 text-right tabular-nums text-slate-400">{v.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {byeConflicts.length > 0 && (
          <div className="rounded-lg border border-amber-700/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <div className="mb-1 font-bold">⚠ Bye Week Conflicts</div>
            {byeConflicts.map(([bye, list]) => (
              <div key={bye}>
                Week {bye}: {list.map((p) => p.name).join(', ')}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
