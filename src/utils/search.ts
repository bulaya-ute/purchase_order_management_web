const STRIP_RE = /[,.;:"'!?()[\]{}]/g;

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

// Returns -1 when query is empty — sentinel meaning "no filter, return full list".
// Returns 0 when no match — caller should hide the row.
export function scoreMatch(query: string, fields: (string | null | undefined)[]): number {
  const q = query.replace(STRIP_RE, '').trim().toLowerCase();
  if (!q) return -1;
  const words = q.split(/\s+/).filter(Boolean);
  const concat = fields.join(' ').replace(STRIP_RE, '').toLowerCase();
  const fullPhraseHits = countOccurrences(concat, q);
  const wordHits = words.reduce((sum, w) => sum + countOccurrences(concat, w), 0);
  return 2 * fullPhraseHits + wordHits;
}
