import { Flame, TrendingDown, Newspaper, Moon, Link2 } from 'lucide-react';
import type { Player } from '../types';
import { isSleeper } from '../lib/playerTags';

/**
 * Consistent set of small colored tags shown next to a player's name across
 * the app (Draft Board, player profile card, etc.) — quick-scan signals for
 * scrolling through long lists: injury status, rookie, sleeper, handcuff,
 * Sleeper waiver trending, and breaking news.
 */
export default function PlayerTags({
  player,
  handcuffLeadName,
}: {
  player: Player;
  /** Name of the lead back this player handcuffs, if any (see buildHandcuffLeadNameMap). */
  handcuffLeadName?: string;
}) {
  const sleeper = isSleeper(player);

  return (
    <>
      {player.injuryStatus && (
        <span
          title={`Injury designation: ${player.injuryStatus}`}
          className="ml-1.5 rounded bg-red-500/20 px-1 text-[9px] font-bold text-red-300"
        >
          {player.injuryStatus}
        </span>
      )}
      {player.rookie && (
        <span title="Rookie — first NFL season" className="ml-1.5 rounded bg-cyan-500/20 px-1 text-[9px] font-bold text-cyan-300">
          R
        </span>
      )}
      {sleeper && (
        <span title="Sleeper — our internal rank is well ahead of where he's actually being drafted (ADP), a likely value pick" className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-violet-500/20 px-1 text-[9px] font-bold text-violet-300">
          <Moon size={9} /> Sleeper
        </span>
      )}
      {handcuffLeadName && (
        <span
          title={`Handcuff for ${handcuffLeadName} — the primary backup if ${handcuffLeadName} gets hurt`}
          className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-fuchsia-500/20 px-1 text-[9px] font-bold text-fuchsia-300"
        >
          <Link2 size={9} /> Cuff
        </span>
      )}
      {player.trending === 'up' && (
        <span title={`Trending up on Sleeper waivers (${player.trendingCount ?? ''} adds, 24h)`}>
          <Flame size={11} className="ml-1 inline text-orange-400" />
        </span>
      )}
      {player.trending === 'down' && (
        <span title={`Trending down on Sleeper waivers (${player.trendingCount ?? ''} drops, 24h)`}>
          <TrendingDown size={11} className="ml-1 inline text-slate-500" />
        </span>
      )}
      {player.news?.[0] && (
        <span title={player.news.map((n) => `[${n.source}] ${n.headline}`).join('\n')}>
          <Newspaper size={11} className="ml-1 inline text-sky-400" />
        </span>
      )}
    </>
  );
}
