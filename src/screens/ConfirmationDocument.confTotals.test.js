// src/screens/ConfirmationDocument.confTotals.test.js
//
// Pins the CLIENT-FACING confirmation grand total (computeConfTotals — what the
// approval page and the printed document show) AND proves it agrees with the
// Studio's confRevenue for the same confirmation. Both now call the ONE shared
// confLocationTax (common/confTax.js), so this is the regression guard that the
// two can never drift again — the exact failure behind PR #432, where the client
// document taxed NJ-exempt apparel because only the Studio copy had the guard.
//
// Run via: CI=true npm test

import { computeConfTotals } from './ConfirmationDocument';
import { confRevenue } from './studio/_shared';

// A mixed NJ order: exempt apparel (clothing) + a taxable promo item, both fully
// allocated to the one taxed ship-to.
const mixedNjConf = () => ({
  shipTos: [{ key: 'nj', label: 'Newark', taxRate: 6.625 }],
  items: [
    { taxExempt: true, sizes: [{ label: 'M', qty: 100, unitPrice: 10 }], allocations: [{ key: 'nj', qty: 100 }] }, // $1000 apparel — exempt
    { sizes: [{ label: 'OS', qty: 50, unitPrice: 4 }], allocations: [{ key: 'nj', qty: 50 }] },                    // $200 promo  — taxable
  ],
  customLines: [],
});

describe('computeConfTotals (client-facing) vs confRevenue (studio)', () => {
  test('mixed NJ order: only the promo is taxed, and the client total == the studio total', () => {
    const conf = mixedNjConf();
    const totals = computeConfTotals(conf);
    // items = 1000 + 200 = 1200; tax base = promo only (apparel exempt) = 200;
    // tax = 200 × 6.625% = 13.25; grand total = 1213.25.
    expect(totals.itemsSubtotal).toBe(1200);
    expect(totals.locationTax.total).toBe(13.25);
    expect(totals.grandTotal).toBe(1213.25);
    // The whole point: the client document and the Studio agree to the cent.
    expect(totals.grandTotal).toBe(confRevenue(conf));
  });

  test('all-exempt apparel order → zero tax on both surfaces', () => {
    const conf = mixedNjConf();
    conf.items[1].taxExempt = true;                 // make the promo exempt too
    const totals = computeConfTotals(conf);
    expect(totals.locationTax.total).toBe(0);
    expect(totals.grandTotal).toBe(1200);
    expect(totals.grandTotal).toBe(confRevenue(conf));
  });

  test('no taxed ship-to → tax inactive, totals identical to a plain order', () => {
    const conf = mixedNjConf();
    conf.shipTos = [{ key: 'nj', label: 'Newark', taxRate: 0 }];
    const totals = computeConfTotals(conf);
    expect(totals.locationTax.active).toBe(false);
    expect(totals.grandTotal).toBe(1200);
    expect(totals.grandTotal).toBe(confRevenue(conf));
  });

  test('a percent add-on line applies on both surfaces before tax stays consistent', () => {
    const conf = mixedNjConf();
    conf.customLines = [{ label: 'Rush', isPercent: true, amount: 10 }];   // +10% on merchandise subtotal
    const totals = computeConfTotals(conf);
    // 1200 + 10% = 1320 running, then + promo tax 13.25 = 1333.25.
    expect(totals.grandTotal).toBe(1333.25);
    expect(totals.grandTotal).toBe(confRevenue(conf));
  });
});
