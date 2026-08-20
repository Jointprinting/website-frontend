// src/screens/studio/_quotePricing.js
//
// ONE definition of "reprice a quote line to a target margin", shared by every
// control that does it: the per-cell chip strip (selectTier), the design-level
// margin strip (applyTier) and the per-row chips (applyRowTier).
//
// It used to be written out three times, and only one of them honoured
// priceLocked. So the lock — added specifically because a mis-clicked margin
// chip had already destroyed catalog prices with no undo — protected a cell from
// the strip directly under it while the design-level strip and the row chips
// happily overwrote it. Same bug, same file, two remaining doors.
//
// Dependency-free so it is directly testable; QuoteBuilder itself pulls axios,
// which Jest cannot parse.

import { lineCogsPerUnit } from './_shared';

// The owner thinks in MARGIN, not markup: 30% means 30% of what the client pays
// is profit, so price = cost / (1 - margin). (A +30% markup would be a 23%
// margin, which is why the old markup strip read as broken.)
export function priceAtMargin(cogs, marginPct) {
  return marginPct >= 100 ? 0 : (Number(cogs) || 0) / (1 - (Number(marginPct) || 0) / 100);
}

// Is this line's price the vendor's, not ours? A catalog-sourced promo price is
// LOCKED: its margin is the vendor's client-vs-net spread, not a markup, so
// repricing it off COGS silently destroys the number the catalog gave us.
export function isPriceLocked(line) {
  return !!(line && line.priceLocked);
}

// The patch that prices `line` at `pct` margin — or an EMPTY patch when the line
// is locked, so a caller can map this over a selection without special-casing.
// Returning {} rather than throwing keeps "reprice everything visible" honest:
// the unlocked cells move, the locked ones keep the catalog's number.
export function repriceToMargin(line, pct) {
  if (isPriceLocked(line)) return {};
  const cogs = lineCogsPerUnit(line);
  const price = +priceAtMargin(cogs, pct).toFixed(2);
  return {
    unitPrice: price,
    // Keep markup in step with the committed price. It is what the backend falls
    // back to when unitPrice is cleared (adding a run-size column, duplicating a
    // colour), so leaving it stale silently reprices those new cells at 1.4.
    markup:   cogs > 0 ? +(price / cogs).toFixed(4) : 1,
    noMarkup: false,   // choosing a margin turns off the fixed-price lane
  };
}
