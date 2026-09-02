import { useEffect } from 'react';
import { useDraftStore } from '../store/draftStore';
import { getValidYahooAccessToken, fetchYahooDraftPicks } from '../lib/yahooAuth';

const POLL_MS = 8000;

/**
 * When "Sync my live Yahoo draft" is turned on (see SettingsModal), polls
 * Yahoo's Fantasy API for the selected league's draft results and feeds any
 * picks into the same live-tracking pipeline the Chrome extension uses
 * (applyExternalPick) — so any of the 12 league members can get live sync
 * on any device just by logging into their own Yahoo account, without
 * installing anything. Re-applying an already-tracked pick is a safe no-op
 * (see applyExternalPick), so this doesn't need to diff against what it
 * fetched last time.
 */
export function useYahooDraftSync() {
  const enabled = useDraftStore((s) => s.yahooSyncEnabled);
  const leagueKey = useDraftStore((s) => s.yahooLeagueKey);
  const applyExternalPick = useDraftStore((s) => s.applyExternalPick);
  const setSyncConnected = useDraftStore((s) => s.setSyncConnected);
  const setYahooSync = useDraftStore((s) => s.setYahooSync);

  useEffect(() => {
    if (!enabled || !leagueKey) return;
    let cancelled = false;

    async function poll() {
      const token = await getValidYahooAccessToken();
      if (cancelled) return;
      if (!token) {
        // Session expired/revoked and couldn't refresh — stop trying rather
        // than hammering a dead token every 8s.
        setYahooSync(false);
        return;
      }
      try {
        const result = await fetchYahooDraftPicks(token, leagueKey!);
        if (cancelled) return;
        setSyncConnected(true);
        for (const p of result.picks) {
          applyExternalPick({
            playerName: p.playerName,
            playerTeam: p.playerTeam ?? undefined,
            playerPosition: p.playerPosition ?? undefined,
            pickNumber: p.pickNumber,
            teamName: p.teamKey,
          });
        }
      } catch {
        // Transient Yahoo API hiccup — just try again on the next tick.
      }
    }

    poll();
    const id = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, leagueKey, applyExternalPick, setSyncConnected, setYahooSync]);
}
