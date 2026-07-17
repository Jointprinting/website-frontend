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

// The tier's piece FLOOR as an integer. The catalog's top row carries this as a
// STRING — `pieces: "6000+"` (the 500-dozen tier). Number("6000+") is NaN, and
// the old `num()` collapsed that to 0 — so `qty >= 0` matched EVERY quantity and
// the top (cheapest) tier silently won every quote, under-pricing the whole job.
// parseInt reads the leading number and stops at the "+", so "6000+" → 6000 and a
// plain number passes through. NaN (missing/garbage) → the row is skipped.
const piecesFloor = (r) => parseInt(String(r && r.pieces), 10);

// Largest tier whose pieces floor the quantity reaches (see tier table in the
// catalog: 1dz=12+, 2dz=24+, … 500dz=6000+). Below 12 pieces → the 1-dz row.
function tierRowFor(rows, qty) {
  let best = rows[0] || null;
  for (const r of rows) {
    const floor = piecesFloor(r);
    if (Number.isFinite(floor) && qty >= floor) best = r;
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

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-METHOD ENGINE
//
// Heritage's catalog is one shape; the printers scanned since (Print Hybrid, A+,
// Contract-DTG) each price differently — screen by qty×colors, Digital Squeegee
// by qty alone, DTG by qty×size×shade, embroidery by qty×stitches, DTF by
// gang sheet. So every price-book SECTION now self-describes its `model`, and
// priceMethod() dispatches on it. Every model returns the SAME normalized shape
// so the Quoter renders one way:
//
//   { printPerUnit, setup, tier: { label }, details, warnings[], notes[], screens? }
//
// Returns null when the section can't price the spec, or { error, warnings }
// for a spec that's out of the guide (over-max colors, incomplete grid, etc.).
// All pure + unit-tested in printerPricing.test.js against the real catalogs.

// Largest tier whose numeric `minQty` floor the quantity reaches.
function floorTier(tiers, qty) {
  let best = null;
  for (const t of tiers || []) {
    const f = num(t.minQty);
    if (qty >= f && (!best || f > num(best.minQty))) best = t;
  }
  return best || (tiers && tiers[0]) || null;
}

// qty × colors — Print Hybrid / A+ screen print. Setup is baked into the piece
// price ("included"), so no separate screen fee. Dark garments add one color
// (white underbase) per location, same rule the guides print.
function qtyColorsQuote(sp, { qty, shade = 'light', locations = [] }) {
  const q = Math.max(0, Math.round(num(qty)));
  if (!q || !Array.isArray(sp.tiers) || !sp.tiers.length) return null;
  const locs = (locations || []).filter((l) => l && num(l.colors) > 0);
  if (!locs.length) return null;
  const tier = floorTier(sp.tiers, q);
  if (!tier) return null;
  // Numeric color columns only (a trailing 'whiteInkOnly' column is a special
  // case picked by hand, not by color count).
  const numericCols = (sp.colorColumns || []).filter((c) => /^\d+$/.test(c));
  const maxColors = numericCols.length;
  const underbase = shade === 'dark' && sp.darkAddsUnderbaseColor ? 1 : 0;
  const warnings = [];
  let perUnit = 0;
  let setup = 0;      // per-color screen fees when the printer bills them separately
  let screens = 0;
  for (const loc of locs) {
    const effColors = Math.round(num(loc.colors)) + underbase;
    if (effColors < 1 || effColors > maxColors) {
      warnings.push(`${loc.label || 'location'}: ${effColors} colors is beyond this printer's ${maxColors}-color max.`);
      return { error: 'over-max-colors', warnings };
    }
    const price = tier.prices && tier.prices[effColors - 1];
    if (price == null) { warnings.push(`${loc.label || 'location'}: no price at this quantity/colors.`); return { error: 'na', warnings }; }
    perUnit += num(price);
    screens += effColors;
    // Setup: 'included' → nothing; a screenFees map (e.g. {"1":25,…}) → the
    // fee for this location's color count. Per screen/location, like the sheet.
    // `underbaseFreeScreen`: the underbase color prints (counts toward the piece
    // price + screen count) but carries NO screen setup fee (Garment Gear's rule),
    // so the fee is looked up on the real colors only.
    if (sp.screenFees) {
      const feeColors = sp.underbaseFreeScreen ? effColors - underbase : effColors;
      setup += num(sp.screenFees[String(feeColors)]);
    }
  }
  const notes = [];
  if (underbase) notes.push('Dark garment: +1 white underbase color per location.');
  if (sp.setup === 'included') notes.push('Setup / screen fees are baked into the per-piece price.');
  else if (setup > 0) notes.push('Setup = per-color screen fees (one-time; reorders reuse screens).');
  return { printPerUnit: +perUnit.toFixed(2), setup: +setup.toFixed(2), screens, tier: { label: tier.label }, warnings, notes };
}

// qty only — Print Hybrid Digital Squeegee (full color, one price by quantity).
function qtyOnlyQuote(sp, { qty }) {
  const q = Math.max(0, Math.round(num(qty)));
  if (!q || !Array.isArray(sp.tiers) || !sp.tiers.length) return null;
  const tier = floorTier(sp.tiers, q);
  if (!tier || tier.price == null) return null;
  return { printPerUnit: +num(tier.price).toFixed(2), setup: 0, screens: 0,
    tier: { label: String(tier.minQty) + '+' }, warnings: [], notes: ['Full-color digital — no per-color charge.'] };
}

// qty × size × shade — Contract-DTG DTG (print only, not the garment).
function qtySizeShadeQuote(sp, { qty, size, shade = 'light' }) {
  const q = Math.max(0, Math.round(num(qty)));
  if (!q || !Array.isArray(sp.tiers) || !sp.tiers.length) return null;
  if (!size || !(sp.sizes || []).includes(size)) return { error: 'pick-size', warnings: ['Pick a print size.'] };
  const tier = floorTier(sp.tiers, q);
  const pair = tier && tier.prices && tier.prices[size];
  if (!pair) return { error: 'na', warnings: ['No price at this quantity — request a quote.'] };
  const price = shade === 'dark' ? pair[0] : pair[1]; // [dark, white]
  return { printPerUnit: +num(price).toFixed(2), setup: 0, screens: 0, tier: { label: tier.label },
    warnings: [], notes: [`DTG ${size}, ${shade === 'dark' ? 'dark' : 'white'} garment — print only.`] };
}

// qty × size — Garment Gear DTG / DTF. Per-piece price from a size × quantity-tier
// grid (imprint size picks the column, qty floors the row). No shade split, no
// setup — the sheet's price is all-in per piece.
function qtySizeQuote(sp, { qty, size }) {
  const q = Math.max(0, Math.round(num(qty)));
  if (!q || !Array.isArray(sp.qtyTiers) || !sp.qtyTiers.length) return null;
  if (!size || !(sp.sizes || []).includes(size)) return { error: 'pick-size', warnings: ['Pick a print size.'] };
  const tier = floorTier(sp.qtyTiers, q);
  const idx = sp.qtyTiers.indexOf(tier);
  const row = sp.grid && sp.grid[size];
  const price = row && idx >= 0 ? row[idx] : null;
  if (price == null) return { error: 'na', warnings: ['No price at this quantity/size — request a quote.'] };
  return { printPerUnit: +num(price).toFixed(2), setup: 0, screens: 0,
    tier: { label: `${size} · ${tier.label}` }, warnings: [],
    notes: [`${sp.label || 'Print'} ${size} — per piece, all-in.`] };
}

// qty × stitches — A+ embroidery. Piece price by qty tier × stitch band, plus a
// one-time digitizing fee (setup) sized to the stitch count.
function qtyStitchesQuote(sp, { qty, stitches }) {
  const q = Math.max(0, Math.round(num(qty)));
  const st = Math.max(0, Math.round(num(stitches)));
  if (!q || !st) return { error: 'need-stitches', warnings: ['Enter the quantity and stitch count.'] };
  const tier = floorTier((sp.qtyTiers || []).map((t) => ({ ...t })), q);
  if (!tier) return null;
  // Band index: first band whose upper bound covers the stitch count.
  const bandMax = (label) => {
    if (/^upto/i.test(label)) return parseInt(label.replace(/\D/g, ''), 10);
    const m = /(\d+)\s*-\s*(\d+)/.exec(label); return m ? Number(m[2]) : parseInt(label, 10);
  };
  const bands = sp.stitchBands || [];
  let bandIdx = bands.findIndex((b) => st <= bandMax(b));
  const warnings = [];
  if (bandIdx === -1) { bandIdx = bands.length - 1; warnings.push('Over the biggest stitch band — confirm with the printer (case-by-case over 78k).'); }
  const row = sp.grid && sp.grid[tier.label];
  const price = row && row[bandIdx];
  if (price == null) return { error: 'na', warnings: [...warnings, 'No price at this quantity/stitches.'] };
  // Digitizing (one-time): $30 up to 15k stitches, then $1 per 1k over.
  const f = sp.fees || {};
  const digitizing = st <= 15000 ? num(f.digitizingUpTo15k)
    : num(f.digitizingUpTo15k) + Math.ceil((st - 15000) / 1000) * num(f.digitizingPer1kOver15k);
  return { printPerUnit: +num(price).toFixed(2), setup: +digitizing.toFixed(2), screens: 0,
    tier: { label: `${tier.label} · ${bands[bandIdx]} st` }, warnings,
    notes: ['Setup = one-time digitizing (waived if the file is already digitized).'] };
}

// gang sheet, flat per sheet — Print Hybrid DTF ($/sheet, size fixed).
function gangFlatQuote(sp, { sheets = 1 }) {
  const n = Math.max(1, Math.round(num(sheets)));
  if (sp.pricePerSheet == null) return null;
  return { printPerUnit: +num(sp.pricePerSheet).toFixed(2), setup: 0, screens: 0,
    tier: { label: `${n} × ${sp.sheetSize || 'sheet'}` }, warnings: [],
    notes: [`DTF gang sheet ${sp.sheetSize || ''} — priced per sheet, not per garment.`] };
}

// gang sheet, qty × size — Contract-DTG DTF (per transfer).
function gangQtySizeQuote(sp, { qty, size }) {
  const q = Math.max(0, Math.round(num(qty)));
  if (!q) return null;
  if (!size || !(sp.sizes || []).includes(size)) return { error: 'pick-size', warnings: ['Pick a transfer size.'] };
  const col = floorTier(sp.qtyCols || [], q);
  const row = sp.grid && sp.grid[size];
  const idx = (sp.qtyCols || []).indexOf(col);
  const price = row && idx >= 0 ? row[idx] : null;
  if (price == null) return { error: 'na', warnings: ['Over the sheet quantity — call for pricing.'] };
  return { printPerUnit: +num(price).toFixed(2), setup: 0, screens: 0, tier: { label: `${size} · ${col.label}` },
    warnings: [], notes: ['DTF transfer, per piece.'] };
}

// Which qty tier ("1-11", "150-249", "250+") a quantity falls into. Pure.
function qtyInTier(tier, q) {
  const s = String(tier || '').trim();
  if (s.endsWith('+')) return q >= parseInt(s, 10);
  const m = s.match(/^(\d+)\s*-\s*(\d+)$/);
  return m ? q >= +m[1] && q <= +m[2] : false;
}

// qty × transfer-size (sq in) — A+ DTF. Per-transfer price from a sqin-band × qty
// grid, plus a per-print apply fee that depends on placement (flat front/back vs
// non-flat sleeves/pockets/hats). Distinct from Contract-DTG's gang_qty_x_size
// (fixed size categories); here the size is a real square-inch area the user types.
function qtySizeSqinQuote(sp, { qty, sqin, placement = 'flat' }) {
  const q = Math.max(0, Math.round(num(qty)));
  if (!q) return null;
  const area = num(sqin);
  if (!area) return { error: 'pick-size', warnings: ['Enter the design size in square inches.'] };
  const bands = sp.sizeBandsSqin || [];
  const tiers = sp.qtyTiers || [];
  const warnings = [];
  // smallest band whose upper bound covers the design; cap at the largest band.
  let bandIdx = bands.findIndex((b) => area <= b);
  if (bandIdx === -1) { bandIdx = bands.length - 1; warnings.push('Over the largest size band — confirm with the printer.'); }
  const tier = tiers.find((t) => qtyInTier(t, q)) || tiers[tiers.length - 1];
  const row = sp.grid && sp.grid[tier];
  const base = row ? row[bandIdx] : null;
  if (base == null) return { error: 'na', warnings: [...warnings, 'No price at this size/quantity.'] };
  const flat = placement !== 'nonflat';
  const apply = flat ? num(sp.applyToFlat) : num(sp.applyToNonFlat);
  if (sp.maxRecommendedSqin && area > sp.maxRecommendedSqin) {
    warnings.push(`Over the recommended ${sp.maxRecommendedSqin} sq in max print size.`);
  }
  return {
    printPerUnit: +(num(base) + apply).toFixed(2), setup: 0, screens: 0,
    tier: { label: `${bands[bandIdx]} sq in · ${tier}` }, warnings,
    notes: [`DTF transfer $${num(base).toFixed(2)}/pc + $${apply.toFixed(2)} ${flat ? 'flat' : 'non-flat'} apply.`],
  };
}

// The dispatcher. `section` is one method block off a printer's catalog
// (catalog.screenPrinting, catalog.dtg, …). Reads the block's `model` tag;
// falls back to Heritage's legacy priceGrids screen-print shape.
export function priceMethod(section, spec = {}) {
  if (!section) return null;
  switch (section.model) {
    case 'qty_x_colors': return qtyColorsQuote(section, spec);
    case 'qty_only': return qtyOnlyQuote(section, spec);
    case 'qty_x_size_x_shade': return qtySizeShadeQuote(section, spec);
    case 'qty_x_size': return qtySizeQuote(section, spec);
    case 'qty_x_stitches': return qtyStitchesQuote(section, spec);
    case 'qty_x_size_sqin': return qtySizeSqinQuote(section, spec);
    case 'gang_sheet_flat': return gangFlatQuote(section, spec);
    case 'gang_qty_x_size': return gangQtySizeQuote(section, spec);
    default:
      if (section.priceGrids) return screenPrintQuote(section, spec); // Heritage
      if (section._needsFullGrid) return { error: 'grid-pending', warnings: ['This price grid is still being finalized.'] };
      return null;
  }
}

// Which catalog section a UI method label maps to, so the picker can find the
// right price book. Mirrors the section keys the catalogs use.
export const METHOD_SECTION = {
  'Screen Print': 'screenPrinting',
  'Digital Squeegee': 'digitalSqueegee',
  DTG: 'dtg',
  DTF: 'dtf',
  Embroidery: 'embroidery',
};

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-AREA (every method, not just screen)
//
// A real job often prints in more than one place — front + back, a left chest +
// a sleeve. Screen Print always summed its `locations[]` INSIDE the engine; the
// other methods each priced exactly ONE print, so the Quoter could only add a
// second area for screen (the "can't add another DTG print area" complaint).
//
// priceAreas() lifts that summing into ONE place for EVERY method: it prices
// each area on its own clean priceMethod() primitive, then SUMS the per-unit
// print + one-time setup (and screens) — exactly how a shop bills a two-location
// job. For Screen Print this is numerically identical to the old single-call
// path, because each location is independent (per-location run charge + $20/color
// floor + underbase, screens summed, setup = screens × perScreen). So multi-area
// generalizes to DTG / DTF / embroidery / squeegee WITHOUT touching the tested
// engine.
//
// Each area carries only the field(s) its method needs:
//   Screen Print → { label, colors }        (garment shade is shared, per design)
//   DTG          → { label, size }           (shade shared)
//   DTF (A+)     → { label, sqin, placement } (a real square-inch area + flat/non-flat)
//   DTF (sized)  → { label, size }           (Contract-DTG discrete size bands)
//   Embroidery   → { label, stitches }
//   Digital Squeegee → { label }             (full-color, qty only — a 2nd area = a 2nd print)
//
// Returns { printPerUnit, setup, screens, tier, tiers[], warnings[], notes[] },
// or { error, warnings } when an area is out of the guide / not filled in yet,
// or null when the section can't price the job at all.
export function priceAreas(section, method, { areas = [], shade = 'light' } = {}, qty) {
  if (!section) return null;
  const list = Array.isArray(areas) && areas.length ? areas : [{}];
  const specForArea = (a) => {
    if (method === 'Screen Print') {
      const colors = num(a.colors);
      return { qty, shade, locations: colors > 0 ? [{ label: a.label, colors }] : [] };
    }
    if (method === 'DTG') return { qty, size: a.size, shade };
    if (method === 'DTF') {
      if (section.model === 'qty_x_size_sqin') return { qty, sqin: num(a.sqin), placement: a.placement || 'flat' };
      const hasSizes = ((section.sizes || section.sizeBands || []).length) > 0;
      return hasSizes ? { qty, size: a.size } : { qty, sheets: 1 };
    }
    if (method === 'Embroidery') return { qty, stitches: num(a.stitches) };
    return { qty }; // Digital Squeegee — full-color, one price by quantity
  };

  let printPerUnit = 0;
  let setup = 0;
  let screens = 0;
  let priced = 0;
  const warnings = [];
  const notes = [];
  const tiers = [];
  for (const a of list) {
    const r = priceMethod(section, specForArea(a));
    if (r == null) continue;                 // an empty / unfilled area (e.g. 0 colors) — skip it
    if (r.error) return { error: r.error, warnings: r.warnings || [] };
    printPerUnit += num(r.printPerUnit);
    setup += num(r.setup);
    screens += num(r.screens);
    priced += 1;
    (r.warnings || []).forEach((w) => warnings.push(w));
    (r.notes || []).forEach((n) => { if (!notes.includes(n)) notes.push(n); });
    if (r.tier) tiers.push(r.tier);
  }
  if (!priced) return null;                  // nothing filled in yet
  return {
    printPerUnit: +printPerUnit.toFixed(2),
    setup: +setup.toFixed(2),
    screens,
    tier: tiers[0] || null,
    tiers,
    warnings,
    notes,
  };
}

// Compose the human print-details label across every area, e.g.
// "3c front + 1c back · dark garment" (screen — mirrors specDetails),
// "DTG front 12x16 + left-chest 4x4", "Embroidery front 8000 st". The dark-garment
// suffix only applies to the shade-priced methods (screen, DTG).
export function composeAreaDetails(method, { shade = 'light', areas = [] } = {}) {
  const label = (a) => String(a.label || 'front').trim();
  const parts = (areas || []).map((a) => {
    if (method === 'Screen Print') {
      const c = Math.round(num(a.colors));
      return c > 0 ? `${c}c ${label(a)}` : '';
    }
    if (method === 'Embroidery') {
      const st = Math.round(num(a.stitches));
      return st > 0 ? `${label(a)} ${st} st` : label(a);
    }
    if (num(a.sqin) > 0) return `${label(a)} ${Math.round(num(a.sqin))} sq in${a.placement === 'nonflat' ? ' non-flat' : ''}`;
    if (a.size) return `${label(a)} ${a.size}`;
    return label(a);
  }).filter(Boolean);
  const dark = shade === 'dark' && (method === 'Screen Print' || method === 'DTG');
  const head = method === 'Screen Print' ? '' : `${method} `;
  const body = (head + parts.join(' + ')).trim();
  return dark ? `${body} · dark garment` : body;
}
