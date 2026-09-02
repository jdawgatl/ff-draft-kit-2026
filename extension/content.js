// Content script: injected into football.fantasysports.yahoo.com (both live
// draft rooms and mock draft rooms). Watches the draft board / pick history
// log via MutationObserver and posts a normalized pick event to the
// extension's background worker (and, transitively, the side panel) within
// ~200ms of a new pick appearing in the DOM.
//
// IMPORTANT — Yahoo's DOM structure changes periodically and differs
// slightly between the live draft room and the mock draft room. The
// selectors below are deliberately layered (several fallback strategies)
// and everything is driven off plain-text parsing rather than brittle
// class names wherever possible, so this keeps working across most markup
// tweaks. If Yahoo ships a larger redesign and sync stops working, open
// DevTools on the draft room, find the element that lists completed picks,
// and update SELECTORS below — see README.md → "If live sync breaks".

(function () {
  'use strict';

  const SELECTORS = {
    // Candidate containers for the running pick history / draft results log.
    historyContainers: [
      '#draft-history',
      '#DraftBoard',
      '[data-testid="draft-history"]',
      '.draftresults',
      '.Drafthistory',
      '.picklist-container',
      '.draft-results-table',
    ],
    // Candidate row selectors within a history container.
    rowSelectors: ['tr', 'li', '.pick-row', '[data-pick]'],
    // Drafted-player indicators directly on the pick grid (crossed-out /
    // "taken" player cells), used as a secondary detection path.
    takenCells: ['.drafted', '.is-drafted', '.taken', '.player-drafted'],
  };

  const PICK_LINE_RE =
    /(?:Round\s*(\d+)[,.\s-]+Pick\s*(\d+)|(\d+)\.(\d+))?[^A-Za-z0-9]*?([A-Z][A-Za-z.'\- ]+?)\s*[-–—]\s*([A-Z]{2,4})\s*[-–—]?\s*(QB|RB|WR|TE|K|DEF|D\/ST)?/;

  const processedSignatures = new Set();
  let observer = null;
  let debounceTimer = null;

  function post(type, payload) {
    try {
      chrome.runtime.sendMessage({ type, payload });
    } catch (e) {
      // Extension context can be invalidated on reload — safe to ignore.
    }
  }

  function findHistoryContainer() {
    for (const sel of SELECTORS.historyContainers) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function parsePickText(text) {
    const clean = text.replace(/\s+/g, ' ').trim();
    const match = clean.match(PICK_LINE_RE);
    if (!match) return null;
    const [, round, slot, pickNumAlt1, pickNumAlt2, rawName, team, pos] = match;
    if (!rawName || !team) return null;

    const pickNumber = pickNumAlt1
      ? Number(pickNumAlt1)
      : round && slot
      ? undefined // computed by caller from round/slot if needed
      : undefined;

    return {
      round: round ? Number(round) : undefined,
      pickInRound: slot ? Number(slot) : undefined,
      pickNumber,
      playerName: rawName.trim(),
      playerTeam: team.trim(),
      playerPosition: pos ? pos.replace('D/ST', 'DEF') : undefined,
      raw: clean,
    };
  }

  function extractTeamName(rowEl) {
    const teamEl = rowEl.querySelector?.('[class*="team" i], [data-testid*="team" i]');
    return teamEl?.textContent?.trim();
  }

  function scanForPicks() {
    const container = findHistoryContainer();
    let rows = [];

    if (container) {
      for (const rowSel of SELECTORS.rowSelectors) {
        const found = container.querySelectorAll(rowSel);
        if (found.length) {
          rows = Array.from(found);
          break;
        }
      }
    }

    // Fallback: scan crossed-out / drafted cells directly on the board grid.
    if (rows.length === 0) {
      for (const sel of SELECTORS.takenCells) {
        const found = document.querySelectorAll(sel);
        if (found.length) {
          rows = Array.from(found);
          break;
        }
      }
    }

    for (const row of rows) {
      const text = row.textContent || '';
      if (!text.trim()) continue;
      const parsed = parsePickText(text);
      if (!parsed) continue;

      const signature = `${parsed.playerName}|${parsed.playerTeam}|${parsed.round ?? ''}${parsed.pickInRound ?? ''}`;
      if (processedSignatures.has(signature)) continue;
      processedSignatures.add(signature);

      const teamName = extractTeamName(row);

      post('YAHOO_DRAFT_PICK', {
        pickNumber: parsed.pickNumber,
        round: parsed.round,
        teamName,
        playerName: parsed.playerName,
        playerPosition: parsed.playerPosition,
        playerTeam: parsed.playerTeam,
      });
    }
  }

  function scheduleScan() {
    // Debounce to batch rapid DOM churn, while still landing comfortably
    // under the <200ms "pick to UI update" target.
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanForPicks, 120);
  }

  function start() {
    post('YAHOO_PAGE_DETECTED', {});
    scanForPicks();

    observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener('beforeunload', () => post('YAHOO_PAGE_UNLOADED', {}));
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
})();
