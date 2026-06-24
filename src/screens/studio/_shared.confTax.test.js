// src/screens/studio/_shared.confTax.test.js
//
// Pins the confirmation money math in _shared.js — specifically the
// multi-ship-to per-location sales tax (confLocationTax) and its effect on
// confRevenue. These MUST stay mirrored with the backend models/Order.js
// computeLocationTax / computeConfirmationTotals. Run via:  CI=true npm test
//
// The single most important assertion here is that a single-location (or
// untaxed) confirmation produces exactly the same revenue as before this pass.

import { confRevenue, confLocationTax, STATE_TAX_RATES, isTaxCustomLine, roundCents } from './_shared';

const item = (qty, unitPrice, allocations) => ({
  sizes: [{ label: 'OS', qty, unitPrice }],
  ...(allocations ? { allocations } : {}),
});
const round = (n) => Math.round(n * 100) / 100;

describe('confLocationTax', () => {
  test('inactive with no shipTos', () => {
    const conf = { items: [item(100, 10)], customLines: [] };
    expect(confLocationTax(conf)).toEqual({ active: false, total: 0, lines: [] });
  });

  test('inactive when every shipTo rate is 0', () => {
    const conf = {
      items: [item(100, 10, [{ key: 'a', qty: 100 }])],
      shipTos: [{ key: 'a', label: 'HQ', state: 'NJ', taxRate: 0 }],
    };
    expect(confLocationTax(conf).active).toBe(false);
  });

  test('single taxed location: allocated merchandise × rate', () => {
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 100 }])],
      shipTos: [{ key: 'nj', label: 'Newark', taxRate: 6.625 }],
    };
    const tax = confLocationTax(conf);
    expect(tax.active).toBe(true);
    expect(round(tax.total)).toBe(66.25);
    expect(tax.lines[0].label).toMatch(/Newark tax - 6\.625%/);
  });

  test('proportional allocation by unit share across two locations', () => {
    // 100 @ $10 = 1000. 70 NJ (6.625%) -> 700 -> 46.375 -> rounds to 46.38;
    // 30 NY (8%) -> 300 -> 24. Total = 46.38 + 24 = 70.38 (cent-rounded, H4).
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 70 }, { key: 'ny', qty: 30 }])],
      shipTos: [
        { key: 'nj', label: 'NJ', taxRate: 6.625 },
        { key: 'ny', label: 'NY', taxRate: 8 },
      ],
    };
    const tax = confLocationTax(conf);
    const byKey = Object.fromEntries(tax.lines.map(l => [l.label.split(' ')[0], l]));
    expect(byKey.NJ.value).toBe(46.38);
    expect(byKey.NY.value).toBe(24);
    expect(tax.total).toBe(70.38);
  });

  test('only allocated units are taxed', () => {
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 40 }])],
      shipTos: [{ key: 'nj', label: 'NJ', taxRate: 6.625 }],
    };
    expect(round(confLocationTax(conf).total)).toBe(26.5); // 400 × 6.625%
  });

  test('over-allocation is clamped (taxed base ≤ item revenue) — H5', () => {
    // 100 @ $10 = 1000, but 140 "allocated" to NJ. Base clamps to 1000, not 1400.
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 140 }])],
      shipTos: [{ key: 'nj', label: 'NJ', taxRate: 6.625 }],
    };
    expect(round(confLocationTax(conf).total)).toBe(66.25); // 1000 × 6.625%
  });
});

describe('confRevenue with location tax', () => {
  test('single-location / no shipTos is UNCHANGED (items + customLines only)', () => {
    const conf = {
      items: [item(100, 10), item(50, 20)],            // 2000
      customLines: [{ label: 'NJ sales tax', amount: 6.625, isPercent: true }],
    };
    expect(confRevenue(conf)).toBe(2132.5);            // 2000 × 1.06625
  });

  test('multi-location: revenue = items + customLines + per-location tax', () => {
    // Items 2000; CC fee 2.99% -> 2059.80; tax on merchandise: 60% NJ + 40% NY.
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 60 }, { key: 'ny', qty: 40 }]),
              item(50, 20, [{ key: 'nj', qty: 30 }, { key: 'ny', qty: 20 }])],
      customLines: [{ label: 'Credit card fee', amount: 2.99, isPercent: true }],
      shipTos: [
        { key: 'nj', label: 'NJ', taxRate: 6.625 },     // 1200 × 6.625% = 79.50
        { key: 'ny', label: 'NY', taxRate: 8 },          //  800 × 8%     = 64.00
      ],
    };
    expect(confRevenue(conf)).toBe(2203.3);              // 2059.80 + 143.50
  });

  test('double-tax guard (C3): per-location tax drops a legacy tax customLine', () => {
    // Both a legacy "NJ sales tax" line AND a taxed shipTo — taxed exactly once.
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 100 }])],
      customLines: [{ label: 'NJ sales tax', amount: 6.625, isPercent: true }],
      shipTos: [{ key: 'nj', label: 'NJ', taxRate: 6.625 }],
    };
    expect(confRevenue(conf)).toBe(1066.25);            // not ~1132.50 (double-taxed)
  });

  test('per-location tax keeps NON-tax customLines (CC fee still applies)', () => {
    const conf = {
      items: [item(100, 10, [{ key: 'nj', qty: 100 }])],
      customLines: [{ label: 'Credit card fee', amount: 2.99, isPercent: true }],
      shipTos: [{ key: 'nj', label: 'NJ', taxRate: 6.625 }],
    };
    expect(confRevenue(conf)).toBe(1096.15);            // 1029.90 + 66.25
  });

  test('no per-location tax: a legacy tax customLine STILL applies', () => {
    const conf = {
      items: [item(100, 10, [{ key: 'a', qty: 100 }])],
      customLines: [{ label: 'NJ sales tax', amount: 6.625, isPercent: true }],
      shipTos: [{ key: 'a', label: 'HQ', taxRate: 0 }],
    };
    expect(confRevenue(conf)).toBe(1066.25);
  });
});

describe('isTaxCustomLine', () => {
  test('flag wins, else label /tax/i', () => {
    expect(isTaxCustomLine({ label: 'NJ sales tax' })).toBe(true);
    expect(isTaxCustomLine({ label: 'Sales Tax' })).toBe(true);
    expect(isTaxCustomLine({ label: 'Credit card fee' })).toBe(false);
    expect(isTaxCustomLine({ label: 'State', isTax: true })).toBe(true);
    expect(isTaxCustomLine(null)).toBe(false);
  });
});

test('roundCents snaps half-up to cents (no sub-cent drift)', () => {
  expect(roundCents(46.375)).toBe(46.38);
  expect(roundCents(2132.5000000001)).toBe(2132.5);
  expect(roundCents(0.30000000000000004)).toBe(0.3);
});

test('STATE_TAX_RATES matches the backend territory map', () => {
  expect(STATE_TAX_RATES).toEqual({ NJ: 6.625, NY: 8, CT: 6.35, MA: 6.25, VT: 6, PA: 6 });
});
