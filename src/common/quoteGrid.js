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

// ── How many options of a group may the client take? ─────────────────────────
//
// MIRROR of website-backend/utils/quoteGroups.js — keep the two identical, the
// same way the CRM stages / tax rates / mockup numbers are mirrored. The server
// enforces this in publicSelectOptions; this copy is what the picker renders
// from, so a divergence would show the client a choice the API then rejects.
//
// A `group` has always meant "alternatives — pick ONE", which is right for
// brands and wrong for colourways: 50 black + 50 white of one design is two runs
// the client wants BOTH of, not a choice. So a group carries a mode — `one_of`
// (brands) or `any_of` (colourways, add-ons) — derived by default and pinnable
// per group via `groupMode` on the line.
//
// An any_of group does NOT combine quantities into a better tier, deliberately:
// different garment shades mean different screens and a different ink lane, so
// each colour keeps its own line, setup and tier. This decides selection only.

export const VALID_PICK_MODES = ['one_of', 'any_of'];

const _s = (v) => String(v == null ? '' : v).trim().toLowerCase();

// Row identity WITHOUT the colour — "which design is this line about".
export const designKey = (l) =>
  ['styleCode', 'description', 'printDetails'].map((k) => _s(l && l[k])).join('|');

// An owner-pinned mode on any line of the group wins (stored per line, the same
// way `group` itself is).
function pinnedMode(lines) {
  for (const l of lines || []) {
    const m = _s(l && l.groupMode);
    if (VALID_PICK_MODES.includes(m)) return m;
  }
  return '';
}

// Are these lines colourways of ONE design — same style/product/print spec,
// differing only in garment colour? Every line must NAME a colour; a blank means
// the owner expressed the option some other way and we must not guess.
export function isColourSet(lines) {
  const ls = (lines || []).filter(Boolean);
  if (ls.length < 2) return false;
  if (ls.some((l) => !_s(l.color))) return false;
  if (new Set(ls.map((l) => _s(l.color))).size < 2) return false;
  return new Set(ls.map(designKey)).size === 1;
}

// The mode for one group's lines: pinned if set, else derived.
export function groupPickMode(lines) {
  return pinnedMode(lines) || (isColourSet(lines) ? 'any_of' : 'one_of');
}

// { groupName: mode } across a whole quote. Ungrouped lines carry no mode.
export function groupPickModes(lines) {
  const byGroup = new Map();
  for (const l of lines || []) {
    const g = l && l.group;
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(l);
  }
  const out = {};
  byGroup.forEach((ls, g) => { out[g] = groupPickMode(ls); });
  return out;
}

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
