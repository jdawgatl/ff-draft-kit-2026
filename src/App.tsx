import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import Header from './components/Header';
import PlayerBoard from './components/PlayerBoard';
import RecommendationPanel from './components/RecommendationPanel';
import AvailabilityPanel from './components/AvailabilityPanel';
import LiveDraftStatusPanel from './components/LiveDraftStatusPanel';
import MockDraftView from './components/MockDraftView';
import RosterTracker from './components/RosterTracker';
import HandcuffMatrix from './components/HandcuffMatrix';
import WatchlistView from './components/WatchlistView';
import SettingsModal from './components/SettingsModal';
import NewsFeedPanel from './components/NewsFeedPanel';
import PlayerDetailDrawer from './components/PlayerDetailDrawer';
import { useExtensionSync } from './hooks/useExtensionSync';
import { useYahooDraftSync } from './hooks/useYahooDraftSync';
import { useDraftStore, selectCurrentPick } from './store/draftStore';
import { formatPick } from './lib/format';

type View = 'board' | 'mock' | 'roster' | 'handcuffs' | 'watchlist';

export default function App() {
  useExtensionSync();
  useYahooDraftSync();
  const [view, setView] = useState<View>('board');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const currentPick = useDraftStore(selectCurrentPick);
  const teamsCount = useDraftStore((s) => s.settings.teams);

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <Header activeView={view} onChangeView={(v) => setView(v as View)} onOpenSettings={() => setSettingsOpen(true)} />

      <main className="relative flex flex-1 overflow-hidden">
        {view === 'board' && (
          <>
            <div className="min-w-0 flex-1 border-r border-slate-800">
              <PlayerBoard />
            </div>

            {/* Wide screens (standalone web app): persistent sidebar */}
            <aside className="hidden w-80 shrink-0 space-y-3 overflow-y-auto p-3 lg:block">
              <LiveDraftStatusPanel />
              <RecommendationPanel />
              <AvailabilityPanel />
              <NewsFeedPanel />
            </aside>

            {/* Narrow screens (Chrome side panel / popup): slide-up drawer */}
            {assistantOpen && (
              <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setAssistantOpen(false)}>
                <div
                  className="absolute inset-x-0 bottom-0 max-h-[80vh] space-y-3 overflow-y-auto rounded-t-2xl border-t border-slate-800 bg-slate-950 p-3 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-100">Draft Assistant</span>
                    <button onClick={() => setAssistantOpen(false)} className="text-slate-500 hover:text-slate-300">
                      <X size={18} />
                    </button>
                  </div>
                  <LiveDraftStatusPanel />
                  <RecommendationPanel />
                  <AvailabilityPanel />
                  <NewsFeedPanel />
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
                  {currentPick ? `Assistant — ${formatPick(currentPick.pickNumber, teamsCount)}` : 'Draft Assistant'}
                </span>
                {currentPick?.isMyPick && <span className="rounded bg-white/20 px-1.5 py-0.5">YOUR PICK</span>}
              </button>
            )}
          </>
        )}
        {view === 'mock' && <MockDraftView />}
        {view === 'roster' && (
          <div className="flex-1 overflow-y-auto">
            <RosterTracker />
          </div>
        )}
        {view === 'handcuffs' && (
          <div className="flex-1 overflow-y-auto">
            <HandcuffMatrix />
          </div>
        )}
        {view === 'watchlist' && (
          <div className="flex-1 overflow-y-auto">
            <WatchlistView />
          </div>
        )}
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      <PlayerDetailDrawer />
    </div>
  );
}
