import type { Position } from '../types';

export const POSITION_COLORS: Record<Position, string> = {
  QB: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  RB: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  WR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  TE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  K: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  DEF: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

export const TIER_COLORS: Record<number, string> = {
  1: 'text-yellow-300',
  2: 'text-lime-300',
  3: 'text-cyan-300',
  4: 'text-indigo-300',
  5: 'text-fuchsia-300',
  6: 'text-slate-400',
};

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export function formatPick(pickNumber: number, teams: number): string {
  const round = Math.ceil(pickNumber / teams);
  const slot = pickNumber - (round - 1) * teams;
  return `R${round}.${String(slot).padStart(2, '0')} (#${pickNumber})`;
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}
