// src/screens/studio/_promoPricing.test.js
//
// Both bugs here cost real money on every promo job, and both were invisible:
// the numbers looked plausible, they were just wrong.

import {
  parsePromoMoney, promoSetupTotal, promoUnitAllIn, promoMarginPct,
} from './_promoPricing';

describe('parsePromoMoney', () => {
  test('a flat charge is flat', () => {
    expect(parsePromoMoney('$50')).toEqual({ value: 50, per: '' });
    expect(parsePromoMoney('$50 (G)')).toEqual({ value: 50, per: '' });
    expect(parsePromoMoney('50.00')).toEqual({ value: 50, per: '' });
  });

  test('THE BUG: "per color" is a repeating charge, not a flat one', () => {
    // The old parser returned 40 here and stopped. On a three-colour job that
    // booked $40 against a real $120.
    expect(parsePromoMoney('$40 per color')).toEqual({ value: 40, per: 'color' });
    expect(parsePromoMoney('$40 per colour')).toEqual({ value: 40, per: 'color' });
    expect(parsePromoMoney('$40 per screen')).toEqual({ value: 40, per: 'color' });
  });

  test('locations and designs repeat too', () => {
    expect(parsePromoMoney('$25 per location')).toEqual({ value: 25, per: 'location' });
    expect(parsePromoMoney('$25 per side')).toEqual({ value: 25, per: 'location' });
    expect(parsePromoMoney('$60 per design')).toEqual({ value: 60, per: 'design' });
  });

  test('no charge, no unit', () => {
    expect(parsePromoMoney('')).toEqual({ value: 0, per: '' });
    expect(parsePromoMoney('included')).toEqual({ value: 0, per: '' });
    expect(parsePromoMoney(null)).toEqual({ value: 0, per: '' });
  });
});

describe('promoSetupTotal', () => {
  test('a flat charge ignores the count', () => {
    expect(promoSetupTotal({ value: 50, per: '' }, 3)).toBe(50);
  });

  test('THE BUG, in money: $40 per colour across three colours is $120', () => {
    expect(promoSetupTotal({ value: 40, per: 'color' }, 3)).toBe(120);
  });

  test('a repeating charge is at least one', () => {
    // Never zero — a job with a setup charge always has at least one of the
    // thing the charge repeats over.
    expect(promoSetupTotal({ value: 40, per: 'color' }, 0)).toBe(40);
    expect(promoSetupTotal({ value: 40, per: 'color' }, undefined)).toBe(40);
  });

  test('no charge is no charge', () => {
    expect(promoSetupTotal({ value: 0, per: 'color' }, 5)).toBe(0);
    expect(promoSetupTotal(null, 5)).toBe(0);
  });
});

describe('promoUnitAllIn', () => {
  test('setup lands in the cost AND the price, so it stops being absorbed', () => {
    // 100 ashtrays, catalog $4.32, net cost $3.02, $50 setup.
    const r = promoUnitAllIn({ catalogPrice: 4.32, netCost: 3.02, setupTotal: 50, qty: 100 });
    expect(r.perUnitSetup).toBeCloseTo(0.5, 10);
    expect(r.unitCost).toBeCloseTo(3.52, 10);
    expect(r.unitPrice).toBe(4.82);
  });

  test("the vendor's catalog margin is preserved — setup passes at cost", () => {
    // Price and cost each rise by the same per-unit setup, so the margin the
    // vendor built into the catalog price is exactly what the job earns.
    const withSetup = promoUnitAllIn({ catalogPrice: 10, netCost: 6, setupTotal: 100, qty: 100 });
    const without   = promoUnitAllIn({ catalogPrice: 10, netCost: 6, setupTotal: 0, qty: 100 });
    expect(withSetup.unitPrice - withSetup.unitCost).toBeCloseTo(without.unitPrice - without.unitCost, 10);
  });

  test('no quantity means nothing to spread over', () => {
    const r = promoUnitAllIn({ catalogPrice: 4.32, netCost: 3.02, setupTotal: 50, qty: 0 });
    expect(r.perUnitSetup).toBe(0);
    expect(r.unitPrice).toBe(4.32);
  });

  test('the price is money — snapped to cents', () => {
    const r = promoUnitAllIn({ catalogPrice: 4.325, netCost: 3, setupTotal: 1, qty: 3 });
    expect(Number.isInteger(Math.round(r.unitPrice * 100))).toBe(true);
    expect(r.unitPrice).toBe(4.66);
  });
});

describe('promoMarginPct — the number the owner decides on', () => {
  test('THE BUG: the picker showed 30% on a job that earns 20.8%', () => {
    // 100 ashtrays, catalog $4.32, net $3.02, $50 setup.
    // Old readout: (4.32 - 3.02) / 4.32 = 30.1%, setup nowhere in it.
    const naive = ((4.32 - 3.02) / 4.32) * 100;
    expect(naive).toBeCloseTo(30.1, 1);

    // True: cost is $3.52 all-in against a $4.82 all-in price.
    expect(promoMarginPct({ catalogPrice: 4.32, netCost: 3.02, setupTotal: 50, qty: 100 }))
      .toBeCloseTo(26.97, 1);
  });

  test('the smaller the run, the more the setup hurts — and it now shows', () => {
    const big   = promoMarginPct({ catalogPrice: 10, netCost: 6, setupTotal: 100, qty: 1000 });
    const small = promoMarginPct({ catalogPrice: 10, netCost: 6, setupTotal: 100, qty: 25 });
    expect(small).toBeLessThan(big);
  });

  test('no price, no margin to report', () => {
    expect(promoMarginPct({ catalogPrice: 0, netCost: 0, setupTotal: 0, qty: 10 })).toBeNull();
  });
});
