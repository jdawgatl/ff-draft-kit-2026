import { useState } from 'react';
import { Sparkles, X, Gamepad2 } from 'lucide-react';
import PlayerBoard from './PlayerBoard';
import DraftControlPanel from './DraftControlPanel';
import RecommendationPanel from './RecommendationPanel';
import AvailabilityPanel from './AvailabilityPanel';
import { useDraftStore, selectMockCurrentPick } from '../store/draftStore';
import { formatPick } from '../lib/format';

/** A fully separate practice-draft tool: simulate a full mock draft against
 * 11 AI opponents. Uses its own independent draft state — nothing here
 * touches your live draft tracking on the main Draft Board tab. */
export default function MockDraftView() {
  const [assistantOpen, setAssistantOpen] = useState(false);
  const currentPick = useDraftStore(selectMockCurrentPick);
  const teamsCount = useDraftStore((s) => s.settings.teams);

  return (
    <div className="relative flex flex-1 overflow-hidden">
      <div className="min-w-0 flex-1 overflow-hidden border-r border-slate-800">
        <div className="flex items-center gap-1.5 border-b border-emerald-800/30 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-200">
          <Gamepad2 size={13} />
          <span>
            <b>Mock Draft</b> — a separate practice tool. This simulated draft never affects your live draft tracking.
          </span>
        </div>
        <div className="h-[calc(100%-33px)]">
          <PlayerBoard mode="mock" />
        </div>
      </div>

      {/* Wide screens: persistent sidebar */}
      <aside className="hidden w-80 shrink-0 space-y-3 overflow-y-auto p-3 lg:block">
        <DraftControlPanel />
        <RecommendationPanel mode="mock" />
        <AvailabilityPanel mode="mock" />
      </aside>

      {/* Narrow screens: slide-up drawer */}
      {assistantOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAssistantOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] space-y-3 overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-950 p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-100">Mock Draft Assistant</span>
              <button onClick={() => setAssistantOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>
            <DraftControlPanel />
            <RecommendationPanel mode="mock" />
            <AvailabilityPanel mode="mock" />
          </div>
        </div>
      )}

      {!assistantOpen && (
        <button
          onClick={() => setAssistantOpen(true)}
          className="fixed inset-x-3 bottom-3 z-30 flex items-center justify-between gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xl lg:hidden"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles size={14} />
            {currentPick ? `Mock Draft — ${formatPick(currentPick.pickNumber, teamsCount)}` : 'Mock Draft'}
          </span>
          {currentPick?.isMyPick && <span className="rounded bg-white/20 px-1.5 py-0.5">YOUR PICK</span>}
        </button>
      )}
    </div>
  );
}
