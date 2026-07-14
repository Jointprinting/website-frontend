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

test('specDetails composes the printDetails string', () => {
  expect(specDetails({ shade: 'dark', locations: [{ label: 'front', colors: 3 }, { label: 'back', colors: 1 }] }))
    .toBe('3c front + 1c back · dark garment');
});
