import { useEffect } from 'react';
import { useDraftStore } from '../store/draftStore';

const SPEED_MS: Record<number, number> = { 1: 1500, 2: 600, 0: 40 };

/** Drives the Mock Draft tool's auto-run loop while mockSimRunning is true.
 * Only ever touches mock draft state — never the live draft tracker. */
export function useSimLoop() {
  const simRunning = useDraftStore((s) => s.mockSimRunning);
  const simSpeed = useDraftStore((s) => s.mockSimSpeed);

  useEffect(() => {
    if (!simRunning) return;
    const delay = SPEED_MS[simSpeed] ?? 1500;
    const id = window.setInterval(() => {
      const state = useDraftStore.getState();
      if (state.mockCurrentPickIndex >= state.mockPicks.length) {
        state.setMockSimRunning(false);
        return;
      }
      const pick = state.mockPicks[state.mockCurrentPickIndex];
      if (pick.isMyPick) {
        state.setMockSimRunning(false);
        return;
      }
      state.mockSimStep();
    }, delay);
    return () => window.clearInterval(id);
  }, [simRunning, simSpeed]);
}
