export interface SearchableSheet {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly groupTitle: string;
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function haystack(sheet: SearchableSheet): string {
  return normalize(
    [
      sheet.title,
      sheet.description,
      sheet.groupTitle,
      sheet.id.replace(/-/g, ' '),
      ...sheet.keywords,
    ].join(' '),
  );
}

/**
 * Every whitespace-separated token must match somewhere in the sheet metadata.
 * The query is intentionally matched against curated keywords, not rendered
 * command text, so the sidebar can filter without evaluating sheet scripts.
 */
export function sheetMatches(sheet: SearchableSheet, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }
  const text = haystack(sheet);
  return tokens.every((token) => text.includes(token));
}
