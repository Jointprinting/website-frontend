// Heritage screen-print pricing engine — values read straight off the 2025
// catalog grids (verified twice against the PDF).
import {
  screenPrintQuote, specDetails, rankPrintersForSpec, PICK_TIER,
} from './printerPricing';

const SP = {
  screenFees: { perScreen: 20 },
  minimums: { perPrintPerColor: 20 },
  priceGrids: {
    colorCountColumns: ['1', '2', '3', '4-5', '6-8', '9-12'],
    darkInkOnLightGarments: { rows: [
      { quantityDozens: 1, pieces: 12, prices: { 1: 2.95, 2: 3.75, 3: 3.9, '4-5': 7.1, '6-8': 9.1, '9-12': null } },
      { quantityDozens: 6, pieces: 72, prices: { 1: 1.3, 2: 1.7, 3: 1.85, '4-5': 2.85, '6-8': 4.3, '9-12': 6.25 } },
      { quantityDozens: 12, pieces: 144, prices: { 1: 1.15, 2: 1.25, 3: 1.45, '4-5': 1.6, '6-8': 2.35, '9-12': 4.0 } },
    ] },
    lightInkOnDarkGarments: { rows: [
      { quantityDozens: 6, pieces: 72, prices: { 1: 1.55, 2: 2.0, 3: 2.3, '4-5': 3.3, '6-8': 5.05, '9-12': 7.0 } },
    ] },
  },
};

test('picks the dozens-floor tier: 100 pcs prices at the 6dz row', () => {
  const r = screenPrintQuote(SP, { qty: 100, shade: 'light', locations: [{ label: 'front', colors: 1 }] });
  expect(r.tier.dozens).toBe(6);
  expect(r.printPerUnit).toBe(1.3);
  expect(r.setup).toBe(20);           // 1 screen
});

test('multi-location sums per-piece prices and screens', () => {
  // 150 pcs → 12dz tier; 3c front (1.45) + 1c back (1.15) = 2.60/u; 4 screens
  const r = screenPrintQuote(SP, { qty: 150, shade: 'light', locations: [
    { label: 'front', colors: 3 }, { label: 'back', colors: 1 }] });
  expect(r.printPerUnit).toBe(2.6);
  expect(r.setup).toBe(80);
});

test('dark garments add the underbase color to column AND screens', () => {
  // 100 pcs dark, 2c front → effective 3 colors on the dark grid (2.30), 3 screens
  const r = screenPrintQuote(SP, { qty: 100, shade: 'dark', locations: [{ label: 'front', colors: 2 }] });
  expect(r.printPerUnit).toBe(2.3);
  expect(r.screens).toBe(3);
  expect(r.setup).toBe(60);
});

test('$20/color minimum floors a tiny run', () => {
  // 12 pcs, 1c: grid 2.95×12 = $35.40 > $20 floor → grid wins.
  // 12 pcs, 3c: 3.9×12 = 46.80 < 20×3 = 60 → floored to $5/u.
  const small = screenPrintQuote(SP, { qty: 12, shade: 'light', locations: [{ label: 'front', colors: 3 }] });
  expect(small.printPerUnit).toBe(5);
  expect(small.breakdown[0].floored).toBe(true);
});

test('N/A tier and >12 colors refuse with reasons instead of guessing', () => {
  const na = screenPrintQuote(SP, { qty: 12, shade: 'light', locations: [{ label: 'front', colors: 9 }] });
  expect(na.error).toBe('na-tier');
  const over = screenPrintQuote(SP, { qty: 100, shade: 'light', locations: [{ label: 'front', colors: 13 }] });
  expect(over.error).toBe('over-max-colors');
});

test('the string "6000+" top tier must NOT swallow small quantities (regression)', () => {
  // Real-catalog shape: the 500-dozen tier carries pieces as the STRING "6000+".
  // Before the fix, Number("6000+")→NaN→0 made every qty match this row, so every
  // Heritage quote snapped to the cheapest tier (then got floored by the $20/color
  // minimum) — under-pricing the job. Values are the real light-ink-on-dark grid.
  const SP2 = {
    screenFees: { perScreen: 20 }, minimums: { perPrintPerColor: 20 },
    priceGrids: { lightInkOnDarkGarments: { rows: [
      { quantityDozens: 4, pieces: 48, prices: { '4-5': 4.15 } },
      { quantityDozens: 6, pieces: 72, prices: { '4-5': 3.35 } },
      { quantityDozens: 200, pieces: 2400, prices: { '4-5': 1.0 } },
      { quantityDozens: '500+', pieces: '6000+', prices: { '4-5': 0.9 } },
    ] } },
  };
  // 50 pcs, dark, 4c (+1 underbase = 5 → '4-5'): the 4-dozen tier, $4.15/u — NOT
  // the 500+ tier's $2.00/u floor the bug produced.
  const a = screenPrintQuote(SP2, { qty: 50, shade: 'dark', locations: [{ label: 'front', colors: 4 }] });
  expect(a.tier.dozens).toBe(4);
  expect(a.printPerUnit).toBe(4.15);
  // 100 pcs → the 6-dozen tier, $3.35/u (was $1.00/u).
  const b = screenPrintQuote(SP2, { qty: 100, shade: 'dark', locations: [{ label: 'front', colors: 4 }] });
  expect(b.tier.dozens).toBe(6);
  expect(b.printPerUnit).toBe(3.35);
  // A genuine 6,000-piece run still lands on the 500+ tier.
  const big = screenPrintQuote(SP2, { qty: 6000, shade: 'dark', locations: [{ label: 'front', colors: 4 }] });
  expect(big.tier.dozens).toBe('500+');
  expect(big.printPerUnit).toBe(0.9);
});

test('specDetails composes the printDetails string', () => {
  expect(specDetails({ shade: 'dark', locations: [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }] }))
    .toBe('3c front + 1c back · dark garment');
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-method engine (Print Hybrid / A+ / Contract-DTG / Branded shapes).
import { priceMethod } from './printerPricing';

test('qty_x_colors, setup included (Print Hybrid screen): floor tier + summed locations, no setup', () => {
  const sp = { model: 'qty_x_colors', setup: 'included', darkAddsUnderbaseColor: true,
    colorColumns: ['1','2','3','4','5','6','7','8'],
    tiers: [{ minQty: 48, label: '48-72', prices: [4,4.5,5.1,5.7,7,7.8,12,16] },
            { minQty: 72, label: '72-144', prices: [2,2.25,2.55,2.85,3.5,3.9,6,8] }] };
  const r = priceMethod(sp, { qty: 100, shade: 'light', locations: [{ label: 'front', colors: 3 }] });
  expect(r.tier.label).toBe('72-144');   // 100 ≥ 72
  expect(r.printPerUnit).toBe(2.55);      // 3-color column
  expect(r.setup).toBe(0);
});

test('qty_x_colors dark garment adds an underbase color', () => {
  const sp = { model: 'qty_x_colors', setup: 'included', darkAddsUnderbaseColor: true,
    colorColumns: ['1','2','3','4','5','6','7','8'],
    tiers: [{ minQty: 72, label: '72-144', prices: [2,2.25,2.55,2.85,3.5,3.9,6,8] }] };
  const r = priceMethod(sp, { qty: 100, shade: 'dark', locations: [{ label: 'front', colors: 2 }] });
  expect(r.printPerUnit).toBe(2.55);      // 2c + underbase = 3c column
  expect(r.screens).toBe(3);
});

test('qty_x_colors with separate screen fees (Branded): setup sums the per-color ladder', () => {
  const sp = { model: 'qty_x_colors', setup: 'per_color', darkAddsUnderbaseColor: true,
    screenFees: { '1':25,'2':30,'3':35,'4':40,'5':45,'6':50,'7':55,'8':60 },
    colorColumns: ['1','2','3','4','5','6','7','8'],
    tiers: [{ minQty: 48, label: '48-71', prices: [1.9,2.55,3.15,3.75,4.35,5,5.65,6.2] }] };
  const r = priceMethod(sp, { qty: 50, shade: 'light', locations: [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }] });
  expect(r.printPerUnit).toBe(5.05);      // 3c $3.15 + 1c $1.90
  expect(r.setup).toBe(60);               // $35 (3c) + $25 (1c)
});

test('qty_only (Digital Squeegee): one price by quantity floor', () => {
  const sp = { model: 'qty_only', tiers: [{ minQty: 48, price: 8 }, { minQty: 72, price: 6 }, { minQty: 144, price: 4 }] };
  expect(priceMethod(sp, { qty: 200 }).printPerUnit).toBe(4);
  expect(priceMethod(sp, { qty: 60 }).printPerUnit).toBe(8);
});

test('qty_x_size_x_shade (Contract-DTG DTG): size + shade select the price', () => {
  const sp = { model: 'qty_x_size_x_shade', sizes: ['4x4','10x10'], includesGarment: false,
    tiers: [{ minQty: 4, label: '4-10', prices: { '4x4':[6.6,5.5], '10x10':[7.7,6.6] } },
            { minQty: 22, label: '22-36', prices: { '4x4':[5.25,4.4], '10x10':[6.9,5.8] } }] };
  expect(priceMethod(sp, { qty: 30, size: '10x10', shade: 'dark' }).printPerUnit).toBe(6.9);
  expect(priceMethod(sp, { qty: 5, size: '4x4', shade: 'light' }).printPerUnit).toBe(5.5); // white column
  expect(priceMethod(sp, { qty: 30, size: '' }).error).toBe('pick-size');
});

test('qty_x_size_x_shade white-ink-only lane (A+ DTG): the 3rd price index', () => {
  // Cells are [dark, light, whiteInkOnly] — real A+ up-to-24-sqin values.
  const sp = { model: 'qty_x_size_x_shade', sizes: ['up to 24 sqin'], shades: ['light', 'dark', 'whiteInkOnly'],
    tiers: [{ minQty: 1, label: '1', prices: { 'up to 24 sqin': [8.13, 6.5, 7.31] } },
            { minQty: 25, label: '25-36', prices: { 'up to 24 sqin': [4.88, 3.74, 4.39] } }] };
  expect(priceMethod(sp, { qty: 1, size: 'up to 24 sqin', shade: 'dark' }).printPerUnit).toBe(8.13);
  expect(priceMethod(sp, { qty: 1, size: 'up to 24 sqin', shade: 'light' }).printPerUnit).toBe(6.5);
  expect(priceMethod(sp, { qty: 1, size: 'up to 24 sqin', shade: 'whiteInkOnly' }).printPerUnit).toBe(7.31);
  expect(priceMethod(sp, { qty: 30, size: 'up to 24 sqin', shade: 'whiteInkOnly' }).printPerUnit).toBe(4.39); // 25-36 tier
  expect(priceMethod(sp, { qty: 1, size: 'up to 24 sqin', shade: 'whiteInkOnly' }).notes[0]).toMatch(/white-ink only/);
  // A 2-lane catalog (Contract-DTG) has NO white-ink lane → request a quote, not a wrong price.
  const two = { model: 'qty_x_size_x_shade', sizes: ['4x4'], shades: ['light', 'dark'],
    tiers: [{ minQty: 1, label: '1', prices: { '4x4': [6.6, 5.5] } }] };
  expect(priceMethod(two, { qty: 1, size: '4x4', shade: 'whiteInkOnly' }).error).toBe('na');
  expect(priceMethod(two, { qty: 1, size: '4x4', shade: 'dark' }).printPerUnit).toBe(6.6);
});

test('qty_x_stitches (embroidery): qty tier × stitch band + digitizing setup', () => {
  const sp = { model: 'qty_x_stitches',
    qtyTiers: [{ label: '1-5', minQty: 1 }, { label: '12-23', minQty: 12 }],
    stitchBands: ['4000','6000','8000'],
    grid: { '1-5':[9.9,13.2,13.2], '12-23':[5.15,5.9,7.4] },
    fees: { digitizingUpTo15k: 30, digitizingPer1kOver15k: 1 } };
  const r = priceMethod(sp, { qty: 15, stitches: 6000 });
  expect(r.printPerUnit).toBe(5.9);   // 12-23 tier, 6000 band
  expect(r.setup).toBe(30);           // digitizing ≤15k
});

test('gang_qty_x_size (Contract-DTG DTF): size row, qty column floor', () => {
  const sp = { model: 'gang_qty_x_size', sizes: ['4x4','15x20'],
    qtyCols: [{ minQty: 1, label: '1-10' }, { minQty: 11, label: '11-25' }],
    grid: { '4x4':[2.7,2], '15x20':[13.1,9.5] } };
  expect(priceMethod(sp, { qty: 20, size: '15x20' }).printPerUnit).toBe(9.5);
});

test('gang_sheet_flat (Print Hybrid DTF): flat per sheet', () => {
  const sp = { model: 'gang_sheet_flat', sheetSize: '22x12in', pricePerSheet: 6.5 };
  expect(priceMethod(sp, {}).printPerUnit).toBe(6.5);
});

test('qty_x_size (Garment Gear DTG/DTF): size column × qty tier, per piece', () => {
  const sp = { model: 'qty_x_size', label: 'DTG',
    sizes: ['up to 5x5', 'up to 10x10', 'up to 12x14'],
    qtyTiers: [{ minQty: 1, label: '1-8' }, { minQty: 24, label: '24-47' }, { minQty: 144, label: '144-287' }],
    grid: { 'up to 5x5': [6.55, 4.75, 3.35], 'up to 10x10': [8.55, 6.20, 4.35], 'up to 12x14': [10.25, 7.45, 5.25] } };
  expect(priceMethod(sp, { qty: 30, size: 'up to 10x10' }).printPerUnit).toBe(6.20); // 24-47 tier
  expect(priceMethod(sp, { qty: 5, size: 'up to 5x5' }).printPerUnit).toBe(6.55);    // 1-8 tier
  expect(priceMethod(sp, { qty: 500, size: 'up to 12x14' }).printPerUnit).toBe(5.25); // floors to top tier
  expect(priceMethod(sp, { qty: 30 }).error).toBe('pick-size');                       // no size
  expect(priceMethod(sp, { qty: 30, size: 'bogus' }).error).toBe('pick-size');
});

test('qty_x_colors underbaseFreeScreen: underbase prints but adds no screen fee', () => {
  const sp = { model: 'qty_x_colors', setup: 'per_color', darkAddsUnderbaseColor: true, underbaseFreeScreen: true,
    colorColumns: ['1', '2', '3', '4'],
    screenFees: { '1': 25, '2': 50, '3': 75, '4': 100 },
    tiers: [{ minQty: 24, label: '24-47', prices: [3.05, 3.65, 4.35, 5.0] }] };
  // dark 2-color front → effective 3 colors on the PRICE ($4.35) + 3 screens, but the
  // screen FEE is for the 2 real colors ($50), not 3 ($75) — underbase screen is free.
  const r = priceMethod(sp, { qty: 30, shade: 'dark', locations: [{ label: 'front', colors: 2 }] });
  expect(r.printPerUnit).toBe(4.35);
  expect(r.screens).toBe(3);
  expect(r.setup).toBe(50);
});

test('qty_x_size_sqin (A+ DTF): sqin band × qty tier + placement apply fee', () => {
  const sp = { model: 'qty_x_size_sqin',
    qtyTiers: ['1-11', '12-24', '250+'],
    sizeBandsSqin: [5, 10, 15, 20],
    grid: { '1-11': [0.50, 0.50, 0.75, 1.05], '12-24': [0.50, 0.50, 0.69, 0.96], '250+': [0.50, 0.50, 0.50, 0.53] },
    applyToFlat: 2.5, applyToNonFlat: 3.5, maxRecommendedSqin: 18 };
  // 12 pieces (tier 12-24), 13 sq in → band 15 = 0.69, + flat apply 2.5 = 3.19
  expect(priceMethod(sp, { qty: 12, sqin: 13 }).printPerUnit).toBe(3.19);
  // non-flat placement swaps the apply fee: 0.69 + 3.5 = 4.19
  expect(priceMethod(sp, { qty: 12, sqin: 13, placement: 'nonflat' }).printPerUnit).toBe(4.19);
  // exact band edge (sqin === upper bound) stays in that band: 5 sq in → band 5 = 0.50 + 2.5
  expect(priceMethod(sp, { qty: 1, sqin: 5 }).printPerUnit).toBe(3.0);
  // 250+ tier, biggest band; over the recommended max → warns but still prices
  const big = priceMethod(sp, { qty: 300, sqin: 20 });
  expect(big.printPerUnit).toBe(3.03);             // 0.53 + 2.5
  expect(big.warnings.some((w) => /max print size/.test(w))).toBe(true);
  // no size entered → prompt, not a crash
  expect(priceMethod(sp, { qty: 12 }).error).toBe('pick-size');
});

test('qty_x_colors warns when the qty is below the printer minimum (no silent under-min quote)', () => {
  const sp = { model: 'qty_x_colors', setup: 'included', label: 'Blue Moon',
    colorColumns: ['1','2','3','4'],
    tiers: [{ minQty: 12, label: '12-23', prices: [3.5, 4, 4.5, 5] },
            { minQty: 24, label: '24-47', prices: [2.5, 3, 3.5, 4] }] };
  const under = priceMethod(sp, { qty: 6, locations: [{ label: 'front', colors: 1 }] });
  expect(under.printPerUnit).toBe(3.5);            // still snaps to the smallest tier
  expect(under.warnings.some((w) => /below Blue Moon's minimum|Under 12 pieces/.test(w))).toBe(true);
  // At/above the minimum → no sub-min warning.
  const ok = priceMethod(sp, { qty: 20, locations: [{ label: 'front', colors: 1 }] });
  expect(ok.warnings.some((w) => /minimum/.test(w))).toBe(false);
});

test('qty_x_size honors a catalog order minimum ($30 floor lifts the per-piece)', () => {
  // Blue Moon DTG shape: flat per-location price, $30 non-program order minimum.
  const sp = { model: 'qty_x_size', label: 'DTG', minimum: 30,
    sizes: ['Left Chest', 'Full Front/Back'], qtyTiers: [{ minQty: 1, label: 'any qty' }],
    grid: { 'Left Chest': [6.0], 'Full Front/Back': [8.0] } };
  // 3 pieces × $6 = $18 < $30 → floored to $30/3 = $10/pc, with a warning + note.
  const small = priceMethod(sp, { qty: 3, size: 'Left Chest' });
  expect(small.printPerUnit).toBe(10);
  expect(small.warnings.some((w) => /order minimum/.test(w))).toBe(true);
  expect(small.notes.some((nn) => /\$30\.00 order minimum applied/.test(nn))).toBe(true);
  // 10 pieces × $6 = $60 > $30 → grid price stands, no floor.
  const big = priceMethod(sp, { qty: 10, size: 'Left Chest' });
  expect(big.printPerUnit).toBe(6);
  expect(big.warnings.length).toBe(0);
  // A catalog with NO minimum (Garment Gear) is unaffected.
  const gg = { model: 'qty_x_size', label: 'DTG', sizes: ['up to 5x5'],
    qtyTiers: [{ minQty: 1, label: '1-8' }], grid: { 'up to 5x5': [6.55] } };
  expect(priceMethod(gg, { qty: 2, size: 'up to 5x5' }).printPerUnit).toBe(6.55);
});

test('gang_sheet_flat surfaces heat-press-per-location and the order minimum', () => {
  // Blue Moon DTF: $10/sheet, $2.50/location heat press, $30 minimum.
  const sp = { model: 'gang_sheet_flat', sheetSize: '16x20in', pricePerSheet: 10, heatPressPerLocation: 2.5, minimum: 30 };
  const one = priceMethod(sp, { sheets: 1 });
  expect(one.printPerUnit).toBe(10);                                   // sheet price unchanged
  expect(one.notes.some((nn) => /Heat press \$2\.50 per location/.test(nn))).toBe(true);
  expect(one.warnings.some((w) => /order minimum/.test(w))).toBe(true); // 1 sheet ($10) < $30
  // 3 sheets ($30) clears the floor — no warning.
  const three = priceMethod(sp, { sheets: 3 });
  expect(three.warnings.length).toBe(0);
  // Print Hybrid DTF (no heat-press / minimum fields) still prices clean.
  const ph = priceMethod({ model: 'gang_sheet_flat', sheetSize: '22x12in', pricePerSheet: 6.5 }, {});
  expect(ph.printPerUnit).toBe(6.5);
  expect(ph.warnings.length).toBe(0);
});

test('dispatcher falls back to Heritage priceGrids, and flags a pending grid', () => {
  expect(priceMethod(SP, { qty: 100, shade: 'light', locations: [{ label: 'front', colors: 1 }] }).printPerUnit).toBe(1.3);
  expect(priceMethod({ _needsFullGrid: true }, {}).error).toBe('grid-pending');
  expect(priceMethod(null, {})).toBeNull();
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-area (priceAreas): print areas are first-class for EVERY method, not
// just screen. The Quoter prices each area and sums — this pins that wiring,
// which had no test before (the "can't add another DTG print area" fix).
import { priceAreas, composeAreaDetails } from './printerPricing';

const DTG = { model: 'qty_x_size_x_shade', sizes: ['4x4', '10x10', '12x16'],
  tiers: [{ minQty: 4, label: '4-10', prices: { '4x4': [6.6, 5.5], '10x10': [7.7, 6.6], '12x16': [13.2, 12.15] } },
          { minQty: 22, label: '22-36', prices: { '4x4': [5.25, 4.4], '10x10': [6.9, 5.8], '12x16': [9.9, 7.7] } }] };

test('priceAreas: DTG can price two print areas and sums the per-unit print', () => {
  // 30 pcs, dark: front 12x16 ($9.90) + left-chest 4x4 ($5.25) = $15.15/u.
  const r = priceAreas(DTG, 'DTG',
    { shade: 'dark', areas: [{ label: 'front', size: '12x16' }, { label: 'left-chest', size: '4x4' }] }, 30);
  expect(r.printPerUnit).toBe(15.15);
  expect(r.setup).toBe(0);
});

test('priceAreas: a Screen Print job priced one-area-at-a-time equals the single multi-location call', () => {
  // Same 150-pc job as the engine's multi-location test: 3c front + 1c back.
  const spec = { shade: 'light', areas: [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }] };
  const summed = priceAreas(SP, 'Screen Print', spec, 150);
  const single = screenPrintQuote(SP, { qty: 150, shade: 'light',
    locations: [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }] });
  expect(summed.printPerUnit).toBe(single.printPerUnit);   // 2.60/u
  expect(summed.setup).toBe(single.setup);                 // $80, 4 screens
  expect(summed.screens).toBe(single.screens);
});

test('priceAreas: embroidery sums per-area piece price AND the per-area digitizing setup', () => {
  const EMB = { model: 'qty_x_stitches',
    qtyTiers: [{ label: '12-23', minQty: 12 }],
    stitchBands: ['4000', '6000', '8000'],
    grid: { '12-23': [5.15, 5.9, 7.4] },
    fees: { digitizingUpTo15k: 30, digitizingPer1kOver15k: 1 } };
  const r = priceAreas(EMB, 'Embroidery',
    { areas: [{ label: 'front', stitches: 6000 }, { label: 'back', stitches: 8000 }] }, 15);
  expect(r.printPerUnit).toBe(13.3);   // 5.90 + 7.40
  expect(r.setup).toBe(60);            // $30 digitizing × 2 areas
});

test('priceAreas: an unfilled area surfaces its guide error (e.g. DTG with no size)', () => {
  const r = priceAreas(DTG, 'DTG', { areas: [{ label: 'front', size: '' }] }, 30);
  expect(r.error).toBe('pick-size');
});

test('priceAreas: a Screen Print area with 0 colors is skipped, not an error', () => {
  const r = priceAreas(SP, 'Screen Print',
    { shade: 'light', areas: [{ label: 'front', colors: 1 }, { label: 'back', colors: 0 }] }, 100);
  expect(r.printPerUnit).toBe(1.3);    // only the 1c front priced
  expect(r.screens).toBe(1);
});

test('composeAreaDetails: screen output still matches the specDetails format (regression)', () => {
  const areas = [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }];
  expect(composeAreaDetails('Screen Print', { shade: 'dark', areas }))
    .toBe(specDetails({ shade: 'dark', locations: areas }));
  expect(composeAreaDetails('Screen Print', { shade: 'dark', areas }))
    .toBe('3c front + 1c back · dark garment');
});

test('composeAreaDetails: multi-area DTG names every area', () => {
  expect(composeAreaDetails('DTG', { shade: 'dark',
    areas: [{ label: 'front', size: '12x16' }, { label: 'left-chest', size: '4x4' }] }))
    .toBe('DTG front 12x16 + left-chest 4x4 · dark garment');
});

// ── Mixed methods on one garment ─────────────────────────────────────────────
//
// The owner's ask, verbatim: "if a client wants screen print on front and dtg on
// back then I add the costs and input it for thr per unit cost". Until now
// priceAreas took ONE section and ONE method for every area, so that job could
// only be priced by running the tool twice and adding it up by hand — and "Fill
// costs" REPLACED rather than accumulated, so the second run erased the first.

describe('priceAreas — two methods on one garment', () => {
  const screen = {
    model: 'qty_x_colors', setup: 'included',
    colorColumns: ['1', '2', '3'],
    tiers: [{ minQty: 1, label: '1+', prices: [1.00, 1.50, 2.00] }],
  };
  const dtg = {
    model: 'qty_x_size', label: 'DTG',
    sizes: ['A4'],
    qtyTiers: [{ minQty: 1, label: '1+' }],
    grid: { A4: [3.40] },
  };
  const sectionFor = (m) => ({ 'Screen Print': screen, DTG: dtg }[m] || null);

  test('per-unit print is the SUM across methods', () => {
    const r = priceAreas(
      screen, 'Screen Print',
      { areas: [{ label: 'front', colors: 3 }, { label: 'back', method: 'DTG', size: 'A4' }], sectionFor },
      100,
    );
    expect(r.error).toBeUndefined();
    expect(r.printPerUnit).toBeCloseTo(2.00 + 3.40, 2);
  });

  test('it shows its working per method', () => {
    const r = priceAreas(
      screen, 'Screen Print',
      { areas: [{ label: 'front', colors: 3 }, { label: 'back', method: 'DTG', size: 'A4' }], sectionFor },
      100,
    );
    expect(r.methods.sort()).toEqual(['DTG', 'Screen Print']);
    expect(r.byMethod['Screen Print'].printPerUnit).toBeCloseTo(2.00, 2);
    expect(r.byMethod.DTG.printPerUnit).toBeCloseTo(3.40, 2);
  });

  test('a single-method design prices EXACTLY as before — no backfill needed', () => {
    // Every spec saved to date has one method for the whole design and no
    // per-area method. It must not move by a cent.
    const areas = [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }];
    const before = priceAreas(screen, 'Screen Print', { areas }, 100);
    const after  = priceAreas(screen, 'Screen Print', { areas, sectionFor }, 100);
    expect(after.printPerUnit).toBe(before.printPerUnit);
    expect(after.setup).toBe(before.setup);
    expect(after.screens).toBe(before.screens);
  });

  test('a method this printer cannot do is SAID, not silently dropped', () => {
    const r = priceAreas(
      screen, 'Screen Print',
      { areas: [{ label: 'front', colors: 3 }, { label: 'back', method: 'Embroidery', stitches: 8000 }], sectionFor },
      100,
    );
    expect(r.error).toBe('no-section');
    expect(r.warnings.join(' ')).toMatch(/Embroidery/);
  });
});

describe('priceMethod — a price book it cannot read', () => {
  test("THE BUG: an unreadable section is an error, not 'nothing here'", () => {
    // Heritage's DTG and embroidery blocks are legacy layouts predating the
    // `model` tag. priceMethod returned null, which priceAreas treats as "area
    // not filled in yet" and skips — so Heritage was offered in the DTG dropdown
    // (capabilities are derived from the catalog, and the section IS there) and
    // then returned nothing, forever, indistinguishable from an empty form.
    const r = priceMethod({ someOldShape: true }, { qty: 100 });
    expect(r).not.toBeNull();
    expect(r.error).toBe('unreadable-section');
  });

  test('no section at all is still null — that is a different thing', () => {
    expect(priceMethod(null, { qty: 100 })).toBeNull();
  });
});

describe('composeAreaDetails — mixed methods', () => {
  test('names the method per area so it cannot read as two screen locations', () => {
    const s = composeAreaDetails('Screen Print', {
      areas: [{ label: 'front', colors: 3 }, { label: 'back', method: 'DTG', size: 'A4' }],
    });
    expect(s).toMatch(/3c front \(screen\)/);
    expect(s).toMatch(/DTG back/);
  });

  test('a single-method design keeps its exact old label', () => {
    expect(composeAreaDetails('Screen Print', {
      areas: [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }],
    })).toBe('3c front + 1c back');
  });
});

// ── Ranking printers for a spec ──────────────────────────────────────────────
//
// "how i can use the quoter to pick the best printer". Nothing looped over
// printers before this: the dropdown sorted by nexus + haversine, which answers
// "who is nearest that I can legally use", not "who is cheapest all-in".

describe('rankPrintersForSpec', () => {
  const screenBook = (price) => ({
    model: 'qty_x_colors', setup: 'included',
    colorColumns: ['1', '2', '3'],
    tiers: [{ minQty: 1, label: '1+', prices: [price, price, price] }],
  });
  // Setup on a qty_x_colors book comes from screenFees keyed by colour count —
  // this shape bills $40 for a 1-colour job's screen.
  const withScreens = (price, fee) => ({
    model: 'qty_x_colors',
    screenFees: { 1: fee, 2: fee, 3: fee },
    colorColumns: ['1', '2', '3'],
    tiers: [{ minQty: 1, label: '1+', prices: [price, price, price] }],
  });

  const areas = [{ label: 'front', colors: 1 }];
  const sectionFor = (p, m) => (p.catalog || {})[{ 'Screen Print': 'screenPrinting', DTG: 'dtg' }[m]] || null;
  const nexusRank = (p) => p._miles ?? 0;

  test('cheapest ALL-IN wins, not cheapest print rate', () => {
    // This is the whole point. Cheap Print charges less per shirt and more in
    // setup; on a 50-piece run that makes it the expensive one, and the old
    // ordering could never see it.
    const cheapRate = { key: 'cheap', name: 'Cheap Print', state: 'PA', _miles: 10,
      catalog: { screenPrinting: withScreens(2.00, 40) } };       // 2.00 + 40/50 = 2.80
    const cheapAllIn = { key: 'flat', name: 'Flat Rate', state: 'NC', _miles: 400,
      catalog: { screenPrinting: screenBook(2.40) } };            // 2.40 + 0     = 2.40

    const out = rankPrintersForSpec({
      printers: [cheapRate, cheapAllIn], methods: ['Screen Print'],
      areas, qty: 50, shipToState: 'NJ', sectionFor, nexusRank,
    });
    expect(out[0].key).toBe('flat');
    expect(out[0].allInPerUnit).toBeCloseTo(2.40, 2);
    expect(out[1].allInPerUnit).toBeCloseTo(2.80, 2);
  });

  test('a same-state printer is BLOCKED with the reason, never hidden', () => {
    const local = { key: 'local', name: 'Local', state: 'NJ', _miles: 0,
      catalog: { screenPrinting: screenBook(1.00) } };
    const away = { key: 'away', name: 'Away', state: 'PA', _miles: 60,
      catalog: { screenPrinting: screenBook(9.00) } };

    const out = rankPrintersForSpec({
      printers: [local, away], methods: ['Screen Print'],
      areas, qty: 50, shipToState: 'NJ', sectionFor, nexusRank,
    });
    // Cheapest by a mile, and still last — nexus is a tax question, not a
    // preference. But it is present, with the reason.
    expect(out[0].key).toBe('away');
    expect(out[1].key).toBe('local');
    expect(out[1].tier).toBe(PICK_TIER.BLOCKED);
    expect(out[1].reason).toMatch(/nexus/i);
  });

  test('a printer with no price book is listed, labelled, and sorted by distance', () => {
    // Only 7 of ~16 counterparties have a price book. Hiding these would hide
    // most of the network.
    const priced = { key: 'priced', name: 'Priced', state: 'PA', _miles: 500,
      catalog: { screenPrinting: screenBook(3.00) } };
    const nearNoBook = { key: 'near', name: 'Near No Book', state: 'NY', _miles: 50, catalog: {} };
    const farNoBook  = { key: 'far',  name: 'Far No Book',  state: 'TX', _miles: 900, catalog: {} };

    const out = rankPrintersForSpec({
      printers: [farNoBook, nearNoBook, priced], methods: ['Screen Print'],
      areas, qty: 50, shipToState: 'NJ', sectionFor, nexusRank,
    });
    expect(out.map(r => r.key)).toEqual(['priced', 'near', 'far']);
    expect(out[1].tier).toBe(PICK_TIER.UNPRICED);
    expect(out[1].reason).toMatch(/No price book for Screen Print/);
  });

  test("'can't read the book' is a different answer from 'no book'", () => {
    // The Heritage legacy-section case. One is a bug to fix, the other a gap to
    // fill, and they should not read the same to the owner.
    const legacy = { key: 'legacy', name: 'Legacy', state: 'PA', _miles: 100,
      catalog: { screenPrinting: { someOldShape: true } } };
    const out = rankPrintersForSpec({
      printers: [legacy], methods: ['Screen Print'],
      areas, qty: 50, shipToState: 'NJ', sectionFor, nexusRank,
    });
    expect(out[0].tier).toBe(PICK_TIER.UNPRICED);
    expect(out[0].error).toBe('unreadable-section');
    expect(out[0].reason).toMatch(/older format/i);
  });

  test('a printer must cover EVERY method on a mixed design', () => {
    const screenOnly = { key: 'screen', name: 'Screen Only', state: 'PA', _miles: 100,
      catalog: { screenPrinting: screenBook(2.00) } };
    const out = rankPrintersForSpec({
      printers: [screenOnly], methods: ['Screen Print', 'DTG'],
      areas: [{ label: 'front', colors: 1 }, { label: 'back', method: 'DTG', size: 'A4' }],
      qty: 50, shipToState: 'NJ', sectionFor, nexusRank,
    });
    expect(out[0].tier).toBe(PICK_TIER.UNPRICED);
    expect(out[0].reason).toMatch(/No price book for DTG/);
  });

  test('unknown freight is reported as unknown, not as zero', () => {
    // "$X/u + freight TBD" is honest. A total that silently omits a leg is not.
    const p = { key: 'p', name: 'P', state: 'PA', _miles: 100,
      catalog: { screenPrinting: screenBook(2.00) } };
    const out = rankPrintersForSpec({
      printers: [p], methods: ['Screen Print'], areas, qty: 50,
      shipToState: 'NJ', sectionFor, nexusRank,
    });
    expect(out[0].freightKnown).toBe(false);
    expect(out[0].freight).toBeNull();

    const withFreight = rankPrintersForSpec({
      printers: [p], methods: ['Screen Print'], areas, qty: 50,
      shipToState: 'NJ', sectionFor, nexusRank, freightFor: () => 100,
    });
    expect(withFreight[0].freightKnown).toBe(true);
    expect(withFreight[0].allInPerUnit).toBeCloseTo(2.00 + 100 / 50, 2);
  });

  test('a stale price book is flagged without being demoted', () => {
    // pricingReviewDue is already computed on the model and had no reader.
    const p = { key: 'p', name: 'P', state: 'PA', _miles: 100, pricingReviewDue: true,
      catalog: { screenPrinting: screenBook(2.00) } };
    const out = rankPrintersForSpec({
      printers: [p], methods: ['Screen Print'], areas, qty: 50,
      shipToState: 'NJ', sectionFor, nexusRank,
    });
    expect(out[0].tier).toBe(PICK_TIER.PRICED);
    expect(out[0].stale).toBe(true);
  });

  test('no ship-to state yet blocks nobody', () => {
    const nj = { key: 'nj', name: 'NJ Shop', state: 'NJ', _miles: 0,
      catalog: { screenPrinting: screenBook(2.00) } };
    const out = rankPrintersForSpec({
      printers: [nj], methods: ['Screen Print'], areas, qty: 50,
      shipToState: '', sectionFor, nexusRank,
    });
    expect(out[0].tier).toBe(PICK_TIER.PRICED);
  });
});
