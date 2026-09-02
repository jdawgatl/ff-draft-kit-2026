import { useState } from 'react';
import { X, Lock, KeyRound, CheckCircle2, AlertCircle, Loader2, Newspaper } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';
import { startYahooOAuth, fetchLeagueSettingsViaProxy, isExtensionContext } from '../lib/yahooAuth';
import { getStoredFantasyProsKey, setStoredFantasyProsKey } from '../lib/fantasyProsApi';
import { refreshLiveData } from '../lib/dataRefresh';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const settings = useDraftStore((s) => s.settings);
  const setMyPickSlot = useDraftStore((s) => s.setMyPickSlot);
  const resetDraft = useDraftStore((s) => s.resetDraft);

  const [consumerKey, setConsumerKey] = useState(() => localStorage.getItem('ffdk-yahoo-key') ?? '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const [fpKey, setFpKey] = useState(() => getStoredFantasyProsKey());
  const [fpStatus, setFpStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [fpMsg, setFpMsg] = useState('');

  async function handleSaveFantasyProsKey() {
    setStoredFantasyProsKey(fpKey.trim());
    if (!fpKey.trim()) {
      setFpStatus('idle');
      setFpMsg('');
      return;
    }
    setFpStatus('saving');
    setFpMsg('');
    try {
      const result = await refreshLiveData();
      if (result.errors.some((e) => e.startsWith('FantasyPros'))) {
        setFpStatus('error');
        setFpMsg(result.errors.find((e) => e.startsWith('FantasyPros')) ?? 'FantasyPros request failed.');
      } else {
        setFpStatus('saved');
        setFpMsg(`Key saved — pulled expert ranks for ${result.expertRankCount} players.`);
      }
    } catch (err) {
      setFpStatus('error');
      setFpMsg((err as Error).message);
    }
  }

  async function handleConnect() {
    localStorage.setItem('ffdk-yahoo-key', consumerKey);
    setStatus('connecting');
    setStatusMsg('');
    const result = await startYahooOAuth({ consumerKey });
    if (!result.ok || !result.code) {
      setStatus('error');
      setStatusMsg(result.error ?? 'Authorization failed.');
      return;
    }
    try {
      const settingsResult = await fetchLeagueSettingsViaProxy(result.code);
      if (settingsResult.error) {
        setStatus('error');
        setStatusMsg(settingsResult.error);
        return;
      }
      setStatus('connected');
      setStatusMsg('Connected to Yahoo. Raw league settings retrieved — see README for mapping to custom scoring.');
    } catch (err) {
      setStatus('error');
      setStatusMsg((err as Error).message + ' — falling back to built-in custom scoring rules.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-100">League Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="text-slate-500 hover:text-slate-300">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-4">
          <section>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Lock size={13} /> Locked Custom Scoring (12-Team Yahoo League)
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              Preloaded to your league's exact rules. Full PPR · 6pt all TDs · passing 0.04/yd ·
              rushing/receiving 0.1/yd · milestone bonuses · negative INT/sack/fumble.
              Edit only via a verified Yahoo sync below.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
                Teams: <b className="text-slate-200">{settings.teams}</b>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
                Rounds: <b className="text-slate-200">{settings.rounds}</b>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
                Roster: <b className="text-slate-200">1QB/2RB/2WR/1TE/2FLEX/1K/1DEF</b>
              </div>
              <div className="rounded border border-slate-800 bg-slate-900/50 p-2">
                Bench/IR: <b className="text-slate-200">{settings.rosterSlots.BENCH}/{settings.rosterSlots.IR}</b>
              </div>
            </div>
          </section>

          <section>
            <label className="mb-1 block text-xs font-bold text-slate-300">Your Draft Slot</label>
            <div className="flex items-center gap-2">
              <select
                value={settings.myPickSlot}
                onChange={(e) => {
                  setMyPickSlot(Number(e.target.value));
                }}
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
              >
                {Array.from({ length: settings.teams }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>Pick #{n}</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-500">Changing this resets the current draft board.</span>
            </div>
          </section>

          <section className="border-t border-slate-800 pt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Newspaper size={13} /> Live Rankings, Injuries & News
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              The header's <b>Refresh Data</b> button always pulls Sleeper's injury/team data and
              Sleeper's trending-adds signal, plus a best-effort ESPN news feed — all free, no key
              needed. For real FantasyPros expert consensus rankings (ECR) and their injury/news
              wire, add your own free FantasyPros API key below.
            </p>
            <p className="mb-2 text-[11px] text-slate-500">
              Request a free key at{' '}
              <a href="https://secure.fantasypros.com/api-keys/request/" target="_blank" rel="noreferrer" className="text-sky-400 underline">
                secure.fantasypros.com/api-keys/request
              </a>{' '}
              (personal, non-commercial use — see README.md → "FantasyPros API Setup" for the
              licensing caveat on hosted/shared deployments).
            </p>
            <input
              value={fpKey}
              onChange={(e) => setFpKey(e.target.value)}
              placeholder="FantasyPros API Key"
              className="mb-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleSaveFantasyProsKey}
              disabled={fpStatus === 'saving'}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fpStatus === 'saving' && <Loader2 size={13} className="animate-spin" />}
              Save Key & Pull Expert Rankings
            </button>
            {fpStatus === 'saved' && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {fpMsg}
              </div>
            )}
            {fpStatus === 'error' && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-700/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {fpMsg}
              </div>
            )}
          </section>

          <section className="border-t border-slate-800 pt-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <KeyRound size={13} /> Sync League Settings from Yahoo (Optional)
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              Connect your Yahoo Fantasy account via OAuth2 to pull live league settings directly.
              Requires a free Yahoo Developer app — see README.md → "Yahoo OAuth Setup" for the
              5-minute walkthrough (Consumer Key, Consumer Secret, Callback URL).
              {isExtensionContext() ? ' Running inside the extension: uses chrome.identity.' : ''}
            </p>
            <input
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              placeholder="Yahoo Consumer Key (Client ID)"
              className="mb-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={handleConnect}
              disabled={status === 'connecting' || !consumerKey}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'connecting' && <Loader2 size={13} className="animate-spin" />}
              Connect to Yahoo
            </button>
            {status === 'connected' && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> {statusMsg}
              </div>
            )}
            {status === 'error' && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-700/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {statusMsg}
              </div>
            )}
            <p className="mt-2 text-[10px] text-slate-600">
              Skip this entirely and the app uses your exact hardcoded league scoring — no setup required.
            </p>
          </section>

          <section className="border-t border-slate-800 pt-4">
            <button
              onClick={() => {
                if (confirm('Reset the current draft board? This clears all picks (settings are kept).')) {
                  resetDraft();
                }
              }}
              className="w-full rounded-md border border-red-800/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
            >
              Reset Draft Board
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
