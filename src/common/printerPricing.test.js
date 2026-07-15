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
