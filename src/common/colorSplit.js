// src/common/colorSplit.js
//
// MIRROR of website-backend/utils/colorSplit.js — keep the two identical (same
// discipline as the CRM stages / tax rates / mockup numbers). The approval page
// computes the client's live price from these rules and the server re-derives it
// on submit; a divergence would quote a number we then don't honour.
//
// A RUN IS DEFINED BY ITS INK, AND THE CLIENT SPLITS IT ACROSS GARMENT COLOURS.
//
// The owner's rule: "if they want 75 maroon and 75 white shirts with black ink
// that's feasible and they would get a better price at the 150 unit mark since
// it can be combined — but if it was 75 maroon w black ink and 75 black with
// white ink those can't be combined."
//
// So one quote row = one print job. Under it the client types a quantity per
// garment colour; those quantities ADD UP and their total selects the price
// tier. Two rows with different ink are separate runs and never combine.
//
// This replaces asking the client to pick one fixed quantity chip — a client who
// wanted three colours at 150 each could not express 450 that way, since the
// chips were 50/100/150 and picking three of them is 300 of nothing anyone
// ordered.

const n = (v) => (Number(v) > 0 ? Number(v) : 0);
const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();

export function splitTotal(split) {
  return (Array.isArray(split) ? split : []).reduce((s, c) => s + n(c && c.qty), 0);
}

// What this line is actually ORDERED at: the split's total when the client typed
// one, else the line's own tier quantity.
export function orderedQty(line) {
  const t = splitTotal(line && line.colorSplit);
  if (t > 0) return t;
  // A FREE QUANTITY on a run that isn't sold by colour. Same idea as the split,
  // one step simpler: the client types how many they need and the largest tier
  // at or below it sets the price, so a quote showing 50/100/150 can be bought
  // at 75 without anyone asking the owner to add a chip. `qty` remains the TIER
  // the line priced at — never what was ordered.
  const picked = n(line && line.pickedQty);
  return picked > 0 ? picked : n(line && line.qty);
}

// The tier a total lands on: the largest run size at or below it. Mirrors how
// the print catalog already tiers — 175 pays the 150 price, 449 pays the 300.
export function tierLineFor(rowLines, total) {
  const rows = (Array.isArray(rowLines) ? rowLines : []).filter(Boolean);
  if (!rows.length) return null;
  const t = n(total);
  let best = null;
  for (const l of rows) {
    const q = n(l.qty);
    if (q > 0 && t >= q && (!best || q > n(best.qty))) best = l;
  }
  return best;
}

// The smallest run size offered — the MOQ for that print job.
export function minRunFor(rowLines) {
  const qs = (Array.isArray(rowLines) ? rowLines : []).map((l) => n(l && l.qty)).filter((q) => q > 0);
  return qs.length ? Math.min(...qs) : 0;
}

// Validate a FREE QUANTITY against what the owner offered — the colour-less twin
// of validateSplit. Returns { ok, qty, message }.
//
// The rules are deliberately the same two: it has to be a real whole quantity,
// and it has to clear the run's MOQ. Above that, anything goes — the tier is
// whatever price break it reaches, so 75 on a 50/100/150 quote is a legitimate
// order at the 50-piece price rather than a request the owner has to action by
// hand.
//
// No ceiling: quoting more than the largest break is the owner's problem to
// price, not the client's to be blocked on, and tierLineFor already tops out at
// the biggest tier at or below the number.
export function validateQty(raw, rowLines) {
  const q = Number(raw);
  if (!Number.isFinite(q) || q <= 0) {
    return { ok: false, qty: 0, message: 'Enter how many you need.' };
  }
  if (!Number.isInteger(q)) {
    return { ok: false, qty: 0, message: 'Please enter a whole number of pieces.' };
  }
  const min = minRunFor(rowLines);
  if (min > 0 && q < min) {
    return { ok: false, qty: q, message: `This design runs from ${min} pieces — you have ${q}. Add ${min - q} more.` };
  }
  return { ok: true, qty: q, message: '' };
}

// Validate an allocation against what the owner offered. Returns
// { ok, total, message, split }. Strict about WHICH colours: the offer is his
// curated list, checked against S&S stock when he built it.
export function validateSplit(offered, split, rowLines) {
  const list = (Array.isArray(offered) ? offered : []).filter(Boolean);
  const byName = new Map(list.map((c) => [norm(c.name), c]));
  const byCode = new Map(list.filter((c) => c.code).map((c) => [norm(c.code), c]));

  const seen = new Set();
  const clean = [];
  for (const c of Array.isArray(split) ? split : []) {
    const qty = n(c && c.qty);
    if (!qty) continue;
    const hit = byName.get(norm(c && c.name)) || byCode.get(norm(c && c.code));
    if (!hit) return { ok: false, total: 0, split: [], message: `We don't have "${(c && c.name) || 'that colour'}" on this design — please pick from the colours shown.` };
    const key = norm(hit.name);
    if (seen.has(key)) return { ok: false, total: 0, split: [], message: `${hit.name} is listed twice — please put its whole quantity on one line.` };
    seen.add(key);
    clean.push({ name: hit.name, code: hit.code || '', hex: hit.hex || '', qty });
  }

  const total = splitTotal(clean);
  if (!total) return { ok: false, total: 0, split: [], message: 'Enter how many of each colour you need.' };

  const min = minRunFor(rowLines);
  if (min > 0 && total < min) {
    return { ok: false, total, split: clean, message: `This design runs from ${min} pieces — you have ${total}. Add ${min - total} more across any colours.` };
  }
  return { ok: true, total, split: clean, message: '' };
}

// ── CLIENT-ONLY, and deliberately not mirrored on the server ─────────────────
//
// Everything else in this file is mirrored byte-for-byte in
// website-backend/utils/colorSplit.js, because both sides compute PRICES from
// it and a divergence would quote a number we then don't honour. This one is
// about what the approval page RENDERS, which the server has no opinion on — so
// it lives here alone rather than as dead code over there. Read the asymmetry as
// intentional, not as drift.
//
// A group can hold BOTH a colour run and ordinary options: "Bucket Hats" might
// pitch a Gildan blank the owner did an S&S colour lookup on, beside a promo
// item with no colour list at all. The page used to render the colour run and
// stop, so every option in that group without colours was invisible to the
// client — the owner built a two-option pitch and the client saw one.
//
// Splits a group's lines into the colour run (if any) and everything it doesn't
// cover, so both can render.
export function splitGroupByRun(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter(Boolean);
  const withColours = list.filter((l) => ((l && l.colorOptions) || []).length);
  if (!withColours.length) return { run: null, rest: list };

  const first = withColours[0];
  const tiers = runLines(list, first).slice().sort((a, b) => n(a && a.qty) - n(b && b.qty));
  const inRun = new Set(tiers);
  return {
    run: { first, tiers, options: first.colorOptions || [] },
    rest: list.filter((l) => !inRun.has(l)),
  };
}

// The RUN a line belongs to — identical to quoteGrid.quoteRowKey, because a row
// in the owner's design grid IS one run: the lines that differ only by run size.
export function runKey(l) {
  return ['styleCode', 'description', 'printDetails', 'color'].map((k) => norm(l && l[k])).join('|');
}

// Every line of one run — the run's price-break table.
export function runLines(view, line) {
  const k = runKey(line);
  return (Array.isArray(view) ? view : []).filter((l) => l && l.group === line.group && runKey(l) === k);
}
