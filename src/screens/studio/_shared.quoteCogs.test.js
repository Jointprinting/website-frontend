// src/screens/studio/_shared.quoteCogs.test.js
//
// Pins quoteCogs() — the order's estimated COGS derived from the QUOTER's cost
// side (blank + print + setup/ship for the client-selected lines), with NO
// markup. The whole point: COGS must come from the quote's cost, never from the
// confirmation (which carries the marked-up client price). These mirror the
// backend models/Order.js computeQuoteTotals().cogs cases so the drawer, the
// stored Order.cogs scalar, and Finances can never disagree. Run: CI=true npm test

import { quoteCogs } from './_shared';

const line = (o = {}) => ({
  qty: 10, blankCost: 3, printCost: 2, setupCost: 0, shippingCost: 0,
  markup: 1.4, unitPrice: 20, accepted: true, group: '', ...o,
});

describe('quoteCogs', () => {
  test('no lines / not an array → 0', () => {
    expect(quoteCogs(null)).toBe(0);
    expect(quoteCogs([])).toBe(0);
    expect(quoteCogs(undefined)).toBe(0);
  });

  test('nothing accepted (pre-pick) → 0, same gate as the backend', () => {
    expect(quoteCogs([line({ accepted: false })])).toBe(0);
  });

  test('uses cost (blank + print), NEVER the marked-up unitPrice', () => {
    // qty 10 × (3 + 2) = 50. unitPrice 20 (with markup) must be ignored.
    expect(quoteCogs([line()])).toBe(50);
  });

  test('per-line setup + shipping are added on top of unit cost', () => {
    // 10 × (3 + 2) + 25 setup + 15 ship = 90.
    expect(quoteCogs([line({ setupCost: 25, shippingCost: 15 })])).toBe(90);
  });

  test('accepted picks + ungrouped standalone lines count; a declined group does not', () => {
    const lines = [
      line({ group: 'shirts', accepted: true }),   // 50
      line({ group: 'shirts', accepted: false }),  // declined alt in a decided group → excluded
      line({ group: '', accepted: false }),        // ungrouped standalone → always included → 50
    ];
    expect(quoteCogs(lines)).toBe(100);
  });

  test('legacy order-level setup/ship applies ONLY when no line carries its own', () => {
    // Base cost 50 (10 × (3 + 2)). No per-line extras → add order-level (40 + 10) = 100.
    expect(quoteCogs([line({ setupCost: 0, shippingCost: 0 })], 40, 10)).toBe(100);
    // A line DOES carry its own → order-level legacy is ignored (no double-count) = 55.
    expect(quoteCogs([line({ setupCost: 5, shippingCost: 0 })], 40, 10)).toBe(55);
  });

  test('coerces string numbers and snaps to cents', () => {
    const l = line({ qty: '3', blankCost: '1.111', printCost: '0', setupCost: '0', shippingCost: '0' });
    // 3 × 1.111 = 3.333 → rounds to 3.33
    expect(quoteCogs([l])).toBe(3.33);
  });
});
