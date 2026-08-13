// src/common/garmentShade.js
//
// GARMENT COLOUR NAME → PRINT SHADE LANE.
//
// The print engine prices screen and DTG off a shade: a dark garment reads the
// light-ink-on-dark grid and carries a white underbase (an extra colour AND an
// extra screen per location — see printerPricing.screenPrintQuote), a light
// garment reads the dark-ink-on-light grid with no underbase. That is a real
// cost difference, not a cosmetic one: the same design on black and on white is
// two different jobs at two different prices, which is exactly why they cannot
// be combined into one cheaper quantity tier.
//
// The owner types a colour NAME ("Black", "Sport Grey", "Natural") because that
// is what S&S calls it and what the client recognises. This maps that name onto
// the lane the pricing engine needs, so duplicating a design into another colour
// reprices itself instead of silently inheriting the source colour's cost.
//
// Deliberately conservative: only well-known garment colour words decide, and
// anything unrecognised returns null so the CALLER keeps the shade it already
// had rather than a guess quietly repricing a job. Pure and dependency-free.

// Words that make a garment DARK enough to need a white underbase. Ordered
// longest-first at match time so "light blue" never matches on "blue".
const DARK = [
  'black', 'navy', 'charcoal', 'forest', 'maroon', 'burgundy', 'brown', 'chocolate',
  'olive', 'army', 'hunter', 'royal', 'purple', 'violet', 'indigo', 'espresso',
  'graphite', 'gunmetal', 'slate', 'dark heather', 'dark grey', 'dark gray',
  'heather navy', 'heather black', 'true navy', 'midnight', 'onyx', 'jet',
  'red', 'cardinal', 'crimson', 'scarlet', 'green', 'blue', 'teal', 'turquoise',
];

// Words that make a garment LIGHT enough to print dark ink straight onto.
const LIGHT = [
  'white', 'natural', 'ivory', 'cream', 'sand', 'ash', 'silver', 'banana',
  'light grey', 'light gray', 'light blue', 'light pink', 'baby blue', 'powder',
  'sport grey', 'sport gray', 'heather grey', 'heather gray', 'oatmeal',
  'yellow', 'gold', 'lemon', 'khaki', 'tan', 'beige', 'mint', 'lime', 'peach',
];

// 'Sport Grey' → 'light' · 'Black' → 'dark' · 'Chartreuse' → null (unknown).
// A colour naming BOTH families resolves on the longer, more specific match —
// "light blue" is light even though it contains "blue".
export function garmentShade(colorName) {
  const s = String(colorName == null ? '' : colorName).trim().toLowerCase();
  if (!s) return null;
  let best = null;
  const scan = (words, shade) => {
    for (const w of words) {
      if (s.includes(w) && (!best || w.length > best.len)) best = { shade, len: w.length };
    }
  };
  scan(LIGHT, 'light');
  scan(DARK, 'dark');
  return best ? best.shade : null;
}

// Does swapping to this colour change the lane we are currently pricing on?
// Returns the NEW shade when it genuinely differs and is known, else null —
// so callers can leave a hand-set shade alone.
export function shadeChangeFor(colorName, currentShade) {
  const next = garmentShade(colorName);
  if (!next) return null;
  // whiteInkOnly is a deliberate DTG lane the owner picked; never override it
  // from a colour name.
  if (currentShade === 'whiteInkOnly') return null;
  return next === currentShade ? null : next;
}
