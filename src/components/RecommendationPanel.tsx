import { Sparkles, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import {
  useDraftStore,
  selectAvailablePlayers,
  selectCurrentPick,
  selectMyFuturePickNumbers,
  selectMyRoster,
  selectMockAvailablePlayers,
  selectMockCurrentPick,
  selectMockMyFuturePickNumbers,
  selectMockMyRoster,
} from '../store/draftStore';
import { topRecommendations } from '../lib/recommend';
import { POSITION_COLORS } from '../lib/format';

interface Props {
  mode?: 'live' | 'mock';
}

export default function RecommendationPanel({ mode = 'live' }: Props) {
  const isMock = mode === 'mock';
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const settings = useDraftStore((s) => s.settings);
  const available = useDraftStore(useShallow(isMock ? selectMockAvailablePlayers : selectAvailablePlayers));
  const currentPick = useDraftStore(isMock ? selectMockCurrentPick : selectCurrentPick);
  const myRoster = useDraftStore(useShallow(isMock ? selectMockMyRoster : selectMyRoster));
  const futurePicks = useDraftStore(useShallow(isMock ? selectMockMyFuturePickNumbers : selectMyFuturePickNumbers));
  const draftPlayer = useDraftStore((s) => (isMock ? s.mockDraftPlayer : s.liveDraftPlayer));
  const toggleWatch = useDraftStore((s) => s.toggleWatch);
  const watchlist = useDraftStore((s) => s.watchlist);

  if (!currentPick) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        {isMock ? 'Mock draft complete — no picks remaining.' : 'No picks tracked yet.'}
      </div>
    );
  }

  const nextMyPick = futurePicks.find((n) => n > currentPick.pickNumber) ?? null;
  const recs = topRecommendations(available, myRoster, allPlayers, settings, currentPick.pickNumber, nextMyPick, 3);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <Sparkles size={15} className="text-emerald-400" />
        What Should I Do?
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        {currentPick.isMyPick
          ? "It's your pick — top targets by value, need, and scarcity."
          : `Preview for your upcoming pick (#${nextMyPick ?? '—'}).`}
      </p>

      <div className="space-y-2">
        {recs.map((r, i) => (
          <div key={r.player.id} className="rounded-md border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-300">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-slate-100">{r.player.name}</span>
                  <span className={`rounded border px-1 text-[9px] font-semibold ${POSITION_COLORS[r.player.position]}`}>
                    {r.player.position}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.valueAlert && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                      <TrendingUp size={9} /> Value Alert
                    </span>
                  )}
                  {r.dontReach && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-300">
                      <TrendingDown size={9} /> Don't Reach
                    </span>
                  )}
                  {r.tierDropoffRisk && (
                    <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-300">
                      Tier cliff
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] leading-snug text-slate-500">{r.reasons[0]}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <button onClick={() => toggleWatch(r.player.id)}>
                  <Star
                    size={13}
                    className={
                      watchlist.includes(r.player.id)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-600 hover:text-slate-400'
                    }
                  />
                </button>
                {currentPick.isMyPick && (
                  <button
                    onClick={() => draftPlayer(r.player.id)}
                    className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-500"
                  >
                    Draft
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {recs.length === 0 && (
          <p className="text-xs text-slate-500">No players available.</p>
        )}
      </div>
    </div>
  );
}
