// src/screens/studio/_quotePricing.test.js
//
// Pins the ONE lock-aware repricer the quoter's three margin controls share.
// Before this existed the math was written out three times and only ONE of them
// honoured priceLocked, so the design-level strip and the per-row chips could
// overwrite a catalog price that the per-cell strip refused to touch.
// Run: CI=true npm test

import { priceAtMargin, isPriceLocked, repriceToMargin } from './_quotePricing';

// A 100-unit line costing $7.75/u all-in: blank 3.20 + print 3.15 + (80+60)/100.
const line = (o = {}) => ({
  qty: 100, blankCost: 3.20, printCost: 3.15, setupCost: 80, shippingCost: 60, ...o,
});

describe('priceAtMargin', () => {
  test('is MARGIN, not markup — 40% means 40% of the price is profit', () => {
    // 7.75 / (1 - 0.40) = 12.9166…  A +40% MARKUP would be 10.85, a 28.6% margin.
    expect(priceAtMargin(7.75, 40)).toBeCloseTo(12.9167, 3);
    expect(7.75 * 1.4).toBeCloseTo(10.85, 2);
  });

  test('0% margin prices at cost', () => {
    expect(priceAtMargin(7.75, 0)).toBeCloseTo(7.75, 6);
  });

  test('100%+ is unreachable and returns 0 rather than dividing by zero', () => {
    expect(priceAtMargin(7.75, 100)).toBe(0);
    expect(priceAtMargin(7.75, 120)).toBe(0);
  });
});

describe('isPriceLocked', () => {
  test('only a truthy priceLocked counts; missing/undefined lines are unlocked', () => {
    expect(isPriceLocked(line({ priceLocked: true }))).toBe(true);
    expect(isPriceLocked(line())).toBe(false);
    expect(isPriceLocked(undefined)).toBe(false);
    expect(isPriceLocked(null)).toBe(false);
  });
});

describe('repriceToMargin', () => {
  test('prices an unlocked line to the true margin and keeps markup in step', () => {
    const patch = repriceToMargin(line(), 40);
    expect(patch.unitPrice).toBe(12.92);
    // markup must track the committed price — the backend falls back to it when
    // unitPrice is cleared (new run-size column, duplicated colour).
    expect(patch.markup).toBeCloseTo(12.92 / 7.75, 3);
    expect(patch.noMarkup).toBe(false);
    // Round-trip: the committed price really does yield the asked-for margin.
    expect((1 - 7.75 / patch.unitPrice) * 100).toBeCloseTo(40, 1);
  });

  test('a LOCKED line returns an empty patch — the catalog price survives', () => {
    // This is the regression: applyTier and applyRowTier had no lock check at
    // all, so the design strip and the row chips overwrote catalog prices.
    expect(repriceToMargin(line({ priceLocked: true, unitPrice: 4.32 }), 40)).toEqual({});
    expect(repriceToMargin(line({ priceLocked: true, unitPrice: 4.32 }), 5)).toEqual({});
  });

  test('an empty patch is safe to spread over a line — nothing changes', () => {
    const l = line({ priceLocked: true, unitPrice: 4.32, markup: 1, noMarkup: true });
    expect({ ...l, ...repriceToMargin(l, 70) }).toEqual(l);
  });

  test('a zero-cost line cannot produce a NaN markup', () => {
    const patch = repriceToMargin({ qty: 10, blankCost: 0, printCost: 0 }, 40);
    expect(patch.unitPrice).toBe(0);
    expect(patch.markup).toBe(1);
  });
});
