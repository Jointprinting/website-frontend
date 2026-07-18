// src/screens/studio/_catalogEdit.js
//
// Pure save helpers for the Printer Catalog price-book editor, kept out of the
// component (no React/axios) so they're unit-testable. The editor edits every
// leaf as a raw STRING (so typing a decimal like "6.60" never jumps), then
// coerces back to the section's ORIGINAL shape on save — a value that was a
// number stays a number (blank/garbage → 0), a string/null stays as it was, and
// no key or array length is ever added or dropped. That's the whole contract
// that keeps a hand-edit from producing a section the pricing engine can't read.

// Immutable deep-set along a key/index path — replaces one leaf without touching
// the rest of the structure (so the engine's `model` contract always holds).
export function setAtPath(root, path, val) {
  if (!path.length) return val;
  const [head, ...rest] = path;
  const clone = Array.isArray(root) ? root.slice() : { ...(root || {}) };
  clone[head] = setAtPath(root ? root[head] : undefined, rest, val);
  return clone;
}

// Coerce the string-edited draft back to the ORIGINAL section's shape: a number
// leaf stays numeric (blank/garbage → 0), everything else (string/boolean/null)
// passes through. Recurses by the ORIGINAL's keys/length, so the tree can only
// change values, never the shape.
export function coerceLikeShape(draft, orig) {
  if (orig !== null && typeof orig === 'object') {
    if (Array.isArray(orig)) return orig.map((o, i) => coerceLikeShape(draft ? draft[i] : undefined, o));
    const out = {};
    for (const k of Object.keys(orig)) out[k] = coerceLikeShape(draft ? draft[k] : undefined, orig[k]);
    return out;
  }
  if (typeof orig === 'number') { const n = Number(draft); return Number.isFinite(n) ? n : 0; }
  return draft;   // string / boolean / null pass through
}
