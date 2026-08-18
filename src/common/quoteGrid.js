// src/common/quoteGrid.js
//
// THE quote design-grid vocabulary — one definition of what makes a set of
// quote lines a "brands/variants × quantities" matrix, shared by the owner's
// builder (QuoteBuilder) and the client's approval page (ApprovalView) so the
// two can never drift: if the builder shows a design as a grid, the client
// sees the matrix picker for exactly the same rows.
//
// Row identity: style + product name + print details + color, trimmed and
// lowercased. printDetails is what lets two rows be the SAME garment with
// different print specs ("6c front" vs "7c front", each with its own print +
// setup cost); color keeps a black-at-50 / white-at-100 pitch as two distinct
// rows instead of one ambiguous one. Cost fields are deliberately NOT part of
// the identity.

export const quoteRowKey = (l) =>
  ['styleCode', 'description', 'printDetails', 'color']
    .map((k) => String((l && l[k]) || '').trim().toLowerCase())
    .join('|');

const EMPTY_ROW_KEY = quoteRowKey({});

// Does one group's set of lines form a complete rows × quantities matrix —
// every distinct row quoted at every distinct quantity, exactly once, with
// ≥2 quantity columns? Returns { qtys, keys, rows } (rows are the original
// line objects, per row key, sorted by qty) or null — callers fall back to
// their flat-list rendering and nothing else changes.
export function detectGridRows(lines) {
  if (!Array.isArray(lines) || lines.length < 2) return null;
  const qtys = [...new Set(lines.map((l) => Number(l && l.qty) || 0))].sort((a, b) => a - b);
  if (qtys.length < 2 || qtys[0] <= 0) return null;
  const keys = [...new Set(lines.map(quoteRowKey))];
  if (keys.some((k) => k === EMPTY_ROW_KEY)) return null;         // fully unnamed rows can't key a matrix
  if (keys.length * qtys.length !== lines.length) return null;
  const seen = new Set();
  for (const l of lines) {
    const cell = `${quoteRowKey(l)}@${Number(l.qty) || 0}`;
    if (seen.has(cell)) return null;                              // duplicate combo → not a matrix
    seen.add(cell);
  }
  return {
    qtys,
    keys,
    rows: keys.map((k) => lines.filter((l) => quoteRowKey(l) === k)
      .sort((a, b) => (Number(a.qty) || 0) - (Number(b.qty) || 0))),
  };
}
