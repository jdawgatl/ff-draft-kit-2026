import type { NewsItem } from '../types';
import { normalizePlayerName } from './nameMatch';

interface EspnArticle {
  headline?: string;
  description?: string;
  published?: string;
  categories?: string[];
}

/**
 * Pulls ESPN's general NFL news feed (via our own proxy — see
 * api/espn/news.js) and matches headlines/descriptions to known player
 * names by substring search. This is a free bonus signal, not a precise
 * per-player feed: ESPN's endpoint isn't officially published for
 * third-party use and returns general NFL news rather than a per-athlete
 * API, so matching is heuristic. It's specifically useful for the kind of
 * story a structured injury_status field never captures — legal trouble,
 * suspensions, holdouts, depth-chart/role changes — since those show up
 * as narrative headlines.
 */
export async function fetchEspnPlayerNews(
  knownNames: string[]
): Promise<Map<string, NewsItem[]>> {
  const res = await fetch('/api/espn/news');
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `ESPN proxy responded ${res.status}`);

  const articles = (json.articles || []) as EspnArticle[];
  const nameIndex = knownNames.map((n) => ({ raw: n, norm: normalizePlayerName(n) }));

  const result = new Map<string, NewsItem[]>();
  for (const article of articles) {
    if (!article.headline) continue;
    const haystack = `${article.headline} ${article.description ?? ''}`;
    for (const { raw, norm } of nameIndex) {
      // Require the full player name (not just a normalized substring of
      // unrelated text) to appear as words in the headline/description.
      if (!raw || raw.length < 6) continue;
      if (!haystack.includes(raw)) continue;
      const item: NewsItem = {
        headline: article.headline,
        source: 'ESPN',
        category: article.categories?.[0],
        publishedAt: article.published,
      };
      const list = result.get(norm) ?? [];
      list.push(item);
      result.set(norm, list);
    }
  }
  return result;
}
