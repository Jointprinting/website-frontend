// src/common/confTax.js
//
// THE single source of truth for confirmation SALES-TAX math on the client side.
// Both the studio (screens/studio/_shared.js → confRevenue, the confirmation
// builder, the order tracker) and the client-facing document
// (screens/ConfirmationDocument.js → computeConfTotals, the public approval page)
// import from HERE — so the tax a job shows inside the Studio and the tax the
// client sees on their approval link can never disagree.
//
// This module exists because they DID disagree once: a `taxExempt` guard (the NJ
// apparel exemption) was fixed in one copy and not the other, so a mixed
// apparel+promo order taxed the clothing on the client's document only. Collapsing
// the duplicated math to one function makes that class of silent drift impossible.
//
// Dependency-free ON PURPOSE — no MUI, no design tokens — so the public approval
// bundle doesn't have to pull in the private studio's _shared module to get it.
// MUST mirror backend models/Order.js roundCents / isTaxCustomLine /
// computeLocationTax exactly (that's the server-side twin for the same job).

// Round-half-up to cents — mirrors backend models/Order.js roundCents. Snaps a
// grand total / tax line to a real cent amount so floating-point sums don't drift
// sub-cent. Number.EPSILON nudges true *.xx5 values up to the right cent.
export const roundCents = (v) => Math.round(((Number(v) || 0) + Number.EPSILON) * 100) / 100;

// Is this add-on customLine a SALES-TAX line? Mirrors backend isTaxCustomLine: an
// explicit `isTax` flag wins; otherwise a label mentioning "tax". Used to drop a
// legacy tax customLine when per-location tax is active, so a job is taxed once.
export const isTaxCustomLine = (line) =>
  !!line && (line.isTax === true || /tax/i.test(String(line.label || '')));

// Per-location sales tax for a multi-ship-to confirmation. ACTIVE only when at
// least one shipTo carries a taxRate > 0 — otherwise a no-op, so totals stay
// byte-identical to a single-location order. Each item's merchandise revenue
// (Σ qty×unitPrice) is allocated to a location PROPORTIONALLY by its share of the
// item's units (locationItemRevenue = itemRevenue × allocQty / itemTotalQty),
// summed into the location's taxable subtotal, then × taxRate%. Tax is on
// MERCHANDISE only (not the add-on customLines), the correct sales-tax base.
// MUST mirror backend models/Order.js computeLocationTax exactly.
export function confLocationTax(conf) {
  const n = (v) => Number(v) || 0;
  const shipTos = (conf && Array.isArray(conf.shipTos)) ? conf.shipTos : [];
  const taxed = shipTos.filter((st) => st && n(st.taxRate) > 0);
  if (taxed.length === 0) return { active: false, allocated: false, total: 0, lines: [] };
  const items = (conf && Array.isArray(conf.items)) ? conf.items : [];
  // Has the owner actually ALLOCATED units to a taxed location? A shipTo with a
  // rate makes per-location tax "active", but the taxable base comes from per-item
  // allocations — so a half-finished setup computed $0 tax while ALSO suppressing
  // the legacy "NJ tax" line, and the tax silently vanished ($2,132.50 -> $2,000).
  // MUST mirror backend computeLocationTax.
  const taxedKeys = new Set(taxed.map((st) => st && st.key));
  const allocated = items.some((it) => ((it && it.allocations) || [])
    .some((a) => a && taxedKeys.has(a.key) && n(a.qty) > 0));
  const lines = taxed.map((st) => {
    const subtotal = items.reduce((sum, it) => {
      // NJ clothing exemption — mirrors backend computeLocationTax: a taxExempt
      // item (apparel) contributes nothing to the taxable base; promos still tax.
      if (it && it.taxExempt) return sum;
      const itemRevenue = ((it && it.sizes) || []).reduce((ss, sz) => ss + n(sz.qty) * n(sz.unitPrice), 0);
      const itemQty = ((it && it.sizes) || []).reduce((q, sz) => q + n(sz.qty), 0);
      if (itemQty <= 0) return sum;
      const allocQty = ((it && it.allocations) || []).reduce((q, a) => q + (a && a.key === st.key ? n(a.qty) : 0), 0);
      // Clamp a bad allocation share to [0,1] so the taxed base can't exceed the
      // item's real revenue (H5). Mirrors backend computeLocationTax.
      const share = allocQty <= 0 ? 0 : (allocQty >= itemQty ? 1 : allocQty / itemQty);
      return sum + itemRevenue * share;
    }, 0);
    const rate = n(st.taxRate);
    // `key` lets the client document line each ship-to up with its own tax row;
    // `subtotal`/`rate` are for the studio. Round each line to cents (H4) so the
    // displayed tax and the summed total are real cent amounts.
    return { label: `${st.label || st.name || 'Location'} tax - ${rate}%`, key: st.key, subtotal, rate, value: roundCents(subtotal * rate / 100) };
  });
  return { active: true, allocated, total: roundCents(lines.reduce((s, l) => s + l.value, 0)), lines };
}

// The MERCHANDISE base a sales-tax line may charge against: item revenue with
// taxExempt items removed. Per-location tax has always used this base; a legacy
// percent "NJ tax" customLine charged the whole running subtotal instead, so it
// taxed NJ-exempt clothing. A $1,500 apparel + $500 promo order billed $132.50
// where $33.13 was due. MUST mirror backend computeConfirmationTotals.
export function confTaxableSubtotal(conf) {
  const n = (v) => Number(v) || 0;
  const items = (conf && Array.isArray(conf.items)) ? conf.items : [];
  return items.reduce((s, it) => (it && it.taxExempt) ? s : (
    s + ((it && it.sizes) || []).reduce((ss, sz) => ss + n(sz.qty) * n(sz.unitPrice), 0)
  ), 0);
}

// Should this legacy tax customLine be dropped because per-location tax covers it?
// Only once per-location tax is REALLY in use (a rate AND allocations) — dropping
// on `active` alone lost the tax entirely on a half-configured multi-ship order.
export function supersedesTaxLine(locationTax, line) {
  return !!(locationTax && locationTax.active && locationTax.allocated && isTaxCustomLine(line));
}

// The dollar value a customLine contributes. A percent SALES-TAX line charges the
// taxable merchandise base; every other percent line (card fee, discount) still
// compounds on the running subtotal, which is the existing behaviour.
export function customLineValue(line, running, taxableSubtotal) {
  const n = (v) => Number(v) || 0;
  if (!line || !line.isPercent) return n(line && line.amount);
  const base = isTaxCustomLine(line) ? n(taxableSubtotal) : n(running);
  return base * n(line.amount) / 100;
}
