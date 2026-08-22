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

// The patch for a HAND-TYPED price.
//
// Typing a price used to write unitPrice and nothing else, which quietly left
// `markup` holding whatever it held before — 1.4 by default, a MARKUP, i.e. a
// 28.6% margin. That stale multiplier is what prices any cell created with its
// unitPrice cleared: a new run-size column, a new option row, a colour
// duplicate. So hand-typing $18.00 on a $10.00-cost cell (44.4% margin) and then
// adding a 200-unit column produced a cell at 28.6%, with nothing on screen to
// distinguish the two and a code comment claiming the opposite.
//
// Keeping the two in step at the moment of typing fixes it at the source, so
// every downstream fallback inherits the margin the owner actually chose.
// Locked (catalog) prices are left alone, exactly as repriceToMargin leaves them.
export function patchTypedPrice(line, raw) {
  if (isPriceLocked(line)) return { unitPrice: raw };
  const price = Number(raw);
  if (!Number.isFinite(price) || price <= 0) return { unitPrice: raw };
  const cogs = lineCogsPerUnit(line);
  return {
    unitPrice: raw,
    markup:   cogs > 0 ? +(price / cogs).toFixed(4) : 1,
    noMarkup: false,
  };
}

// The margin a line is ACTUALLY selling at, for display and for carrying onto a
// copy. Derived from the committed price when there is one, because that is the
// truth; `markup` is only the fallback for a line that has never been priced.
export function effectiveMarginPct(line) {
  const cogs = lineCogsPerUnit(line);
  if (!(cogs > 0)) return null;
  const price = Number(line && line.unitPrice) > 0
    ? Number(line.unitPrice)
    : cogs * (Number(line && line.markup) || 1);
  if (!(price > 0)) return null;
  return ((price - cogs) / price) * 100;
}
