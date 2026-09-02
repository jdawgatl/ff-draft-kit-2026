import { useMemo } from 'react';
import { Link2, Star } from 'lucide-react';
import { useDraftStore } from '../store/draftStore';
import { POSITION_COLORS } from '../lib/format';

export default function HandcuffMatrix() {
  const allPlayers = useDraftStore((s) => s.allPlayers);
  const draftedIds = useDraftStore((s) => s.liveDraftedPlayerIds);
  const watchlist = useDraftStore((s) => s.watchlist);
  const toggleWatch = useDraftStore((s) => s.toggleWatch);
  const draftPlayer = useDraftStore((s) => s.liveDraftPlayer);
  const setViewingPlayer = useDraftStore((s) => s.setViewingPlayer);
  const draftedSet = useMemo(() => new Set(draftedIds), [draftedIds]);

  const pairs = useMemo(() => {
    const byId = new Map(allPlayers.map((p) => [p.id, p]));
    const leads = allPlayers.filter((p) => p.position === 'RB');
    return leads
      .map((lead) => ({
        lead,
        cuffs: allPlayers.filter((p) => p.handcuffFor === lead.id).map((c) => byId.get(c.id)!),
      }))
      .filter((row) => row.cuffs.length > 0)
      .sort((a, b) => a.lead.adp - b.lead.adp);
  }, [allPlayers]);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-100">
        <Link2 size={15} className="text-emerald-400" />
        RB Handcuff Matrix
      </div>
      <p className="mb-4 max-w-2xl text-xs text-slate-500">
        Lead backs paired with their same-team backup — the highest-upside "insurance" pick to
        protect your investment, especially valuable for the RBs you already own or are targeting.
      </p>

      <div className="grid gap-2 md:grid-cols-2">
        {pairs.map(({ lead, cuffs }) => (
          <div key={lead.id} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${POSITION_COLORS.RB}`}>
                  RB{lead.positionRank}
                </span>
                <button
                  onClick={() => setViewingPlayer(lead.id)}
                  className={`text-sm font-semibold hover:underline ${draftedSet.has(lead.id) ? 'text-slate-500 line-through' : 'text-slate-100 hover:text-emerald-300'}`}
                >
                  {lead.name}
                </button>
                <span className="text-[10px] text-slate-500">{lead.team}</span>
              </div>
              {draftedSet.has(lead.id) && (
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">
                  On Your Roster
                </span>
              )}
            </div>
            <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-2">
              {cuffs.map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs">
                  <button
                    onClick={() => setViewingPlayer(c.id)}
                    className={`hover:underline ${draftedSet.has(c.id) ? 'text-slate-500 line-through' : 'text-slate-300 hover:text-emerald-300'}`}
                  >
                    ↳ {c.name}
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500">ADP {Math.round(c.adp)}</span>
                    <button onClick={() => toggleWatch(c.id)}>
                      <Star
                        size={12}
                        className={watchlist.includes(c.id) ? 'fill-amber-400 text-amber-400' : 'text-slate-600 hover:text-slate-400'}
                      />
                    </button>
                    {!draftedSet.has(c.id) && (
                      <button
                        onClick={() => draftPlayer(c.id)}
                        className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-emerald-500"
                      >
                        Draft
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {pairs.length === 0 && <p className="text-xs text-slate-500">No clear handcuff pairs identified yet.</p>}
      </div>
    </div>
  );
}
