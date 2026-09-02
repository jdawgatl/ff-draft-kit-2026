import { useEffect } from 'react';
import { useDraftStore } from '../store/draftStore';

const SPEED_MS: Record<number, number> = { 1: 1500, 2: 600, 0: 40 };

/** Drives the mock draft simulator's auto-run loop while simRunning is true. */
export function useSimLoop() {
  const simRunning = useDraftStore((s) => s.simRunning);
  const simSpeed = useDraftStore((s) => s.simSpeed);

  useEffect(() => {
    if (!simRunning) return;
    const delay = SPEED_MS[simSpeed] ?? 1500;
    const id = window.setInterval(() => {
      const state = useDraftStore.getState();
      if (state.currentPickIndex >= state.picks.length) {
        state.setSimRunning(false);
        return;
      }
      const pick = state.picks[state.currentPickIndex];
      if (pick.isMyPick) {
        state.setSimRunning(false);
        return;
      }
      state.simStep();
    }, delay);
    return () => window.clearInterval(id);
  }, [simRunning, simSpeed]);
}
