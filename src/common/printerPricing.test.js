// Heritage screen-print pricing engine — values read straight off the 2025
// catalog grids (verified twice against the PDF).
import { screenPrintQuote, specDetails } from './printerPricing';

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
