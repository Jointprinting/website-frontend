// src/common/priceIncludes.js
//
// The client-side reading of what a quote's per-unit price covers. The FACTS
// come from the server (website-backend/utils/priceIncludes.js), derived from
// the quote's own lines; this turns them into the sentence the approval page
// shows, and decides when there isn't enough to be worth saying.
//
// Why derived at all: the page used to say "every price is all-in per unit" and
// stop. The owner read that on his own client-facing page and called it out —
// it never says shipping is in there. It usually is (a line's setup and freight
// are spread across its own quantity) but only when that quote was built that
// way, so the page promises what the lines back and nothing more. A wrong
// "shipping included" on a page someone signs is worse than a quiet one.

// What the price covers, in the order a client would say it.
export function priceCoverParts(includes) {
  const inc = includes || {};
  return [
    'the blanks',
    'printing',
    inc.setup ? 'screens & setup' : null,
    inc.shipping ? 'shipping to you' : null,
  ].filter(Boolean);
}

// "the blanks, printing and shipping to you"
export function priceCoverSentence(includes) {
  const parts = priceCoverParts(includes);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

// Worth showing? "the blanks and printing" is true of every quote ever written
// and earns nobody's trust, so the strip only appears once the quote actually
// backs something extra — setup, freight, or a stated lead time.
export function worthShowingIncludes(includes) {
  const inc = includes || {};
  return priceCoverParts(inc).length >= 3 || (Number(inc.turnaroundWeeks) || 0) > 0;
}
