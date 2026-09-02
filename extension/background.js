// Background service worker (Manifest V3).
// Routes messages between content.js (running on Yahoo draft room pages)
// and the side panel / popup (the React app). chrome.runtime.sendMessage
// from a content script is already delivered to every open extension page
// (side panel, popup) via their onMessage listeners, so this worker's main
// jobs are: (1) remember the latest sync/connection state so a side panel
// opened *after* the draft room loads can immediately catch up, and
// (2) open the side panel automatically when a Yahoo draft tab is detected.

let lastKnownConnected = false;
let lastPicks = []; // small ring buffer, most-recent last

chrome.runtime.onInstalled.addListener(() => {
  // Let users open the side panel via the toolbar icon's right-click menu,
  // and (where supported) a left-click on the action icon.
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  switch (message.type) {
    case 'YAHOO_PAGE_DETECTED': {
      lastKnownConnected = true;
      if (sender.tab?.id && chrome.sidePanel?.open) {
        chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
      }
      break;
    }
    case 'YAHOO_DRAFT_PICK': {
      lastKnownConnected = true;
      lastPicks.push(message.payload);
      if (lastPicks.length > 50) lastPicks.shift();
      break;
    }
    case 'YAHOO_PAGE_UNLOADED': {
      lastKnownConnected = false;
      break;
    }
    case 'REQUEST_SYNC_STATUS': {
      sendResponse({ connected: lastKnownConnected, recentPicks: lastPicks.slice(-10) });
      return true; // keep the message channel open for the async sendResponse
    }
    default:
      break;
  }
});
