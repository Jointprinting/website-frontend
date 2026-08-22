// src/screens/studio/_promoPricing.js
//
// Promo-catalog money, extracted pure so it can be tested without pulling the
// picker's axios import through Jest (same reason as _confSeed.js and
// _quotePricing.js).
//
// Promo items price differently from apparel and that difference is the source
// of both bugs fixed here. An apparel line is costed and then priced by a margin
// chip, so every cost it carries — blank, print, setup, freight — flows into the
// price automatically. A promo line arrives with the VENDOR's client price, which
// already carries its own baked-in margin, so it lands `noMarkup` and
// `priceLocked` and the chips deliberately leave it alone.
//
// Which means any cost a promo line carries that ISN'T in the catalog price is
// simply absorbed. Setup is exactly that cost.

const n = (v) => (Number(v) > 0 ? Number(v) : 0);

// Money is never stored as a number in the promo catalog — it's whatever the
// vendor's sheet said. "$50", "$50 (G)", "$40 per color", "50.00 per location".
//
// The old parser took the first number and stopped, so "$40 per color" on a
// three-colour job booked $40 instead of $120 — a $80 hole that widened with
// every extra colour, and the more complex the job the bigger the miss.
//
// Returns { value, per } where `per` is '' for a flat charge, or the unit the
// charge repeats over. The caller must resolve `per` into a count; nothing here
// guesses, because guessing 1 is how the hole got there in the first place.
export function parsePromoMoney(s) {
  const str = String(s == null ? '' : s);
  const m = str.match(/(\d+(?:\.\d+)?)/);
  const value = m ? Number(m[1]) : 0;
  if (!value) return { value: 0, per: '' };
  // Ordered longest-first so "per color location" can't match the wrong one.
  if (/per\s*(colou?r|screen|ink)/i.test(str))       return { value, per: 'color' };
  if (/per\s*(location|position|placement|side)/i.test(str)) return { value, per: 'location' };
  if (/per\s*(design|logo|art)/i.test(str))          return { value, per: 'design' };
  return { value, per: '' };
}

// Human label for the count a `per` charge repeats over.
export const PER_LABEL = {
  color:    'colours',
  location: 'locations',
  design:   'designs',
};

// The whole setup charge for a run: a flat charge as-is, a repeating charge
// times how many it repeats over.
export function promoSetupTotal(parsed, units) {
  const p = parsed || {};
  const v = n(p.value);
  if (!v) return 0;
  if (!p.per) return v;
  const count = Math.max(1, Math.floor(n(units)) || 1);
  return v * count;
}

const roundCents = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;

// What one unit really costs and what it should really sell for.
//
// Setup is amortized across the run on BOTH sides — into the cost, because it is
// one, and into the price, because otherwise the run absorbs it. That is the
// same treatment apparel already gets (see _confSeed.seedUnitCost, which spreads
// setup + freight over the run), so the two product types finally book money the
// same way.
//
// The vendor's catalog margin is preserved exactly: the setup is passed through
// at cost, not marked up. Marking it up would quietly change the vendor's
// pricing, which is not ours to change.
export function promoUnitAllIn({ catalogPrice = 0, netCost = 0, setupTotal = 0, qty = 0 } = {}) {
  const q = n(qty);
  const perUnitSetup = q > 0 ? n(setupTotal) / q : 0;
  const unitCost  = n(netCost) + perUnitSetup;
  const unitPrice = roundCents(n(catalogPrice) + perUnitSetup);
  const marginPct = unitPrice > 0 ? ((unitPrice - unitCost) / unitPrice) * 100 : null;
  return { unitPrice, unitCost, perUnitSetup, marginPct };
}

// The margin the picker SHOWS, which must be the margin the job actually earns.
//
// It used to read (price - cost) / price against the catalog price and the net
// cost only — setup nowhere in it. On a 100-piece ashtray at $4.32 with a $50
// setup that reads 30% when the truth is 20.8%: a $50 hole displayed as profit,
// on the one screen where the owner decides whether the job is worth taking.
export function promoMarginPct({ catalogPrice = 0, netCost = 0, setupTotal = 0, qty = 0 } = {}) {
  return promoUnitAllIn({ catalogPrice, netCost, setupTotal, qty }).marginPct;
}
