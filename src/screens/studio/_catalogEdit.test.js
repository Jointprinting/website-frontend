// src/screens/studio/PrinterCatalogTab.coerce.test.js
//
// The pretty price-grid editor edits every leaf as a raw STRING (so a decimal
// like "6.60" never jumps mid-type) and coerces back to the section's ORIGINAL
// shape on save. These two pure helpers are the whole save contract — this pins
// that a cell edit lands as a number in the exact shape the engine reads, and
// that the structure (models, array lengths, N/A nulls) is never mutated.

import { setAtPath, coerceLikeShape } from './_catalogEdit';

describe('setAtPath (immutable deep-set)', () => {
  it('sets an array-index leaf without mutating the source', () => {
    const src = { tiers: [{ prices: [1, 2, 3] }] };
    const out = setAtPath(src, ['tiers', 0, 'prices', 1], '9.5');
    expect(out.tiers[0].prices[1]).toBe('9.5');
    expect(src.tiers[0].prices[1]).toBe(2);            // original untouched
    expect(out.tiers[0].prices[0]).toBe(1);            // siblings preserved
  });

  it('sets a string-keyed grid cell (grid[size][col])', () => {
    const src = { grid: { '4x4': [2.7, 2.0] } };
    const out = setAtPath(src, ['grid', '4x4', 0], '3.10');
    expect(out.grid['4x4'][0]).toBe('3.10');
    expect(src.grid['4x4'][0]).toBe(2.7);
  });
});

describe('coerceLikeShape (string leaves → original shape)', () => {
  it('coerces an edited numeric cell back to a number', () => {
    const orig = { model: 'qty_x_colors', tiers: [{ minQty: 48, prices: [4.0, 4.5] }] };
    const draft = setAtPath(orig, ['tiers', 0, 'prices', 1], '5.25');
    const clean = coerceLikeShape(draft, orig);
    expect(clean.tiers[0].prices[1]).toBe(5.25);
    expect(typeof clean.tiers[0].prices[1]).toBe('number');
  });

  it('keeps the model tag and never adds/drops keys or array length', () => {
    const orig = { model: 'qty_x_size', sizes: ['S'], qtyTiers: [{ minQty: 1 }], grid: { S: [3, 4, 5] } };
    const clean = coerceLikeShape(setAtPath(orig, ['grid', 'S', 0], '9'), orig);
    expect(clean.model).toBe('qty_x_size');
    expect(clean.grid.S).toHaveLength(3);
    expect(Object.keys(clean)).toEqual(Object.keys(orig));
    expect(clean.grid.S[0]).toBe(9);
  });

  it('a blanked numeric cell becomes 0 (not NaN)', () => {
    const orig = { tiers: [{ price: 8 }] };
    const clean = coerceLikeShape(setAtPath(orig, ['tiers', 0, 'price'], ''), orig);
    expect(clean.tiers[0].price).toBe(0);
  });

  it('an untouched N/A (null) price stays null', () => {
    const orig = { tiers: [{ prices: [1.5, null] }] };
    const clean = coerceLikeShape({ tiers: [{ prices: [1.5, null] }] }, orig);
    expect(clean.tiers[0].prices[1]).toBeNull();
  });

  it('preserves shade-array cells (qty_x_size_x_shade prices[size] = [dark, light, white])', () => {
    const orig = { model: 'qty_x_size_x_shade', sizes: ['24 sqin'],
      tiers: [{ minQty: 1, prices: { '24 sqin': [8.13, 6.5, 7.31] } }] };
    const draft = setAtPath(orig, ['tiers', 0, 'prices', '24 sqin', 2], '7.99');
    const clean = coerceLikeShape(draft, orig);
    expect(clean.tiers[0].prices['24 sqin']).toEqual([8.13, 6.5, 7.99]);
  });
});
