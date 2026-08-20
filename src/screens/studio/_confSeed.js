// src/screens/studio/_confSeed.js
//
// The cost math behind seeding confirmation items from a quote line. Pulled out
// of ConfirmationBuilder so it is dependency-free and directly testable — the
// same reason _printLocations, common/colorSplit and common/confTax are their own
// modules. The builder imports these; nothing else changes.

// Setup and shipping are charged ONCE for the whole print run. When a client
// answers a quote line with a COLOUR SPLIT, the confirmation seeds one item per
// colour — but they are still one run, so the run's total is what setup+shipping
// must be spread across. This returns that total (zero/negative colours dropped,
// matching the filter the builder applies before seeding).
export function splitRunQty(colorSplit) {
  return ((colorSplit) || [])
    .filter((c) => c && Number(c.qty) > 0)
    .reduce((total, c) => total + (Number(c.qty) || 0), 0);
}

// A quote line's true cost per unit: blank + print, plus setup+shipping spread
// over `amortizeQty`. `amortizeQty` defaults to the line's own qty (the ordinary
// single-item case); a colour split passes the RUN total instead.
//
// Spreading over each colour's slice instead of the run made every colour carry
// the FULL setup+ship, and backend computeConfirmationCogs sums
// itemTotalQty x unitCost across items — so setup+ship was counted once PER
// COLOUR. A 300-piece run split 150/150 with $120 setup + $90 shipping booked
// $2,220 of COGS against a true $2,010, and the stored Order.cogs supersedes the
// (correct) quote figure the moment a confirmation exists. Margin read low, forever.
export function seedUnitCost(line, amortizeQty) {
  const q = Number(line && line.qty) || 0;
  const spreadOver = Number(amortizeQty) > 0 ? Number(amortizeQty) : q;
  // Negative setup/shipping credits are clamped here the same way lineCogsPerUnit
  // clamps them, so the displayed cost and the booked cost agree.
  const setupShip = Math.max(0, Number(line && line.setupCost) || 0)
                  + Math.max(0, Number(line && line.shippingCost) || 0);
  const base = (Number(line && line.blankCost) || 0) + (Number(line && line.printCost) || 0);
  return base + (spreadOver > 0 ? setupShip / spreadOver : 0);
}
