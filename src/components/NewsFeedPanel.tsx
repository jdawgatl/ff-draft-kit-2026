import { useMemo } from 'react';
import { Newspaper, Flame } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';
import { POSITION_COLORS } from '../lib/format';

/**
 * Surfaces the "did anything change today" signals the offline dataset
 * can't capture on its own: FantasyPros/ESPN headlines (injuries, legal
 * trouble, suspensions, role changes — anything that shows up as a
 * narrative story rather than a structured stat) and Sleeper's trending
 * adds, which are often the first signal something happened. Populated by
 * the "Refresh Data" button in the header.
 */
export default function NewsFeedPanel() {
  const allPlayers = useDraftStore((s) => s.allPlayers);

  const newsItems = useMemo(() => {
    const items: { playerName: string; position: string; team: string; headline: string; source: string }[] = [];
    for (const p of allPlayers) {
      for (const n of p.news ?? []) {
        items.push({ playerName: p.name, position: p.position, team: p.team, headline: n.headline, source: n.source });
      }
    }
    return items.slice(0, 8);
  }, [allPlayers]);

  const trending = useMemo(
    () =>
      allPlayers
        .filter((p) => p.trending === 'up')
        .sort((a, b) => (b.trendingCount ?? 0) - (a.trendingCount ?? 0))
        .slice(0, 5),
    [allPlayers]
  );

  if (newsItems.length === 0 && trending.length === 0) return null;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <Newspaper size={15} className="text-sky-400" />
        Latest News & Buzz
      </div>

      {trending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {trending.map((p) => (
            <span
              key={p.id}
              title={`${p.trendingCount ?? ''} adds league-wide, 24h`}
              className="inline-flex items-center gap-1 rounded-full border border-orange-700/40 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-300"
            >
              <Flame size={10} /> {p.name}
            </span>
          ))}
        </div>
      )}

      <div className="max-h-56 space-y-2 overflow-y-auto">
        {newsItems.map((n, i) => (
          <div key={i} className="border-b border-slate-800/60 pb-1.5 last:border-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-200">{n.playerName}</span>
              <span className={`rounded border px-1 text-[8px] font-semibold ${POSITION_COLORS[n.position as keyof typeof POSITION_COLORS] ?? ''}`}>
                {n.position}
              </span>
              <span className="text-[9px] text-slate-600">{n.source}</span>
            </div>
            <p className="text-[11px] leading-snug text-slate-400">{n.headline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
