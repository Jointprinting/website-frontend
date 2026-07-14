// src/common/printerPricing.js
//
// Pure screen-print pricing against a printer's scraped catalog (Heritage
// first — data/printerCatalog-heritage.json served by /api/printers/:key).
// The quoter's "price my print spec" engine: given quantity, print locations
// (each with its ink-color count) and garment shade, it returns the per-unit
// print cost + one-time setup exactly the way the price guide bills:
//
//   • Tiers are DOZENS-based floors: a qty prices at the largest tier whose
//     pieces floor it reaches (100 pcs → the 6-dz tier). Under 12 pieces the
//     1-dz tier + minimums govern.
//   • Prices are PER PIECE, PER LOCATION, chosen by color-count column.
//   • Dark garments use the light-ink-on-dark grid AND carry a white
//     underbase: +1 color per location for both the column and the screens.
//   • $20 minimum per print per color: a location's run charge is floored at
//     $20 × colors.
//   • Setup = $20 per screen (one screen per color, incl. the underbase).
//     Exact reorders within 14 days re-use screens (fee waived) — surfaced
//     as a note, never auto-applied.
//
// Unit-tested in printerPricing.test.js against values read straight off the
// catalog. Returns null when the catalog can't price the spec (with reasons).

const num = (v) => Number(v) || 0;

// The grid's color columns, in order. A location's effective color count
// (colors + underbase) picks the column; >12 is beyond the guide.
const COLUMN_FOR = (effColors) => {
  if (effColors <= 0) return null;
  if (effColors <= 3) return String(effColors);
  if (effColors <= 5) return '4-5';
  if (effColors <= 8) return '6-8';
  if (effColors <= 12) return '9-12';
  return null;
};

// Largest tier whose pieces floor the quantity reaches (see tier table in the
// catalog: 1dz=12+, 2dz=24+, … 500dz=6000+). Below 12 pieces → the 1-dz row.
function tierRowFor(rows, qty) {
  let best = rows[0] || null;
  for (const r of rows) {
    if (qty >= num(r.pieces)) best = r;
  }
  return best;
}

// screenPrintQuote(catalog.screenPrinting, {
//   qty, shade: 'light'|'dark', locations: [{ label, colors }],
// }) → { printPerUnit, setup, screens, breakdown[], warnings[], notes[] } | null
export function screenPrintQuote(sp, { qty, shade = 'light', locations = [] }) {
  if (!sp || !sp.priceGrids) return null;
  const grids = sp.priceGrids;
  const grid = shade === 'dark' ? grids.lightInkOnDarkGarments : grids.darkInkOnLightGarments;
  const rows = grid && grid.rows;
  if (!Array.isArray(rows) || !rows.length) return null;
  const q = Math.max(0, Math.round(num(qty)));
  if (q <= 0) return null;
  const locs = (locations || []).filter((l) => l && num(l.colors) > 0);
  if (!locs.length) return null;

  const perScreen = num(sp.screenFees && sp.screenFees.perScreen) || 20;
  const minPerColor = num(sp.minimums && sp.minimums.perPrintPerColor) || 20;
  const underbase = shade === 'dark' ? 1 : 0;

  const row = tierRowFor(rows, q);
  const warnings = [];
  if (q < num(rows[0].pieces)) warnings.push(`Under ${rows[0].pieces} pieces the guide has no tier — priced at the smallest tier + minimums; confirm with the printer.`);

  let perUnit = 0;
  let screens = 0;
  const breakdown = [];
  for (const loc of locs) {
    const colors = Math.round(num(loc.colors));
    const effColors = colors + underbase;
    const col = COLUMN_FOR(effColors);
    if (!col) { warnings.push(`${loc.label || 'location'}: ${effColors} colors is beyond the guide's 12-color max.`); return { error: 'over-max-colors', warnings }; }
    const piece = row.prices ? row.prices[col] : null;
    if (piece == null) { warnings.push(`${loc.label || 'location'}: no price at this quantity for ${effColors} colors (N/A tier in the guide).`); return { error: 'na-tier', warnings }; }
    // $20/color minimum per print: floor the location's whole run charge.
    const run = Math.max(num(piece) * q, minPerColor * effColors);
    const unitShare = run / q;
    perUnit += unitShare;
    screens += effColors;
    breakdown.push({
      label: loc.label || 'location', colors, effColors, column: col,
      piecePrice: num(piece), floored: run > num(piece) * q,
      perUnit: +unitShare.toFixed(4),
    });
  }

  const notes = [];
  if (underbase) notes.push('Dark garment: +1 white underbase color per location (column + screens) — light-ink-on-dark grid.');
  notes.push('Exact reorder within 14 days: screen fees waived by the printer — knock the setup off manually when it applies.');

  return {
    printPerUnit: +perUnit.toFixed(2),
    setup: +(screens * perScreen).toFixed(2),
    screens,
    tier: { dozens: row.quantityDozens, pieces: row.pieces },
    breakdown,
    warnings,
    notes,
  };
}

// Compose the human print-details string the quote line carries, e.g.
// "3c front + 1c back" (+" · dark garment" when the underbase applies).
export function specDetails({ shade = 'light', locations = [] }) {
  const parts = (locations || []).filter((l) => l && num(l.colors) > 0)
    .map((l) => `${Math.round(num(l.colors))}c ${String(l.label || 'front').trim()}`);
  return parts.join(' + ') + (shade === 'dark' ? ' · dark garment' : '');
}
