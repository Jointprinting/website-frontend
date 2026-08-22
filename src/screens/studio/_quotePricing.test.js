// src/screens/studio/_quotePricing.test.js
//
// Pins the ONE lock-aware repricer the quoter's three margin controls share.
// Before this existed the math was written out three times and only ONE of them
// honoured priceLocked, so the design-level strip and the per-row chips could
// overwrite a catalog price that the per-cell strip refused to touch.
// Run: CI=true npm test

import { priceAtMargin, isPriceLocked, repriceToMargin, patchTypedPrice, effectiveMarginPct } from './_quotePricing';

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

// ── Hand-typed prices ────────────────────────────────────────────────────────
//
// The bug these pin cost money on every quote where a price was typed rather
// than chosen from a chip, which is most of the interesting ones.
describe('patchTypedPrice', () => {
  // $10.00 all-in cost: blank 6 + print 4, no setup/freight to amortize.
  const line = () => ({ qty: 100, blankCost: 6, printCost: 4, setupCost: 0, shippingCost: 0 });

  test('THE BUG: typing a price now moves markup with it', () => {
    // Type $18.00 on a $10.00 cost — a 44.4% margin, a 1.8 markup.
    const patch = patchTypedPrice(line(), '18.00');
    expect(patch.unitPrice).toBe('18.00');
    expect(patch.markup).toBeCloseTo(1.8, 4);
    expect(patch.noMarkup).toBe(false);
  });

  test('...so a new column no longer silently reprices at 28.6%', () => {
    // A new run-size column clears unitPrice and falls back to `markup`.
    // Before: markup was still the 1.4 default → $14.00, a 28.6% margin, with
    // nothing on screen to show the new cell was cheaper than the one beside it.
    const l = { ...line(), ...patchTypedPrice(line(), '18.00') };
    const fallbackPrice = 10 * l.markup;
    expect(fallbackPrice).toBeCloseTo(18, 2);
    expect(fallbackPrice).not.toBeCloseTo(14, 1);
  });

  test('a catalog price is left alone — its margin is the vendor\'s', () => {
    const locked = { ...line(), priceLocked: true };
    expect(patchTypedPrice(locked, '18.00')).toEqual({ unitPrice: '18.00' });
  });

  test('a half-typed or cleared value writes the raw value and nothing else', () => {
    // Mid-keystroke states must not compute a markup off a garbage price.
    expect(patchTypedPrice(line(), '')).toEqual({ unitPrice: '' });
    expect(patchTypedPrice(line(), '.')).toEqual({ unitPrice: '.' });
    expect(patchTypedPrice(line(), '0')).toEqual({ unitPrice: '0' });
  });

  test('no cost yet means no markup to derive', () => {
    const patch = patchTypedPrice({ qty: 100 }, '18.00');
    expect(patch.markup).toBe(1);
  });
});

describe('effectiveMarginPct', () => {
  test('reads the committed price when there is one', () => {
    expect(effectiveMarginPct({ qty: 100, blankCost: 6, printCost: 4, unitPrice: 18 }))
      .toBeCloseTo(44.44, 1);
  });

  test('falls back to markup only for a line never priced', () => {
    expect(effectiveMarginPct({ qty: 100, blankCost: 6, printCost: 4, markup: 1.4 }))
      .toBeCloseTo(28.57, 1);
  });

  test('no cost, no margin', () => {
    expect(effectiveMarginPct({ qty: 100, unitPrice: 18 })).toBeNull();
  });
});
