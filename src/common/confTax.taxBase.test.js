// src/common/confTax.taxBase.test.js
//
// Two ways a confirmation could get sales tax WRONG, both fixed here, both
// asserted against the exact figures the backend now produces for the same
// input (models/Order.js computeConfirmationTotals).
//
//   1. A shipTo with a rate but no allocations made per-location tax "active",
//      which SUPPRESSED the legacy "NJ tax" line while itself computing $0 —
//      so the tax silently vanished from the total.
//   2. A legacy percent tax line charged the whole running subtotal instead of
//      the taxable merchandise base, so it taxed NJ-exempt clothing.
//
// Run: CI=true npm test

import { confLocationTax, confTaxableSubtotal, supersedesTaxLine, customLineValue, roundCents, isTaxCustomLine } from './confTax';

// The same reduction the three total functions perform, so these tests exercise
// the shared helpers exactly as production does.
function grandTotal(conf) {
  const items = conf.items || [];
  const itemsSubtotal = items.reduce((s, it) =>
    s + (it.sizes || []).reduce((ss, sz) => ss + (Number(sz.qty) || 0) * (Number(sz.unitPrice) || 0), 0), 0);
  const locationTax = confLocationTax(conf);
  const taxable = confTaxableSubtotal(conf);
  let running = itemsSubtotal;
  (conf.customLines || []).forEach((l) => {
    if (supersedesTaxLine(locationTax, l)) return;
    running += customLineValue(l, running, taxable);
  });
  running += locationTax.total;
  return roundCents(running);
}

const NJ_TAX = { label: 'NJ sales tax', amount: 6.625, isPercent: true, isTax: true };

describe('a half-configured multi-ship order must not lose its tax', () => {
  const conf = {
    items: [{ sizes: [{ qty: 100, unitPrice: 20 }], taxExempt: false }],
    customLines: [NJ_TAX],
    shipTos: [{ key: 'a', label: 'Main', state: 'NJ', taxRate: 6.625 }],
  };

  test('per-location tax is active but NOT allocated', () => {
    const lt = confLocationTax(conf);
    expect(lt.active).toBe(true);
    expect(lt.allocated).toBe(false);
    expect(lt.total).toBe(0);
  });

  test('so the legacy line still applies and the tax survives', () => {
    expect(supersedesTaxLine(confLocationTax(conf), NJ_TAX)).toBe(false);
    // $2,000 + 6.625% = $2,132.50. It was dropping to $2,000.00.
    expect(grandTotal(conf)).toBe(2132.5);
  });

  test('once units ARE allocated, per-location tax takes over and is not doubled', () => {
    const allocated = {
      ...conf,
      items: [{ sizes: [{ qty: 100, unitPrice: 20 }], taxExempt: false, allocations: [{ key: 'a', qty: 100 }] }],
    };
    const lt = confLocationTax(allocated);
    expect(lt.allocated).toBe(true);
    expect(lt.total).toBe(132.5);
    expect(supersedesTaxLine(lt, NJ_TAX)).toBe(true);
    // Taxed exactly once.
    expect(grandTotal(allocated)).toBe(2132.5);
  });
});

describe('a legacy percent tax line charges the taxable base, not everything', () => {
  const mixed = {
    items: [
      { sizes: [{ qty: 100, unitPrice: 15 }], taxExempt: true },   // $1,500 apparel — NJ exempt
      { sizes: [{ qty: 100, unitPrice: 5 }],  taxExempt: false },  // $500 promo — taxable
    ],
    customLines: [NJ_TAX],
    shipTos: [],
  };

  test('only the non-exempt merchandise is in the base', () => {
    expect(confTaxableSubtotal(mixed)).toBe(500);
  });

  test('tax is $33.13, not $132.50 — $99.37 was being over-collected', () => {
    expect(customLineValue(NJ_TAX, 2000, 500)).toBeCloseTo(33.125, 3);
    expect(grandTotal(mixed)).toBe(2033.13);
  });

  test('this matches what per-location tax charges for the same goods', () => {
    const perLocation = {
      ...mixed,
      customLines: [],
      shipTos: [{ key: 'a', label: 'Main', state: 'NJ', taxRate: 6.625 }],
      items: mixed.items.map((it) => ({ ...it, allocations: [{ key: 'a', qty: 100 }] })),
    };
    // Both mechanisms now agree; before, which one you used changed the bill.
    expect(confLocationTax(perLocation).total).toBe(33.13);
    expect(grandTotal(perLocation)).toBe(2033.13);
  });
});

describe('non-tax percent lines are untouched', () => {
  test('a card fee still compounds on the running subtotal', () => {
    const fee = { label: 'Credit card fee', amount: 2.99, isPercent: true };
    expect(isTaxCustomLine(fee)).toBe(false);
    // 2.99% of the running total (2000), not of a taxable base.
    expect(customLineValue(fee, 2000, 500)).toBeCloseTo(59.8, 6);
  });

  test('a flat line is its own amount regardless of base', () => {
    expect(customLineValue({ label: 'Rush', amount: 250, isPercent: false }, 2000, 500)).toBe(250);
  });
});
