import { Play, Pause, SkipForward, FastForward, Wand2, Undo2, RotateCcw, Gamepad2 } from 'lucide-react';
import { useDraftStore, selectMockCurrentPick } from '../store/draftStore';
import { formatPick } from '../lib/format';
import { useSimLoop } from '../hooks/useSimLoop';

/** Controls for the Mock Draft tool only — simulates a full draft against
 * 11 AI-controlled opponents. Entirely separate from live draft tracking. */
export default function DraftControlPanel() {
  useSimLoop();

  const currentPick = useDraftStore(selectMockCurrentPick);
  const teams = useDraftStore((s) => s.mockTeams);
  const settingsTeams = useDraftStore((s) => s.settings.teams);
  const picks = useDraftStore((s) => s.mockPicks);
  const currentPickIndex = useDraftStore((s) => s.mockCurrentPickIndex);
  const simRunning = useDraftStore((s) => s.mockSimRunning);
  const simSpeed = useDraftStore((s) => s.mockSimSpeed);
  const setSimRunning = useDraftStore((s) => s.setMockSimRunning);
  const setSimSpeed = useDraftStore((s) => s.setMockSimSpeed);
  const simStep = useDraftStore((s) => s.mockSimStep);
  const pickForMe = useDraftStore((s) => s.mockPickForMe);
  const fastForwardToMyPick = useDraftStore((s) => s.mockFastForwardToMyPick);
  const undoLastPick = useDraftStore((s) => s.mockUndoLastPick);
  const resetDraft = useDraftStore((s) => s.mockResetDraft);
  const allPlayers = useDraftStore((s) => s.allPlayers);

  const teamName = currentPick ? teams[currentPick.teamIndex]?.name : '—';
  const draftComplete = currentPickIndex >= picks.length;

  const recentPicks = picks.slice(Math.max(0, currentPickIndex - 5), currentPickIndex).reverse();
  const nameFor = (id: string | null) => (id ? allPlayers.find((p) => p.id === id)?.name ?? id : '');

  return (
    <div className="rounded-lg border border-emerald-800/40 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-300">
        <Gamepad2 size={14} />
        Mock Draft Controls
      </div>
      <p className="mb-2.5 text-[10px] leading-snug text-slate-500">
        Simulate a full draft against 11 AI teams: step through picks one at a time, auto-run the
        whole board, or jump straight to your next pick. Use <b>Pick For Me</b> to let the
        recommendation engine draft on your behalf when it's your turn. This practice draft is
        separate from your live draft tracking — nothing here affects it.
      </p>
      <div className="mb-2 flex items-center justify-between border-t border-slate-800 pt-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {draftComplete ? 'Draft Complete' : `On the clock — ${teamName}`}
          </div>
          <div className="text-lg font-bold text-slate-100">
            {draftComplete ? '🏁 Done' : formatPick(currentPick!.pickNumber, settingsTeams)}
          </div>
        </div>
        {currentPick?.isMyPick && !draftComplete && (
          <span className="animate-pulse rounded bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300">
            YOUR PICK
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          onClick={pickForMe}
          disabled={draftComplete || !currentPick?.isMyPick}
          className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Wand2 size={13} /> Pick For Me
        </button>
        <button
          onClick={simStep}
          disabled={draftComplete || currentPick?.isMyPick}
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SkipForward size={13} /> Simulate Next
        </button>
        <button
          onClick={fastForwardToMyPick}
          disabled={draftComplete}
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FastForward size={13} /> FF to My Pick
        </button>
        <button
          onClick={() => setSimRunning(!simRunning)}
          disabled={draftComplete}
          className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {simRunning ? <Pause size={13} /> : <Play size={13} />}
          {simRunning ? 'Pause' : 'Auto-Run'}
        </button>
      </div>

      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-[10px] text-slate-500">Speed:</span>
        {[1, 2, 0].map((s) => (
          <button
            key={s}
            onClick={() => setSimSpeed(s as 1 | 2 | 0)}
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              simSpeed === s ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            {s === 0 ? 'Instant' : `${s}x`}
          </button>
        ))}
        <div className="ml-auto flex gap-1.5">
          <button onClick={undoLastPick} title="Undo last pick" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <Undo2 size={14} />
          </button>
          <button onClick={resetDraft} title="Reset mock draft" className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {recentPicks.length > 0 && (
        <div className="mt-2 border-t border-slate-800 pt-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-500">Recent Picks</div>
          <div className="space-y-0.5">
            {recentPicks.map((p) => (
              <div key={p.pickNumber} className="flex justify-between text-[11px]">
                <span className="text-slate-500">#{p.pickNumber} {teams[p.teamIndex]?.name}</span>
                <span className="font-medium text-slate-300">{nameFor(p.playerId)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
