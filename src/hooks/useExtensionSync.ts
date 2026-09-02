import { useEffect } from 'react';
import { useDraftStore } from '../store/draftStore';

declare const chrome: any;

interface DraftPickMessage {
  type: 'YAHOO_DRAFT_PICK';
  payload: {
    pickNumber?: number;
    round?: number;
    teamName?: string;
    playerName: string;
    playerPosition?: string;
    playerTeam?: string;
  };
}

interface PageDetectedMessage {
  type: 'YAHOO_PAGE_DETECTED';
}

type IncomingMessage = DraftPickMessage | PageDetectedMessage | { type: string; [k: string]: unknown };

/**
 * Listens for messages relayed by the extension's background service
 * worker (background.js), which in turn relays MutationObserver events
 * from content.js running on the live Yahoo draft room DOM. No-ops
 * gracefully when not running inside the extension (standalone web app).
 */
export function useExtensionSync() {
  const applyExternalPick = useDraftStore((s) => s.applyExternalPick);
  const setSyncConnected = useDraftStore((s) => s.setSyncConnected);

  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.runtime?.onMessage) return;

    const listener = (message: IncomingMessage) => {
      if (message.type === 'YAHOO_PAGE_DETECTED') {
        setSyncConnected(true);
        return;
      }
      if (message.type === 'YAHOO_DRAFT_PICK') {
        const { payload } = message as DraftPickMessage;
        applyExternalPick({
          playerName: payload.playerName,
          playerTeam: payload.playerTeam,
          playerPosition: payload.playerPosition,
          pickNumber: payload.pickNumber,
          teamName: payload.teamName,
        });
      }
    };

    chrome.runtime.onMessage.addListener(listener);

    // Ask the background worker whether a Yahoo draft tab is currently active.
    try {
      chrome.runtime.sendMessage({ type: 'REQUEST_SYNC_STATUS' }, (response: { connected?: boolean }) => {
        if (chrome.runtime.lastError) return;
        if (response?.connected) setSyncConnected(true);
      });
    } catch {
      // extension context invalidated or unavailable — ignore
    }

    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [applyExternalPick, setSyncConnected]);
}
