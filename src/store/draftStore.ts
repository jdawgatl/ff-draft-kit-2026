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

function buildTeams(settings: LeagueSettings): TeamInfo[] {
  const teams: TeamInfo[] = [];
  let botIdx = 0;
  for (let slot = 1; slot <= settings.teams; slot++) {
    const index = slot - 1;
    if (slot === settings.myPickSlot) {
      teams.push({ index, name: 'My Team', isUser: true });
    } else {
      teams.push({ index, name: BOT_NAMES[botIdx % BOT_NAMES.length], isUser: false });
      botIdx++;
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
  teams: TeamInfo[];
  picks: DraftPick[];
  currentPickIndex: number;
  draftedPlayerIds: string[];
  rosters: Record<number, string[]>;
  watchlist: string[];
  simRunning: boolean;
  simSpeed: 1 | 2 | 0;
  syncConnected: boolean;
  lastSyncedPickSignature: string | null;
  viewingPlayerId: string | null;

  // actions
  setViewingPlayer: (id: string | null) => void;
  setMyPickSlot: (slot: number) => void;
  updateScoring: (scoring: ScoringSettings) => void;
  draftPlayer: (playerId: string, teamIndexOverride?: number) => void;
  undoLastPick: () => void;
  resetDraft: () => void;
  toggleWatch: (playerId: string) => void;
  setSyncConnected: (v: boolean) => void;
  simStep: () => void; // advance exactly one pick (bot AI or, if user's turn, no-op unless forced)
  pickForMe: () => void;
  fastForwardToMyPick: () => void;
  setSimRunning: (v: boolean) => void;
  setSimSpeed: (s: 1 | 2 | 0) => void;
  applyExternalPick: (evt: {
    playerName: string;
    playerTeam?: string;
    playerPosition?: string;
    pickNumber?: number;
    teamName?: string;
  }) => boolean;
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
      teams: buildTeams(DEFAULT_LEAGUE_SETTINGS),
      picks: buildPicks(DEFAULT_LEAGUE_SETTINGS),
      currentPickIndex: 0,
      draftedPlayerIds: [],
      rosters: emptyRosters(buildTeams(DEFAULT_LEAGUE_SETTINGS)),
      watchlist: [],
      simRunning: false,
      simSpeed: 1,
      syncConnected: false,
      lastSyncedPickSignature: null,
      viewingPlayerId: null,

      setViewingPlayer: (id) => set({ viewingPlayerId: id }),

      setMyPickSlot: (slot) => {
        const settings = { ...get().settings, myPickSlot: slot };
        const teams = buildTeams(settings);
        set({
          settings,
          teams,
          picks: buildPicks(settings),
          currentPickIndex: 0,
          draftedPlayerIds: [],
          rosters: emptyRosters(teams),
        });
      },

      updateScoring: (scoring) => {
        const settings = { ...get().settings, scoring };
        set({ settings, allPlayers: buildPlayerPool(settings) });
      },

      draftPlayer: (playerId, teamIndexOverride) => {
        const state = get();
        if (state.draftedPlayerIds.includes(playerId)) return;
        if (state.currentPickIndex >= state.picks.length) return;

        const pick = state.picks[state.currentPickIndex];
        const teamIndex = teamIndexOverride ?? pick.teamIndex;

        const updatedPicks = [...state.picks];
        updatedPicks[state.currentPickIndex] = { ...pick, playerId, teamIndex };

        const rosters = { ...state.rosters, [teamIndex]: [...(state.rosters[teamIndex] ?? []), playerId] };

        set({
          picks: updatedPicks,
          draftedPlayerIds: [...state.draftedPlayerIds, playerId],
          rosters,
          currentPickIndex: state.currentPickIndex + 1,
        });
      },

      undoLastPick: () => {
        const state = get();
        if (state.currentPickIndex === 0) return;
        const idx = state.currentPickIndex - 1;
        const pick = state.picks[idx];
        if (!pick.playerId) {
          set({ currentPickIndex: idx });
          return;
        }
        const rosters = {
          ...state.rosters,
          [pick.teamIndex]: (state.rosters[pick.teamIndex] ?? []).filter((id) => id !== pick.playerId),
        };
        const updatedPicks = [...state.picks];
        updatedPicks[idx] = { ...pick, playerId: null };
        set({
          picks: updatedPicks,
          draftedPlayerIds: state.draftedPlayerIds.filter((id) => id !== pick.playerId),
          rosters,
          currentPickIndex: idx,
        });
      },

      resetDraft: () => {
        const { settings } = get();
        const teams = buildTeams(settings);
        set({
          teams,
          picks: buildPicks(settings),
          currentPickIndex: 0,
          draftedPlayerIds: [],
          rosters: emptyRosters(teams),
          simRunning: false,
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

      simStep: () => {
        const state = get();
        if (state.currentPickIndex >= state.picks.length) {
          set({ simRunning: false });
          return;
        }
        const pick = state.picks[state.currentPickIndex];
        const available = state.allPlayers.filter((p) => !state.draftedPlayerIds.includes(p.id));
        if (available.length === 0) {
          set({ simRunning: false });
          return;
        }
        if (pick.isMyPick) {
          // Don't auto-draft for the user during a plain sim step; caller
          // should use pickForMe() explicitly. Pause the runner instead.
          set({ simRunning: false });
          return;
        }
        const botRoster = state.rosters[pick.teamIndex] ?? [];
        const chosen = pickForBot(botRoster, available, state.allPlayers, state.settings, pick.pickNumber);
        get().draftPlayer(chosen.id, pick.teamIndex);
      },

      pickForMe: () => {
        const state = get();
        if (state.currentPickIndex >= state.picks.length) return;
        const pick = state.picks[state.currentPickIndex];
        const available = state.allPlayers.filter((p) => !state.draftedPlayerIds.includes(p.id));
        if (available.length === 0) return;
        const myFuturePicks = computeMyPickNumbers(state.settings).filter((n) => n > pick.pickNumber);
        const recs = topRecommendations(
          available,
          state.rosters[pick.teamIndex] ?? [],
          state.allPlayers,
          state.settings,
          pick.pickNumber,
          myFuturePicks[0] ?? null,
          1
        );
        if (recs.length) get().draftPlayer(recs[0].player.id, pick.teamIndex);
      },

      fastForwardToMyPick: () => {
        const state = get();
        let guard = 0;
        while (guard < 500) {
          const s = get();
          if (s.currentPickIndex >= s.picks.length) break;
          const pick = s.picks[s.currentPickIndex];
          if (pick.isMyPick) break;
          get().simStep();
          guard++;
        }
      },

      setSimRunning: (v) => set({ simRunning: v }),
      setSimSpeed: (spd) => set({ simSpeed: spd }),

      applyExternalPick: (evt) => {
        const state = get();
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
        const target = norm(evt.playerName);
        const match = state.allPlayers.find((p) => {
          if (state.draftedPlayerIds.includes(p.id)) return false;
          const nameMatch = norm(p.name) === target || norm(p.name).includes(target) || target.includes(norm(p.name));
          if (!evt.playerTeam) return nameMatch;
          return nameMatch && (p.team.toLowerCase() === evt.playerTeam.toLowerCase() || true);
        });
        if (!match) return false;

        const signature = `${evt.pickNumber ?? state.currentPickIndex}-${match.id}`;
        if (state.lastSyncedPickSignature === signature) return true;

        const pick = state.picks[state.currentPickIndex];
        const teamIndex = pick ? pick.teamIndex : 0;
        get().draftPlayer(match.id, teamIndex);
        set({ lastSyncedPickSignature: signature, syncConnected: true });
        return true;
      },

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
        picks: state.picks,
        currentPickIndex: state.currentPickIndex,
        draftedPlayerIds: state.draftedPlayerIds,
        rosters: state.rosters,
        watchlist: state.watchlist,
        teams: state.teams,
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

export function selectAvailablePlayers(state: DraftStoreState): Player[] {
  return state.allPlayers.filter((p) => !state.draftedPlayerIds.includes(p.id));
}

export function selectMyRoster(state: DraftStoreState): string[] {
  const myTeam = state.teams.find((t) => t.isUser);
  return myTeam ? state.rosters[myTeam.index] ?? [] : [];
}

export function selectCurrentPick(state: DraftStoreState): DraftPick | null {
  return state.picks[state.currentPickIndex] ?? null;
}

export function selectMyFuturePickNumbers(state: DraftStoreState): number[] {
  const current = selectCurrentPick(state);
  const all = computeMyPickNumbers(state.settings);
  if (!current) return [];
  return all.filter((n) => n >= current.pickNumber);
}
