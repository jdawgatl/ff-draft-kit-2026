// Core domain types for the Fantasy Football Draft Kit

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';

export type RosterSlot = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF' | 'BENCH' | 'IR';

/** Raw seasonal statistical projection used as the scoring-engine input. */
export interface StatLine {
  passAtt?: number;
  passCmp?: number;
  passYds?: number;
  passTd?: number;
  passInt?: number;
  sacksTaken?: number;

  rushAtt?: number;
  rushYds?: number;
  rushTd?: number;
  rushFumLost?: number;
  twoPtConv?: number;

  targets?: number;
  rec?: number;
  recYds?: number;
  recTd?: number;

  kickRetYds?: number;
  kickRetTd?: number;
  puntRetYds?: number;
  puntRetTd?: number;

  // Kicker
  fg0_39?: number;
  fg40_49?: number;
  fg50plus?: number;
  fgMiss?: number;
  xpMade?: number;

  // DEF/ST
  defSacks?: number;
  defInt?: number;
  defFumRec?: number;
  defSafety?: number;
  defBlockKick?: number;
  defTd?: number;
  pointsAllowedPerGame?: number;
}

export interface PlayerBio {
  id: string;
  name: string;
  team: string;
  position: Position;
  bye: number;
  injuryStatus?: 'Q' | 'D' | 'O' | 'IR' | 'PUP' | 'SUS' | null;
  rookie?: boolean;
}

export interface Player extends PlayerBio {
  stats: StatLine;
  projectedPoints: number;
  adp: number; // overall consensus ADP (1 = first overall)
  adpStdDev: number; // spread used for availability forecasting
  positionRank: number;
  overallRank: number;
  vorp: number;
  tier: number; // 1-6, computed per position

  handcuffFor?: string; // player id of the starter this player handcuffs

  // Optional live-data overlays, populated by "Refresh Data" (all off by
  // default until a refresh runs; never required for the app to function).
  expertRank?: number; // FantasyPros consensus expert rank (ECR), if key configured
  expertTier?: number; // FantasyPros consensus tier, if key configured
  trending?: 'up' | 'down'; // Sleeper trending adds/drops signal
  trendingCount?: number;
  news?: NewsItem[]; // most recent headlines, newest first (capped ~3)
}

export interface NewsItem {
  headline: string;
  source: 'FantasyPros' | 'ESPN';
  category?: string; // e.g. 'injury', 'transaction', 'rumor'
  publishedAt?: string;
}

export interface DraftPick {
  pickNumber: number; // 1-based overall pick
  round: number;
  slotInRound: number;
  teamIndex: number; // 0-based, 0 = "My Team"
  playerId: string | null;
  isMyPick: boolean;
  source?: 'sim' | 'live-sync' | 'manual';
}

export interface TeamInfo {
  index: number;
  name: string;
  isUser: boolean;
}

export interface LeagueSettings {
  teams: number;
  myPickSlot: number; // 1-based draft slot, e.g. 6
  rounds: number;
  rosterSlots: Record<RosterSlot, number>;
  scoring: ScoringSettings;
}

export interface ScoringSettings {
  passing: {
    tdPts: number;
    ydsPerPt: number; // yards per 1 point, e.g. 25 => 0.04/yd
    completionPts: number;
    interceptionPts: number; // negative
    sackTakenPts: number; // negative
    milestones: { yds: number; pts: number }[];
  };
  rushing: {
    tdPts: number;
    ydsPerPt: number; // e.g. 10 => 0.1/yd
    twoPtPts: number;
    fumbleLostPts: number; // negative
    milestones: { yds: number; pts: number }[];
  };
  receiving: {
    receptionPts: number;
    tdPts: number;
    ydsPerPt: number;
    milestones: { yds: number; pts: number }[];
  };
  returns: {
    ydsPerPt: number; // e.g. 35 => 0.0285/yd
    tdPts: number;
  };
  kicking: {
    fg0_39: number;
    fg40_49: number;
    fg50plus: number;
    xp: number;
  };
  defense: {
    sackPts: number;
    turnoverPts: number; // INT / fumble recovery
    safetyPts: number;
    blockedKickPts: number;
    tdPts: number;
    pointsAllowedTiers: { max: number; pts: number }[];
  };
}

export interface WatchlistState {
  [playerId: string]: true;
}

export interface DraftState {
  settings: LeagueSettings;
  picks: DraftPick[];
  currentPickIndex: number; // 0-based index into picks[]
  draftedPlayerIds: Set<string>;
  watchlist: Set<string>;
  myRoster: string[];
  teams: TeamInfo[];
  simRunning: boolean;
  simSpeed: 1 | 2 | 0; // 0 = instant
  syncConnected: boolean;
}

export interface AvailabilityForecast {
  playerId: string;
  pickNumber: number;
  picksUntil: number;
  survivalProbability: number; // 0-1
  label: 'likely' | 'tossup' | 'unlikely';
}
