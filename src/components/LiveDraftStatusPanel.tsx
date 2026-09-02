import { Radio, Undo2, RotateCcw } from 'lucide-react';
import { useDraftStore, selectCurrentPick } from '../store/draftStore';
import { formatPick } from '../lib/format';

/** Status/controls for tracking your REAL draft on the main Draft Board.
 * No AI opponents, no simulation — picks only ever come from Yahoo login
 * sync, the Chrome extension's live sync, or clicking "Draft" yourself. */
export default function LiveDraftStatusPanel() {
  const currentPick = useDraftStore(selectCurrentPick);
  const teams = useDraftStore((s) => s.liveTeams);
  const settingsTeams = useDraftStore((s) => s.settings.teams);
  const picks = useDraftStore((s) => s.livePicks);
  const currentPickIndex = useDraftStore((s) => s.liveCurrentPickIndex);
  const syncConnected = useDraftStore((s) => s.syncConnected);
  const yahooSyncEnabled = useDraftStore((s) => s.yahooSyncEnabled);
  const yahooLeagueName = useDraftStore((s) => s.yahooLeagueName);
  const undoLastPick = useDraftStore((s) => s.liveUndoLastPick);
  const resetDraft = useDraftStore((s) => s.liveResetDraft);
  const allPlayers = useDraftStore((s) => s.allPlayers);

  const teamName = currentPick ? teams[currentPick.teamIndex]?.name : '—';
  const draftComplete = currentPickIndex >= picks.length;
  const started = currentPickIndex > 0;

  const recentPicks = picks.slice(Math.max(0, currentPickIndex - 5), currentPickIndex).reverse();
  const nameFor = (id: string | null) => (id ? allPlayers.find((p) => p.id === id)?.name ?? id : '');

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
        <Radio size={14} className={syncConnected ? 'text-emerald-400' : 'text-slate-500'} />
        Live Draft Tracker
      </div>
      <p className="mb-2.5 text-[10px] leading-snug text-slate-500">
        {yahooSyncEnabled
          ? `Syncing live from your Yahoo login — "${yahooLeagueName}". Picks appear here automatically.`
          : syncConnected
          ? "Auto-syncing with your Yahoo draft room via the Chrome extension — picks appear here as they happen."
          : 'Tracks your real draft. Log into Yahoo in Settings for auto-sync (any device, no extension), connect the Chrome extension, or click "Draft" on a player yourself.'}
        {' '}Want to practice first?{' '}
        <span className="font-semibold text-emerald-400">Try the separate Mock Draft tab above.</span>
      </p>

      <div className="mb-2 flex items-center justify-between border-t border-slate-800 pt-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {draftComplete ? 'Draft Complete' : started ? `On the clock — ${teamName}` : 'Not started'}
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

      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={undoLastPick}
          disabled={!started}
          title="Undo last pick"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={() => {
            if (confirm('Reset your live draft board? This clears all tracked picks.')) resetDraft();
          }}
          disabled={!started}
          title="Reset live draft board"
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <RotateCcw size={14} />
        </button>
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
