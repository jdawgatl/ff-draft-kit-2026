// Generates src/data/players.generated.json — the offline 2026 dataset.
//
// Player identity (name/team/position) and draft order come from a real
// consensus ADP snapshot (see raw-adp.mjs). Full-season *statistical*
// projections are produced by a position-specific usage-curve model driven
// by each player's rank within their position, plus small deterministic
// jitter so the curve isn't perfectly smooth. This keeps the dataset
// internally consistent and lets the in-app scoring engine (src/lib/scoring.ts)
// derive fantasy points, VORP, and tiers the same way it would for live
// data pulled via the in-app "Refresh Data" feature.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RAW_ADP, DST_ORDER, TEAM_NAMES, BYE_WEEKS } from './raw-adp.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- deterministic seeded PRNG (mulberry32) so builds are reproducible ----
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function jitter(rng, spread = 0.06) {
  return 1 + (rng() * 2 - 1) * spread;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function slug(name, team) {
  return `${name}-${team}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const KNOWN_ROOKIES = new Set([
  'Ashton Jeanty', 'Jeremiyah Love', 'Omarion Hampton', 'Cam Skattebo',
  'Tetairoa McMillan', 'Emeka Egbuka', 'Colston Loveland', 'Tyler Warren',
  'Matthew Golden', 'Luther Burden', 'RJ Harvey', 'Jaxson Dart',
  'Quinshon Judkins', 'Bhayshul Tuten', 'Kyle Monangai', 'TreVeyon Henderson',
  'Jack Bech', 'Travis Hunter', "Tre' Harris", 'Isaac TeSlaa', 'Dylan Sampson',
  'Woody Marks', 'Jordyn Tyson', 'Jayden Higgins', 'Harold Fannin',
  'Kaelon Black', 'Jonah Coleman', 'Nicholas Singleton', 'Cyrus Allen',
]);

// Positions this standard (non-IDP) league can roster.
const VALID_POS = new Set(['QB', 'RB', 'WR', 'TE', 'K']);

const filtered = RAW_ADP.filter(
  ([, name, team, pos]) => VALID_POS.has(pos) && team !== 'FA' && TEAM_NAMES[team]
);

// Track position rank as we walk the ADP-ordered list.
const posCounters = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0 };

const players = [];

for (const [marketRank, name, team, pos] of filtered) {
  posCounters[pos] += 1;
  const r = posCounters[pos]; // 1-based rank within position
  const id = slug(name, team);
  const rng = mulberry32(hashSeed(id));
  const bye = BYE_WEEKS[team] ?? 9;
  const stats = {};

  if (pos === 'QB') {
    const passAtt = Math.round(clamp(615 - 6.2 * r, 300, 615) * jitter(rng));
    const cmpPct = clamp(0.685 - 0.0028 * r, 0.585, 0.705);
    const passCmp = Math.round(passAtt * cmpPct);
    const ypa = clamp(7.7 - 0.02 * r, 6.4, 8.1) * jitter(rng, 0.03);
    const passYds = Math.round(passAtt * ypa);
    const passTd = Math.round(clamp(40 - 0.55 * r, 11, 40) * jitter(rng));
    const passInt = Math.round(clamp(6 + 0.16 * r, 5, 17) * jitter(rng));
    const sacksTaken = Math.round(clamp(26 + 0.32 * r, 18, 48) * jitter(rng));
    const rushYds = Math.round(clamp(560 - 17 * r, 15, 560) * jitter(rng, 0.15));
    const rushTd = Math.round(clamp(7.5 - 0.22 * r, 0, 8) * jitter(rng, 0.2));
    Object.assign(stats, {
      passAtt, passCmp, passYds, passTd, passInt, sacksTaken,
      rushAtt: Math.round(rushYds / 6.1), rushYds, rushTd,
      rushFumLost: Math.round(clamp(2 + r * 0.03, 1, 4)),
      twoPtConv: r <= 12 ? 1 : 0,
    });
  } else if (pos === 'RB') {
    const touches = clamp(335 - 8.6 * r, 45, 335) * jitter(rng);
    const rushShare = clamp(0.8 - r * 0.002, 0.62, 0.83);
    const rushAtt = Math.round(touches * rushShare);
    const ypc = clamp(4.35 - 0.008 * r, 3.55, 4.55) * jitter(rng, 0.04);
    const rushYds = Math.round(rushAtt * ypc);
    const rushTd = Math.max(0, Math.round((rushYds / 92) * jitter(rng, 0.25)));
    const rec = Math.max(0, Math.round(touches * (1 - rushShare) * jitter(rng, 0.1)));
    const recYds = Math.round(rec * clamp(7.9 - 0.01 * r, 6, 8.6));
    const recTd = Math.max(0, Math.round(recYds / 480));
    Object.assign(stats, {
      rushAtt, rushYds, rushTd,
      rushFumLost: Math.max(0, Math.round(clamp(1 + touches / 180, 0, 4))),
      twoPtConv: r <= 6 ? 1 : 0,
      targets: Math.round(rec * 1.32), rec, recYds, recTd,
    });
  } else if (pos === 'WR') {
    const targets = clamp(168 - 4.1 * r, 18, 168) * jitter(rng, 0.08);
    const catchRate = clamp(0.665 - 0.0011 * r, 0.54, 0.7);
    const rec = Math.round(targets * catchRate);
    const ypc = clamp(12.7 - 0.011 * r, 8.7, 14.2) * jitter(rng, 0.05);
    const recYds = Math.round(rec * ypc);
    const recTd = Math.max(0, Math.round((recYds / 148) * jitter(rng, 0.25)));
    const rushYds = r <= 25 ? Math.round(clamp(45 - r * 1.2, 0, 45) * jitter(rng, 0.4)) : 0;
    Object.assign(stats, {
      targets: Math.round(targets), rec, recYds, recTd,
      rushAtt: rushYds > 0 ? Math.round(rushYds / 7.2) : 0,
      rushYds, rushTd: rushYds > 60 ? 1 : 0,
      rushFumLost: 0,
      kickRetYds: r > 60 && r % 5 === 0 ? Math.round(180 * jitter(rng)) : 0,
      kickRetTd: r > 60 && r % 17 === 0 ? 1 : 0,
    });
  } else if (pos === 'TE') {
    const targets = clamp(108 - 3.2 * r, 12, 108) * jitter(rng, 0.08);
    const catchRate = clamp(0.685 - 0.001 * r, 0.6, 0.72);
    const rec = Math.round(targets * catchRate);
    const ypc = clamp(10.9 - 0.02 * r, 7.4, 11.8) * jitter(rng, 0.05);
    const recYds = Math.round(rec * ypc);
    const recTd = Math.max(0, Math.round((recYds / 118) * jitter(rng, 0.25)));
    Object.assign(stats, { targets: Math.round(targets), rec, recYds, recTd });
  } else if (pos === 'K') {
    Object.assign(stats, {
      fg0_39: Math.round(clamp(18 - 0.32 * r, 7, 20) * jitter(rng, 0.08)),
      fg40_49: Math.round(clamp(7.2 - 0.16 * r, 2, 9) * jitter(rng, 0.1)),
      fg50plus: Math.round(clamp(3.1 - 0.08 * r, 0, 5) * jitter(rng, 0.15)),
      fgMiss: Math.round(clamp(5 - 0.05 * r, 2, 6)),
      xpMade: Math.round(clamp(40 - 0.6 * r, 20, 46) * jitter(rng, 0.08)),
    });
  }

  players.push({
    id,
    name,
    team,
    position: pos,
    bye,
    injuryStatus: null,
    rookie: KNOWN_ROOKIES.has(name) || undefined,
    adpSeed: marketRank,
    stats,
  });
}

// ---- Team defenses (D/ST) ----
DST_ORDER.forEach((team, i) => {
  const r = i + 1;
  const rng = mulberry32(hashSeed(`DEF-${team}`));
  const stats = {
    defSacks: Math.round(clamp(50 - 0.85 * r, 26, 51) * jitter(rng, 0.06)),
    defInt: Math.round(clamp(16 - 0.22 * r, 8, 17) * jitter(rng, 0.1)),
    defFumRec: Math.round(clamp(11 - 0.1 * r, 6, 12) * jitter(rng, 0.1)),
    defSafety: r % 7 === 0 ? 1 : 0,
    defBlockKick: r % 6 === 0 ? 1 : 0,
    defTd: Math.max(0, Math.round(clamp(4.2 - 0.09 * r, 0, 5) * jitter(rng, 0.3))),
    pointsAllowedPerGame: Math.round(clamp(15.5 + 0.28 * r, 14, 27) * 10) / 10,
  };
  players.push({
    id: `def-${team.toLowerCase()}`,
    name: `${TEAM_NAMES[team]} D/ST`,
    team,
    position: 'DEF',
    bye: BYE_WEEKS[team] ?? 9,
    injuryStatus: null,
    // seed defenses into the ADP curve around picks 118-260, spaced by rank
    adpSeed: 118 + r * 4.4,
    stats,
  });
});

// ---- Final ADP: sort by adpSeed, assign clean sequential ADP + stdDev ----
players.sort((a, b) => a.adpSeed - b.adpSeed);
players.forEach((p, i) => {
  const adp = i + 1;
  p.adp = adp;
  p.adpStdDev = Math.round(clamp(2 + adp * 0.085, 2, 34) * 10) / 10;
  delete p.adpSeed;
});

// ---- Handcuff detection: 2nd-ADP RB on same NFL team handcuffs the 1st ----
const rbsByTeam = {};
for (const p of players) {
  if (p.position !== 'RB') continue;
  (rbsByTeam[p.team] ??= []).push(p);
}
for (const team of Object.keys(rbsByTeam)) {
  const list = rbsByTeam[team].sort((a, b) => a.adp - b.adp);
  if (list.length >= 2) {
    const lead = list[0];
    for (let i = 1; i < Math.min(list.length, 3); i++) {
      // Only tag as a "handcuff" if clearly a backup (meaningfully later ADP)
      if (list[i].adp - lead.adp >= 15) {
        list[i].handcuffFor = lead.id;
      }
    }
  }
}

const outPath = join(__dirname, '..', 'src', 'data', 'players.generated.json');
writeFileSync(outPath, JSON.stringify(players, null, 2));
console.log(`Wrote ${players.length} players to ${outPath}`);
const counts = players.reduce((acc, p) => ((acc[p.position] = (acc[p.position] ?? 0) + 1), acc), {});
console.log('By position:', counts);
