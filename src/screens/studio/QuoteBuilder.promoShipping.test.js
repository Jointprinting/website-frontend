// src/screens/studio/QuoteBuilder.promoShipping.test.js
//
// Pins the money invariant behind promo shipping pass-through.
//
// The vendor catalogs price the goods but NOT the freight, and a promo line's
// margin is the catalog's client-vs-net spread — not a markup. So when the
// estimator adds shipping it lands on BOTH sides of the line:
//   • shippingCost  -> lineCogsPerUnit sees the real cost
//   • unitPrice     -> catalogUnitPrice + shipping/qty, passed to the client
// Those two must cancel exactly, or the owner is quietly eating freight (or
// double-charging for it). That is what these tests hold still.
//
// Run: CI=true npm test

import { lineCogsPerUnit, lineEffectivePrice } from './_shared';

// A promo line as the picker builds it: catalog client price committed, vendor
// net cost in blankCost, no markup.
const promoLine = (o = {}) => ({
  qty: 1000,
  blankCost: 1.20,          // vendor net cost per unit
  printCost: 0,
  setupCost: 0,
  shippingCost: 0,
  markup: 1,
  noMarkup: true,
  unitPrice: 2.00,          // catalog client price
  catalogUnitPrice: 2.00,
  priceLocked: true,
  ...o,
});

// What the estimator does to a line: shipping onto the cost field, and the same
// shipping per unit on top of the PRISTINE catalog price.
const withShipping = (l, shipping) => ({
  ...l,
  shippingCost: shipping,
  unitPrice: +(l.catalogUnitPrice + shipping / l.qty).toFixed(2),
});

const profitPerUnit = (l) => lineEffectivePrice(l) - lineCogsPerUnit(l);

describe('promo shipping pass-through', () => {
  test('baseline: profit is the catalog spread, not a markup', () => {
    const l = promoLine();
    expect(lineCogsPerUnit(l)).toBeCloseTo(1.20, 4);
    expect(lineEffectivePrice(l)).toBeCloseTo(2.00, 4);
    expect(profitPerUnit(l)).toBeCloseTo(0.80, 4);
  });

  test('passing shipping through leaves the catalog margin intact', () => {
    const before = promoLine();
    const after = withShipping(before, 226.58);   // 1,000 grinders to PA
    // Revenue and COGS each rise by shipping/qty, so they cancel.
    expect(profitPerUnit(after)).toBeCloseTo(profitPerUnit(before), 2);
  });

  test('the client is charged the freight, and exactly once', () => {
    const l = withShipping(promoLine(), 226.58);
    const perUnitShip = 226.58 / 1000;
    expect(lineEffectivePrice(l)).toBeCloseTo(2.00 + perUnitShip, 2);
    expect(lineCogsPerUnit(l)).toBeCloseTo(1.20 + perUnitShip, 2);
  });

  test('absorbing it instead would cost the owner the whole freight bill', () => {
    // The rejected alternative: shippingCost set but the price left alone.
    const absorbed = { ...promoLine(), shippingCost: 226.58 };
    const lost = (profitPerUnit(promoLine()) - profitPerUnit(absorbed)) * absorbed.qty;
    expect(lost).toBeCloseTo(226.58, 2);
  });

  test('re-estimating never compounds, because it rebuilds from the catalog price', () => {
    const once = withShipping(promoLine(), 226.58);
    const twice = withShipping(once, 226.58);     // same input, recomputed from catalogUnitPrice
    expect(twice.unitPrice).toBeCloseTo(once.unitPrice, 4);
    expect(profitPerUnit(twice)).toBeCloseTo(profitPerUnit(once), 4);
  });

  test('clearing the estimate restores the catalog price exactly', () => {
    const l = withShipping(promoLine(), 226.58);
    const cleared = { ...l, shippingCost: 0, unitPrice: l.catalogUnitPrice };
    expect(cleared.unitPrice).toBe(2.00);
    expect(profitPerUnit(cleared)).toBeCloseTo(0.80, 4);
  });

  test('a zero-qty line cannot divide by zero', () => {
    const l = { ...promoLine(), qty: 0, shippingCost: 50 };
    expect(Number.isFinite(lineCogsPerUnit(l))).toBe(true);
    expect(Number.isFinite(lineEffectivePrice(l))).toBe(true);
  });

  test('an apparel line is untouched by any of this', () => {
    // No catalogUnitPrice: the ordinary markup lane still applies.
    const apparel = { qty: 100, blankCost: 3, printCost: 2, setupCost: 0, shippingCost: 0, markup: 1.4, unitPrice: 0 };
    expect(lineEffectivePrice(apparel)).toBeCloseTo(7.00, 4);   // (3+2) x 1.4
  });
});
