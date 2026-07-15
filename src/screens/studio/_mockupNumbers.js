// src/screens/studio/_mockupNumbers.js
//
// CLIENT MIRROR of website-backend/utils/mockupNumbers.js — keep the parsing/
// lettering identical so the Studio and the API never disagree on a mockup
// number. (Same rule the CRM stages / status options / tax rates follow.)
//
// A mockup number: #<6-digit base><letters><optional edit-version>
//   #000150A   project 150, colour A (e.g. red), original
//   #000150B   project 150, colour B (e.g. black), original
//   #000150A2  colour A, first EDIT (version 2)
//   #000150Z → #000150AA → #000150AB …   (bijective base-26 past 26 colours)
//
// Owner's model: LETTERS are garment-colour variants (separate mockups); the
// TRAILING NUMBER is the edit/version of one colour; edits group under their
// original. This file adds the DISPLAY helpers the tiles use (short badge, sort
// key, grouping) on top of the shared parse math.

// ── shared math (mirror of the backend) ──────────────────────────────────────
export function letterToNum(s) {
  let n = 0;
  for (const c of String(s || '').toUpperCase()) {
    const v = c.charCodeAt(0) - 64; // 'A' = 65
    if (v < 1 || v > 26) return 0;
    n = n * 26 + v;
  }
  return n;
}

export function numToLetter(n) {
  let s = '';
  let x = Math.floor(n);
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26); }
  return s;
}

// '#000150A2' → { base:'#000150', digits:'000150', letter:'A', letterNum:1, version:2 }
// Original (no trailing number) reads as version 1. Returns null when it doesn't parse.
export function parseMockupNum(num) {
  const m = String(num || '').trim().match(/^#?(\d+)([A-Za-z]+)(\d+)?$/);
  if (!m) return null;
  const digits = m[1];
  const letter = m[2].toUpperCase();
  const letterNum = letterToNum(letter);
  if (!letterNum) return null;
  const version = m[3] ? parseInt(m[3], 10) : 1;
  if (!version || version < 1) return null;
  return { base: `#${digits}`, digits, letter, letterNum, version };
}

// Build from parts; version ≤ 1 (the original) carries no trailing number.
export function formatMockupNum(base, letter, version = 1) {
  const b = String(base || '');
  const withHash = b.startsWith('#') ? b : `#${b}`;
  const v = Math.floor(version) || 1;
  return `${withHash}${String(letter || '').toUpperCase()}${v > 1 ? v : ''}`;
}

// ── display helpers (Studio-only) ────────────────────────────────────────────

// A short badge for a tile: the colour letter, plus "·v2" for an edit.
// '#000150A' → 'A' ; '#000150A2' → 'A·v2' ; unparseable → '' (promo/junk).
export function mockupBadge(num) {
  const p = parseMockupNum(num);
  if (!p) return '';
  return p.version > 1 ? `${p.letter}·v${p.version}` : p.letter;
}

// A sortable key so colours/edits sit together and in order: design → colour →
// version. Unparseable numbers (promo shots) sort last, by their raw string.
export function mockupSortKey(num) {
  const p = parseMockupNum(num);
  if (!p) return [1, '', 0, 0, String(num || '')];
  return [0, p.digits, p.letterNum, p.version, ''];
}

const _cmp = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
};

// Order a list of mockup tiles by their number so a design's colours (and each
// colour's edits) are adjacent and in sequence. `getNum` pulls the number off a
// tile (default: the tile itself is the number string). Stable, pure, non-mutating.
export function sortMockupTiles(tiles, getNum = (t) => t) {
  return (tiles || [])
    .map((t, i) => ({ t, i, k: mockupSortKey(getNum(t)) }))
    .sort((a, b) => _cmp(a.k, b.k) || (a.i - b.i))
    .map((x) => x.t);
}

// Group tiles into designs → colours → versions for a structured render.
// Returns: [{ base, colors: [{ letter, letterNum, versions: [tile…] }] }, …]
// plus a trailing { base:null, other:[tile…] } bucket for promo/unparseable tiles.
export function groupMockupTiles(tiles, getNum = (t) => t) {
  const designs = new Map();
  const other = [];
  for (const t of tiles || []) {
    const p = parseMockupNum(getNum(t));
    if (!p) { other.push(t); continue; }
    if (!designs.has(p.base)) designs.set(p.base, new Map());
    const colors = designs.get(p.base);
    if (!colors.has(p.letter)) colors.set(p.letter, { letter: p.letter, letterNum: p.letterNum, versions: [] });
    colors.get(p.letter).versions.push({ tile: t, version: p.version });
  }
  const out = [...designs.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([base, colors]) => ({
      base,
      colors: [...colors.values()]
        .sort((a, b) => a.letterNum - b.letterNum)
        .map((c) => ({ ...c, versions: c.versions.sort((a, b) => a.version - b.version).map((v) => v.tile) })),
    }));
  return { designs: out, other };
}
