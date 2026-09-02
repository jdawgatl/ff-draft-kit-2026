import { useEffect, useState } from 'react';
import { X, Lock, CheckCircle2, AlertCircle, Loader2, Newspaper, Radio } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';
import {
  startYahooOAuth,
  isExtensionContext,
  connectYahooAndStoreTokens,
  hasStoredYahooTokens,
  clearYahooTokens,
  getValidYahooAccessToken,
  fetchMyYahooLeagues,
  type YahooLeagueSummary,
} from '../lib/yahooAuth';
import { refreshLiveData } from '../lib/dataRefresh';

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const settings = useDraftStore((s) => s.settings);
  const setMyPickSlot = useDraftStore((s) => s.setMyPickSlot);
  const resetDraft = useDraftStore((s) => s.liveResetDraft);
  const yahooSyncEnabled = useDraftStore((s) => s.yahooSyncEnabled);
  const yahooLeagueKey = useDraftStore((s) => s.yahooLeagueKey);
  const yahooLeagueName = useDraftStore((s) => s.yahooLeagueName);
  const setYahooSync = useDraftStore((s) => s.setYahooSync);

  const [consumerKey, setConsumerKey] = useState(() => localStorage.getItem('ffdk-yahoo-key') ?? '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>(
    hasStoredYahooTokens() ? 'connected' : 'idle'
  );
  const [statusMsg, setStatusMsg] = useState('');
  const [leagues, setLeagues] = useState<YahooLeagueSummary[]>([]);
  const [loadingLeagues, setLoadingLeagues] = useState(false);
  const [selectedLeagueKey, setSelectedLeagueKey] = useState(yahooLeagueKey ?? '');

  const [fpStatus, setFpStatus] = useState<'idle' | 'testing' | 'saved' | 'error'>('idle');
  const [fpMsg, setFpMsg] = useState('');

  async function handleTestFantasyPros() {
    setFpStatus('testing');
    setFpMsg('');
    try {
      const result = await refreshLiveData();
      if (result.errors.some((e) => e.startsWith('FantasyPros'))) {
        setFpStatus('error');
        setFpMsg(result.errors.find((e) => e.startsWith('FantasyPros')) ?? 'FantasyPros request failed.');
      } else {
        setFpStatus('saved');
        setFpMsg(`Pulled expert ranks for ${result.expertRankCount} players.`);
      }
    } catch (err) {
      setFpStatus('error');
      setFpMsg((err as Error).message);
    }
  }

  useEffect(() => {
    if (hasStoredYahooTokens()) loadLeagues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadLeagues() {
    setLoadingLeagues(true);
    try {
      const token = await getValidYahooAccessToken();
      if (!token) {
        setStatus('idle');
        setStatusMsg('Your Yahoo session expired — connect again.');
        return;
      }
      const result = await fetchMyYahooLeagues(token);
      setLeagues(result);
      if (result.length === 0) {
        setStatusMsg('Connected, but no NFL leagues were found on this Yahoo account for the current season.');
      }
    } catch (err) {
      setStatusMsg(`Couldn't load your leagues: ${(err as Error).message}`);
    } finally {
      setLoadingLeagues(false);
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
    const tokenResult = await connectYahooAndStoreTokens(result.code);
    if (!tokenResult.ok) {
      setStatus('error');
      setStatusMsg(tokenResult.error ?? 'Token exchange failed.');
      return;
    }
    setStatus('connected');
    setStatusMsg('Connected to Yahoo.');
    await loadLeagues();
  }

  function handleDisconnect() {
    clearYahooTokens();
    setYahooSync(false);
    setLeagues([]);
    setSelectedLeagueKey('');
    setStatus('idle');
    setStatusMsg('Disconnected.');
  }

  function handleToggleSync() {
    if (yahooSyncEnabled) {
      setYahooSync(false);
      return;
    }
    const league = leagues.find((l) => l.leagueKey === selectedLeagueKey);
    if (!league) {
      setStatusMsg('Pick a league first.');
      return;
    }
    setYahooSync(true, league.leagueKey, league.name);
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
              The header's <b>Refresh Data</b> button always pulls Sleeper's injury/team data,
              Sleeper's trending-adds signal, a best-effort ESPN news feed, and FantasyPros expert
              consensus rankings (ECR) and injury/news — all included automatically, no setup or
              API key needed on your end.
            </p>
            <button
              onClick={handleTestFantasyPros}
              disabled={fpStatus === 'testing'}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fpStatus === 'testing' && <Loader2 size={13} className="animate-spin" />}
              Test FantasyPros Connection
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
              <Radio size={13} /> Sync My Live Yahoo Draft
            </div>
            <p className="mb-2 text-[11px] text-slate-500">
              Log into your own Yahoo account and the app will pull picks directly from your real
              draft as they happen — no Chrome extension needed. Anyone in your league can do this
              on their own device with their own Yahoo login; each person's picks stay in their own
              browser. Requires a free Yahoo Developer app to be set up once for this site — see
              README.md → "Yahoo OAuth Setup" (Consumer Key, Consumer Secret, Callback URL).
              {isExtensionContext() ? ' Running inside the extension: uses chrome.identity.' : ''}
            </p>
            <p className="mb-2 text-[11px] text-amber-300/90">
              Covers a real Yahoo league you belong to. Yahoo's public Mock Draft Lobby isn't
              exposed through their official API, so it can't be synced this way — the Chrome
              extension's page-watching approach is the only option there.
            </p>

            {status !== 'connected' && (
              <>
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
              </>
            )}

            {status === 'connected' && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 rounded-md border border-emerald-700/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                  <CheckCircle2 size={13} className="shrink-0" /> Connected to Yahoo
                  <button onClick={handleDisconnect} className="ml-auto text-[10px] font-semibold text-slate-400 underline hover:text-slate-200">
                    Disconnect
                  </button>
                </div>

                {loadingLeagues ? (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Loader2 size={12} className="animate-spin" /> Loading your leagues…
                  </div>
                ) : leagues.length > 0 ? (
                  <>
                    <select
                      value={selectedLeagueKey}
                      onChange={(e) => setSelectedLeagueKey(e.target.value)}
                      disabled={yahooSyncEnabled}
                      className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none disabled:opacity-60"
                    >
                      <option value="">Select your league…</option>
                      {leagues.map((l) => (
                        <option key={l.leagueKey} value={l.leagueKey}>
                          {l.name}{l.draftStatus ? ` (${l.draftStatus})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleToggleSync}
                      disabled={!yahooSyncEnabled && !selectedLeagueKey}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                        yahooSyncEnabled ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                      }`}
                    >
                      {yahooSyncEnabled ? 'Stop Syncing' : 'Start Live Sync'}
                    </button>
                    {yahooSyncEnabled && (
                      <p className="text-[10px] text-emerald-400">
                        Syncing "{yahooLeagueName}" — checking for new picks every few seconds.
                      </p>
                    )}
                  </>
                ) : (
                  <button
                    onClick={loadLeagues}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Refresh League List
                  </button>
                )}
              </div>
            )}

            {status === 'error' && (
              <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-700/40 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                <AlertCircle size={13} className="mt-0.5 shrink-0" /> {statusMsg}
              </div>
            )}
            {statusMsg && status === 'connected' && leagues.length === 0 && !loadingLeagues && (
              <p className="mt-1.5 text-[10px] text-slate-500">{statusMsg}</p>
            )}
            <p className="mt-2 text-[10px] text-slate-600">
              Skip this entirely and the app uses your exact hardcoded league scoring — no setup required.
            </p>
          </section>

          <section className="border-t border-slate-800 pt-4">
            <button
              onClick={() => {
                if (confirm('Reset your live draft board? This clears all tracked picks (settings are kept).')) {
                  resetDraft();
                }
              }}
              className="w-full rounded-md border border-red-800/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-500/20"
            >
              Reset Live Draft Board
            </button>
            <p className="mt-1.5 text-[10px] text-slate-600">
              Only affects your live draft tracker (this page). The separate Mock Draft tool has its own reset button.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
