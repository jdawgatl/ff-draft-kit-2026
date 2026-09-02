/** Shared player-name normalization used to match across data sources
 * (Sleeper, FantasyPros, ESPN, Yahoo DOM scrape) that each spell names
 * slightly differently (suffixes, punctuation, accents). */
export function normalizePlayerName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, '')
    .replace(/[^a-z]/g, '');
}

/** Builds a normalized-name -> value lookup map, first-write-wins. */
export function buildNameIndex<T>(items: T[], nameOf: (item: T) => string): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = normalizePlayerName(nameOf(item));
    if (key && !map.has(key)) map.set(key, item);
  }
  return map;
}
