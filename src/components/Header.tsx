import { useState } from 'react';
import { RefreshCw, Settings, Wifi, WifiOff, Trophy, Loader2 } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';
import { refreshLiveData } from '../lib/dataRefresh';

interface HeaderProps {
  onOpenSettings: () => void;
  activeView: string;
  onChangeView: (v: string) => void;
}

const VIEWS: { id: string; label: string }[] = [
  { id: 'board', label: 'Draft Board' },
  { id: 'roster', label: 'Roster Tracker' },
  { id: 'handcuffs', label: 'Handcuff Matrix' },
  { id: 'watchlist', label: 'Watchlist' },
];

export default function Header({ onOpenSettings, activeView, onChangeView }: HeaderProps) {
  const syncConnected = useDraftStore((s) => s.syncConnected);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await refreshLiveData();
      if (result.updatedCount === 0 && result.sources.length === 0) {
        setLastRefreshed('Refresh failed — using cached/offline data');
      } else {
        const bits = [`${result.updatedCount} players updated`];
        if (result.trendingCount) bits.push(`${result.trendingCount} trending`);
        if (result.newsCount) bits.push(`${result.newsCount} news items`);
        if (result.expertRankCount) bits.push(`${result.expertRankCount} expert ranks`);
        setLastRefreshed(`${bits.join(' · ')} (${result.sources.join(', ')})`);
      }
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 sm:h-8 sm:w-8">
            <Trophy size={16} className="text-white" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold tracking-tight">Draft Kit</div>
            <div className="hidden truncate text-[10px] text-slate-400 sm:block">12-Team · Slot #6 · Custom Scoring</div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Fetch latest injuries, trending adds, news, and expert ranks"
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-60 sm:px-2.5"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span className="hidden sm:inline">Refresh Data</span>
          </button>

          <div
            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium sm:px-2.5 ${
              syncConnected
                ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
            title={syncConnected ? 'Live-syncing with a Yahoo draft room' : 'Not connected to a live Yahoo draft'}
          >
            {syncConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="hidden sm:inline">Sync: {syncConnected ? 'Connected' : 'Offline'}</span>
            {syncConnected && <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
          </div>

          <button
            onClick={onOpenSettings}
            title="Settings"
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 sm:px-2.5"
          >
            <Settings size={13} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-4 pb-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => onChangeView(v.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              activeView === v.id
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
      {lastRefreshed && (
        <div className="px-4 pb-1.5 text-[10px] text-slate-500">{lastRefreshed}</div>
      )}
    </header>
  );
}
