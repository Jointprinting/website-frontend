// src/screens/studio/_confSeed.test.js
//
// Pins how setup + shipping are amortized when a quote line seeds confirmation
// items — including the COLOUR SPLIT case, where one run becomes several items.
// Run: CI=true npm test

import { splitRunQty, seedUnitCost } from './_confSeed';

// What backend models/Order.js computeConfirmationCogs does with the seeded
// items: sum(itemTotalQty x unitCost).
const confCogs = (rows) =>
  Math.round(rows.reduce((sum, r) => sum + r.qty * r.unitCost, 0) * 100) / 100;

// The run behind every case below: 300 pieces, blank $4, print $2,
// $120 setup + $90 shipping. True COGS = 300 x 6 + 210 = $2,010.
const RUN = { qty: 300, blankCost: 4, printCost: 2, setupCost: 120, shippingCost: 90 };

describe('splitRunQty', () => {
  test('sums the colours the client actually ordered', () => {
    expect(splitRunQty([{ qty: 150 }, { qty: 150 }])).toBe(300);
  });
  test('drops zero and negative colours, matching the builder filter', () => {
    expect(splitRunQty([{ qty: 150 }, { qty: 0 }, { qty: -20 }, { qty: 150 }])).toBe(300);
  });
  test('empty / missing split → 0 so the caller falls back to the line qty', () => {
    expect(splitRunQty([])).toBe(0);
    expect(splitRunQty(undefined)).toBe(0);
    expect(splitRunQty(null)).toBe(0);
  });
});

describe('seedUnitCost', () => {
  test('no split: setup+ship spread over the line qty, as always', () => {
    // 4 + 2 + 210/300
    expect(seedUnitCost(RUN)).toBeCloseTo(6.7, 6);
  });

  test('a 2-colour split spreads over the RUN, so COGS stays $2,010', () => {
    const run = splitRunQty([{ qty: 150 }, { qty: 150 }]);
    const unit = seedUnitCost({ ...RUN, qty: 150 }, run);
    // 4 + 2 + 210/300 = 6.70. Spreading over the 150-piece slice gave 7.40.
    expect(unit).toBeCloseTo(6.7, 6);
    expect(confCogs([{ qty: 150, unitCost: unit }, { qty: 150, unitCost: unit }])).toBe(2010);
  });

  test('the old per-slice behaviour is what overstated COGS — pin the delta', () => {
    const perSlice = seedUnitCost({ ...RUN, qty: 150 });          // no run passed = the bug
    expect(perSlice).toBeCloseTo(7.4, 6);
    // Two colours each carrying the full $210: $2,220 vs the true $2,010.
    expect(confCogs([{ qty: 150, unitCost: perSlice }, { qty: 150, unitCost: perSlice }])).toBe(2220);
  });

  test('a 3-colour split does not triple-count setup+ship', () => {
    const run = splitRunQty([{ qty: 100 }, { qty: 100 }, { qty: 100 }]);
    const unit = seedUnitCost({ ...RUN, qty: 100 }, run);
    expect(confCogs([
      { qty: 100, unitCost: unit }, { qty: 100, unitCost: unit }, { qty: 100, unitCost: unit },
    ])).toBe(2010);
  });

  test('negative setup/shipping credits are clamped, matching lineCogsPerUnit', () => {
    expect(seedUnitCost({ qty: 100, blankCost: 5, printCost: 2, setupCost: -50, shippingCost: 0 }))
      .toBeCloseTo(7, 6);
  });

  test('a zero-qty line cannot divide by zero', () => {
    expect(seedUnitCost({ qty: 0, blankCost: 4, printCost: 2, setupCost: 120, shippingCost: 90 }))
      .toBeCloseTo(6, 6);
  });
});
