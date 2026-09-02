import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DraftPick, LeagueSettings, NewsItem, Player, ScoringSettings, TeamInfo } from '../types';
import { DEFAULT_LEAGUE_SETTINGS, computeMyPickNumbers } from '../lib/leagueSettings';
import { buildPlayerPool } from '../data/players';
import { pickForBot } from '../lib/botAI';
import { topRecommendations } from '../lib/recommend';
import { crossStorage } from '../lib/storage';

const BOT_NAMES = [
  'Gridiron Gurus', 'Red Zone Raiders', 'Waiver Wire Wizards', 'The Sackers',
  'Blitz Brigade', 'End Zone Elite', 'Fumble Force', 'Draft Day Dynasty',
  'Hail Mary Heroes', 'Turf Titans', 'Prime Time Picks',
];

/**
 * Builds the 12-team slot list. `fakeBotNames` picks the naming scheme:
 * - true (mock draft): flavorful AI-opponent names, since these teams are
 *   simulated and it should be obvious this isn't your real league.
 * - false (live tracking): plain "Team N" placeholders, since these slots
 *   represent your actual Yahoo league mates and shouldn't look invented.
 */
function buildTeams(settings: LeagueSettings, fakeBotNames: boolean): TeamInfo[] {
  const teams: TeamInfo[] = [];
  let botIdx = 0;
  for (let slot = 1; slot <= settings.teams; slot++) {
    const index = slot - 1;
    if (slot === settings.myPickSlot) {
      teams.push({ index, name: 'My Team', isUser: true });
    } else if (fakeBotNames) {
      teams.push({ index, name: BOT_NAMES[botIdx % BOT_NAMES.length], isUser: false });
      botIdx++;
    } else {
      teams.push({ index, name: `Team ${slot}`, isUser: false });
    }
  }
  return teams;
}

function buildPicks(settings: LeagueSettings): DraftPick[] {
  const picks: DraftPick[] = [];
  let pickNumber = 1;
  for (let round = 1; round <= settings.rounds; round++) {
    const ascending = round % 2 === 1;
    for (let i = 0; i < settings.teams; i++) {
      const slot = ascending ? i + 1 : settings.teams - i;
      const teamIndex = slot - 1;
      picks.push({
        pickNumber,
        round,
        slotInRound: slot,
        teamIndex,
        playerId: null,
        isMyPick: slot === settings.myPickSlot,
      });
      pickNumber++;
    }
  }
  return picks;
}

function emptyRosters(teams: TeamInfo[]): Record<number, string[]> {
  const rosters: Record<number, string[]> = {};
  for (const t of teams) rosters[t.index] = [];
  return rosters;
}

interface DraftStoreState {
  settings: LeagueSettings;
  allPlayers: Player[];
  watchlist: string[];
  syncConnected: boolean;
  lastSyncedPickSignature: string | null;
  viewingPlayerId: string | null;
  viewingPlayerContext: 'live' | 'mock';
  /** Whether the user has explicitly confirmed their real draft slot (vs. the untouched default). */
  draftSlotConfirmed: boolean;

  // ---- LIVE: tracks your actual Yahoo draft, pick by pick, as it happens
  // (via the Chrome extension's auto-sync or by manually marking picks).
  // Nothing here is ever auto-picked or simulated.
  liveTeams: TeamInfo[];
  livePicks: DraftPick[];
  liveCurrentPickIndex: number;
  liveDraftedPlayerIds: string[];
  liveRosters: Record<number, string[]>;

  // ---- MOCK: a fully separate practice draft against 11 AI-controlled
  // opponents. Completely independent from the live draft above — running
  // or resetting a mock draft never touches your live tracking data.
  mockTeams: TeamInfo[];
  mockPicks: DraftPick[];
  mockCurrentPickIndex: number;
  mockDraftedPlayerIds: string[];
  mockRosters: Record<number, string[]>;
  mockSimRunning: boolean;
  mockSimSpeed: 1 | 2 | 0;

  // actions
  setViewingPlayer: (id: string | null, context?: 'live' | 'mock') => void;
  setMyPickSlot: (slot: number) => void;
  updateScoring: (scoring: ScoringSettings) => void;

  liveDraftPlayer: (playerId: string, teamIndexOverride?: number) => void;
  liveUndoLastPick: () => void;
  liveResetDraft: () => void;
  applyExternalPick: (evt: {
    playerName: string;
    playerTeam?: string;
    playerPosition?: string;
    pickNumber?: number;
    teamName?: string;
  }) => boolean;

  mockDraftPlayer: (playerId: string, teamIndexOverride?: number) => void;
  mockUndoLastPick: () => void;
  mockResetDraft: () => void;
  toggleWatch: (playerId: string) => void;
  setSyncConnected: (v: boolean) => void;
  mockSimStep: () => void; // advance exactly one mock pick (bot AI or, if user's turn, no-op unless forced)
  mockPickForMe: () => void;
  mockFastForwardToMyPick: () => void;
  setMockSimRunning: (v: boolean) => void;
  setMockSimSpeed: (s: 1 | 2 | 0) => void;
  applyPlayerOverrides: (overrides: Record<string, PlayerOverride>) => void;
}

export interface PlayerOverride {
  injuryStatus?: Player['injuryStatus'];
  team?: string;
  expertRank?: number;
  expertTier?: number;
  trending?: 'up' | 'down';
  trendingCount?: number;
  news?: NewsItem[]; // new items to merge in (newest first), deduped by headline
}

export const useDraftStore = create<DraftStoreState>()(
  persist(
    (set, get) => ({
      settings: DEFAULT_LEAGUE_SETTINGS,
      allPlayers: buildPlayerPool(DEFAULT_LEAGUE_SETTINGS),
      watchlist: [],
      syncConnected: false,
      lastSyncedPickSignature: null,
      viewingPlayerId: null,
      viewingPlayerContext: 'live',
      draftSlotConfirmed: false,

      liveTeams: buildTeams(DEFAULT_LEAGUE_SETTINGS, false),
      livePicks: buildPicks(DEFAULT_LEAGUE_SETTINGS),
      liveCurrentPickIndex: 0,
      liveDraftedPlayerIds: [],
      liveRosters: emptyRosters(buildTeams(DEFAULT_LEAGUE_SETTINGS, false)),

      mockTeams: buildTeams(DEFAULT_LEAGUE_SETTINGS, true),
      mockPicks: buildPicks(DEFAULT_LEAGUE_SETTINGS),
      mockCurrentPickIndex: 0,
      mockDraftedPlayerIds: [],
      mockRosters: emptyRosters(buildTeams(DEFAULT_LEAGUE_SETTINGS, true)),
      mockSimRunning: false,
      mockSimSpeed: 1,

      setViewingPlayer: (id, context = 'live') => set({ viewingPlayerId: id, viewingPlayerContext: context }),

      setMyPickSlot: (slot) => {
        const settings = { ...get().settings, myPickSlot: slot };
        const liveTeams = buildTeams(settings, false);
        const mockTeams = buildTeams(settings, true);
        set({
          settings,
          draftSlotConfirmed: true,
          liveTeams,
          livePicks: buildPicks(settings),
          liveCurrentPickIndex: 0,
          liveDraftedPlayerIds: [],
          liveRosters: emptyRosters(liveTeams),
          mockTeams,
          mockPicks: buildPicks(settings),
          mockCurrentPickIndex: 0,
          mockDraftedPlayerIds: [],
          mockRosters: emptyRosters(mockTeams),
          mockSimRunning: false,
        });
      },

      updateScoring: (scoring) => {
        const settings = { ...get().settings, scoring };
        set({ settings, allPlayers: buildPlayerPool(settings) });
      },

      // ---- LIVE ----
      liveDraftPlayer: (playerId, teamIndexOverride) => {
        const state = get();
        if (state.liveDraftedPlayerIds.includes(playerId)) return;
        if (state.liveCurrentPickIndex >= state.livePicks.length) return;

        const pick = state.livePicks[state.liveCurrentPickIndex];
        const teamIndex = teamIndexOverride ?? pick.teamIndex;

        const updatedPicks = [...state.livePicks];
        updatedPicks[state.liveCurrentPickIndex] = { ...pick, playerId, teamIndex };

        const rosters = { ...state.liveRosters, [teamIndex]: [...(state.liveRosters[teamIndex] ?? []), playerId] };

        set({
          livePicks: updatedPicks,
          liveDraftedPlayerIds: [...state.liveDraftedPlayerIds, playerId],
          liveRosters: rosters,
          liveCurrentPickIndex: state.liveCurrentPickIndex + 1,
        });
      },

      liveUndoLastPick: () => {
        const state = get();
        if (state.liveCurrentPickIndex === 0) return;
        const idx = state.liveCurrentPickIndex - 1;
        const pick = state.livePicks[idx];
        if (!pick.playerId) {
          set({ liveCurrentPickIndex: idx });
          return;
        }
        const rosters = {
          ...state.liveRosters,
          [pick.teamIndex]: (state.liveRosters[pick.teamIndex] ?? []).filter((id) => id !== pick.playerId),
        };
        const updatedPicks = [...state.livePicks];
        updatedPicks[idx] = { ...pick, playerId: null };
        set({
          livePicks: updatedPicks,
          liveDraftedPlayerIds: state.liveDraftedPlayerIds.filter((id) => id !== pick.playerId),
          liveRosters: rosters,
          liveCurrentPickIndex: idx,
        });
      },

      liveResetDraft: () => {
        const { settings } = get();
        const liveTeams = buildTeams(settings, false);
        set({
          liveTeams,
          livePicks: buildPicks(settings),
          liveCurrentPickIndex: 0,
          liveDraftedPlayerIds: [],
          liveRosters: emptyRosters(liveTeams),
          syncConnected: false,
          lastSyncedPickSignature: null,
        });
      },

      applyExternalPick: (evt) => {
        const state = get();
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
        const target = norm(evt.playerName);
        const match = state.allPlayers.find((p) => {
          if (state.liveDraftedPlayerIds.includes(p.id)) return false;
          const nameMatch = norm(p.name) === target || norm(p.name).includes(target) || target.includes(norm(p.name));
          if (!evt.playerTeam) return nameMatch;
          return nameMatch && (p.team.toLowerCase() === evt.playerTeam.toLowerCase() || true);
        });
        if (!match) return false;

        const signature = `${evt.pickNumber ?? state.liveCurrentPickIndex}-${match.id}`;
        if (state.lastSyncedPickSignature === signature) return true;

        const pick = state.livePicks[state.liveCurrentPickIndex];
        const teamIndex = pick ? pick.teamIndex : 0;
        get().liveDraftPlayer(match.id, teamIndex);
        set({ lastSyncedPickSignature: signature, syncConnected: true });
        return true;
      },

      // ---- MOCK ----
      mockDraftPlayer: (playerId, teamIndexOverride) => {
        const state = get();
        if (state.mockDraftedPlayerIds.includes(playerId)) return;
        if (state.mockCurrentPickIndex >= state.mockPicks.length) return;

        const pick = state.mockPicks[state.mockCurrentPickIndex];
        const teamIndex = teamIndexOverride ?? pick.teamIndex;

        const updatedPicks = [...state.mockPicks];
        updatedPicks[state.mockCurrentPickIndex] = { ...pick, playerId, teamIndex };

        const rosters = { ...state.mockRosters, [teamIndex]: [...(state.mockRosters[teamIndex] ?? []), playerId] };

        set({
          mockPicks: updatedPicks,
          mockDraftedPlayerIds: [...state.mockDraftedPlayerIds, playerId],
          mockRosters: rosters,
          mockCurrentPickIndex: state.mockCurrentPickIndex + 1,
        });
      },

      mockUndoLastPick: () => {
        const state = get();
        if (state.mockCurrentPickIndex === 0) return;
        const idx = state.mockCurrentPickIndex - 1;
        const pick = state.mockPicks[idx];
        if (!pick.playerId) {
          set({ mockCurrentPickIndex: idx });
          return;
        }
        const rosters = {
          ...state.mockRosters,
          [pick.teamIndex]: (state.mockRosters[pick.teamIndex] ?? []).filter((id) => id !== pick.playerId),
        };
        const updatedPicks = [...state.mockPicks];
        updatedPicks[idx] = { ...pick, playerId: null };
        set({
          mockPicks: updatedPicks,
          mockDraftedPlayerIds: state.mockDraftedPlayerIds.filter((id) => id !== pick.playerId),
          mockRosters: rosters,
          mockCurrentPickIndex: idx,
        });
      },

      mockResetDraft: () => {
        const { settings } = get();
        const mockTeams = buildTeams(settings, true);
        set({
          mockTeams,
          mockPicks: buildPicks(settings),
          mockCurrentPickIndex: 0,
          mockDraftedPlayerIds: [],
          mockRosters: emptyRosters(mockTeams),
          mockSimRunning: false,
        });
      },

      toggleWatch: (playerId) => {
        const { watchlist } = get();
        set({
          watchlist: watchlist.includes(playerId)
            ? watchlist.filter((id) => id !== playerId)
            : [...watchlist, playerId],
        });
      },

      setSyncConnected: (v) => set({ syncConnected: v }),

      mockSimStep: () => {
        const state = get();
        if (state.mockCurrentPickIndex >= state.mockPicks.length) {
          set({ mockSimRunning: false });
          return;
        }
        const pick = state.mockPicks[state.mockCurrentPickIndex];
        const available = state.allPlayers.filter((p) => !state.mockDraftedPlayerIds.includes(p.id));
        if (available.length === 0) {
          set({ mockSimRunning: false });
          return;
        }
        if (pick.isMyPick) {
          // Don't auto-draft for the user during a plain sim step; caller
          // should use mockPickForMe() explicitly. Pause the runner instead.
          set({ mockSimRunning: false });
          return;
        }
        const botRoster = state.mockRosters[pick.teamIndex] ?? [];
        const chosen = pickForBot(botRoster, available, state.allPlayers, state.settings, pick.pickNumber);
        get().mockDraftPlayer(chosen.id, pick.teamIndex);
      },

      mockPickForMe: () => {
        const state = get();
        if (state.mockCurrentPickIndex >= state.mockPicks.length) return;
        const pick = state.mockPicks[state.mockCurrentPickIndex];
        const available = state.allPlayers.filter((p) => !state.mockDraftedPlayerIds.includes(p.id));
        if (available.length === 0) return;
        const myFuturePicks = computeMyPickNumbers(state.settings).filter((n) => n > pick.pickNumber);
        const recs = topRecommendations(
          available,
          state.mockRosters[pick.teamIndex] ?? [],
          state.allPlayers,
          state.settings,
          pick.pickNumber,
          myFuturePicks[0] ?? null,
          1
        );
        if (recs.length) get().mockDraftPlayer(recs[0].player.id, pick.teamIndex);
      },

      mockFastForwardToMyPick: () => {
        let guard = 0;
        while (guard < 500) {
          const s = get();
          if (s.mockCurrentPickIndex >= s.mockPicks.length) break;
          const pick = s.mockPicks[s.mockCurrentPickIndex];
          if (pick.isMyPick) break;
          get().mockSimStep();
          guard++;
        }
      },

      setMockSimRunning: (v) => set({ mockSimRunning: v }),
      setMockSimSpeed: (spd) => set({ mockSimSpeed: spd }),

      applyPlayerOverrides: (overrides) => {
        const state = get();
        const allPlayers = state.allPlayers.map((p) => {
          const o = overrides[p.id];
          if (!o) return p;
          let news = p.news;
          if (o.news?.length) {
            const existing = news ?? [];
            const seen = new Set(existing.map((n) => n.headline));
            const merged = [...o.news.filter((n) => !seen.has(n.headline)), ...existing];
            news = merged.slice(0, 3);
          }
          return {
            ...p,
            injuryStatus: o.injuryStatus ?? p.injuryStatus,
            team: o.team ?? p.team,
            expertRank: o.expertRank ?? p.expertRank,
            expertTier: o.expertTier ?? p.expertTier,
            trending: o.trending ?? p.trending,
            trendingCount: o.trendingCount ?? p.trendingCount,
            news,
          };
        });
        set({ allPlayers });
      },
    }),
    {
      name: 'ffdk-draft-state',
      storage: createJSONStorage(() => crossStorage),
      partialize: (state) => ({
        settings: state.settings,
        watchlist: state.watchlist,
        draftSlotConfirmed: state.draftSlotConfirmed,
        liveTeams: state.liveTeams,
        livePicks: state.livePicks,
        liveCurrentPickIndex: state.liveCurrentPickIndex,
        liveDraftedPlayerIds: state.liveDraftedPlayerIds,
        liveRosters: state.liveRosters,
        mockTeams: state.mockTeams,
        mockPicks: state.mockPicks,
        mockCurrentPickIndex: state.mockCurrentPickIndex,
        mockDraftedPlayerIds: state.mockDraftedPlayerIds,
        mockRosters: state.mockRosters,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) } as DraftStoreState;
        // allPlayers is derived from settings.scoring and must never be
        // trusted from persisted storage schema drift — always recompute.
        merged.allPlayers = buildPlayerPool(merged.settings);
        return merged;
      },
    }
  )
);

// ---- LIVE selectors (used by the Draft Board, Roster, Handcuffs, Watchlist,
// and Player Detail views — i.e. everything that tracks your real draft) ----
export function selectAvailablePlayers(state: DraftStoreState): Player[] {
  return state.allPlayers.filter((p) => !state.liveDraftedPlayerIds.includes(p.id));
}

export function selectMyRoster(state: DraftStoreState): string[] {
  const myTeam = state.liveTeams.find((t) => t.isUser);
  return myTeam ? state.liveRosters[myTeam.index] ?? [] : [];
}

export function selectCurrentPick(state: DraftStoreState): DraftPick | null {
  return state.livePicks[state.liveCurrentPickIndex] ?? null;
}

export function selectMyFuturePickNumbers(state: DraftStoreState): number[] {
  const current = selectCurrentPick(state);
  const all = computeMyPickNumbers(state.settings);
  if (!current) return [];
  return all.filter((n) => n >= current.pickNumber);
}

// ---- MOCK selectors (used only by the separate Mock Draft tool) ----
export function selectMockAvailablePlayers(state: DraftStoreState): Player[] {
  return state.allPlayers.filter((p) => !state.mockDraftedPlayerIds.includes(p.id));
}

export function selectMockMyRoster(state: DraftStoreState): string[] {
  const myTeam = state.mockTeams.find((t) => t.isUser);
  return myTeam ? state.mockRosters[myTeam.index] ?? [] : [];
}

export function selectMockCurrentPick(state: DraftStoreState): DraftPick | null {
  return state.mockPicks[state.mockCurrentPickIndex] ?? null;
}

export function selectMockMyFuturePickNumbers(state: DraftStoreState): number[] {
  const current = selectMockCurrentPick(state);
  const all = computeMyPickNumbers(state.settings);
  if (!current) return [];
  return all.filter((n) => n >= current.pickNumber);
}
